/* Native raster skeleton. No canvas rotation, filtering or fractional alpha. */
(function (scope) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  /* Below this much tilt a rigid unit is translated rather than rotated: less
     than a pixel of turn is noise, and sampling it costs pixels off the end of
     one row and not the next, which snaps a thin strand into dots. The margin
     is wide enough that nothing the animation does can cross it by accident —
     only a deliberate angle from the inspector gets through. */
  const UNIT_SNAP = .18;

  /* Dyeing. A garment is not one colour, it is a ramp: four or five tones that
     carry its shading, sometimes with a second hue in it — the cloak's warm
     lining is a different colour from the cloak. So a new colour is applied as
     the *difference* between the chosen colour and the ramp's own base, in hue,
     saturation and lightness, and every tone is moved by that same difference.
     Each tone then keeps its place in the shading, and a second hue travels
     with the first instead of being flattened into it. Replacing the tones with
     a generated ramp instead would throw away the shading the art was drawn
     with, which is the whole reason it reads. */
  const toHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2;
    if (hi === lo) return [0, 0, l];
    const d = hi - lo, s = l > .5 ? d / (2 - hi - lo) : d / (hi + lo);
    const h = hi === r ? ((g - b) / d + (g < b ? 6 : 0)) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  };
  const toRgb = (h, s, l) => {
    if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const hue = t => {
      t = (t % 1 + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map(v => Math.round(v * 255));
  };
  const pack = ([r, g, b]) => (r | g << 8 | b << 16 | 255 << 24) >>> 0;
  /* The baked colour table carries a transparent entry at zero, so run-length
     indices sit one above the palette's own. Ramps are written against the
     palette, so every lookup shifts. */
  const slot = index => index + 1;
  const unpack = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  /* Where a rotated cell is sampled: its centre, then its four quarters. The
     art is authored with clusters and gaps as thin as one pixel, which is how
     pixel art is drawn and is not up for negotiation — so surviving rotation is
     the renderer's job, and it does it by asking what the cell covers instead
     of what sits exactly under its middle. */
  const AREA = [0, 0, -.32, -.32, .32, -.32, -.32, .32, .32, .32];
  // Row and columns of the eyes in the head art. Each eye is one white pixel and
  // one iris pixel, listed as pairs.
  const EYE_ROW = 27, EYES = [32, 33, 35, 36];
  /* Stepped clips. The reference sheets are fifteen drawings each, so these
     play as fifteen held frames rather than as a continuous blend — which is
     also how pixel art is normally animated. */
  const FRAMES = {run: 15, fall: 15};
  const STANCE = .34;   // share of the run cycle a foot spends on the ground
  const FALL_SPAN = .9; // seconds the fall takes end to end
  /* One column per reference drawing. FALL_PITCH is the measured hip-to-chest
     angle of each `Dead` frame in radians; FALL_WAIST is how much of it the
     waist supplies rather than the whole body turning. The rest are the limb
     angles read off the same drawings. Angles are radians, positive clockwise:
     a positive arm or leg angle swings that limb backwards. */
  const FALL_PITCH = [.175, .471, .611, .768, .925, .977, 1.100, 1.222, 1.309, 1.379, 1.449, 1.475, 1.414, 1.414, 1.414];
  const FALL_WAIST = [1, .95, .85, .70, .50, .35, .25, .18, .12, .08, .06, .05, .05, .05, .05];
  const FALL_LOOK  = [.03, -.16, -.27, -.38, -.44, -.45, -.48, -.48, -.47, -.46, -.44, -.40, -.33, -.30, -.30];
  const FALL_SHIFT = [0, -.1, -.2, -.4, -.7, -1.1, -1.5, -1.9, -2.2, -2.4, -2.4, -2.2, -2.1, -2.0, -2.0];
  const FALL_DROP  = [0, 0, .1, .4, 1.2, 2.8, 5.0, 8.0, 11.2, 14.4, 17.2, 18.8, 19.4, 19.8, 19.8];
  /* Limbs are given as world angles — where the bone actually points on screen,
     zero being straight down — and turned into joint angles by subtracting
     whatever the body is doing. A limb described relative to a torso that is
     itself swinging through eighty degrees is impossible to read or correct. */
  const FALL_THIGH = [0, .05, .12, .28, .55, .80, 1.05, 1.25, 1.38, 1.44, 1.48, 1.50, 1.48, 1.47, 1.47];
  const FALL_KNEE  = [0, .04, .10, .22, .42, .62, .80, .92, .96, .90, .76, .62, .52, .48, .46];
  const FALL_FOOT  = [0, 0, 0, -.08, -.22, -.32, -.40, -.45, -.45, -.38, -.30, -.24, -.20, -.18, -.18];
  const FALL_ARM   = [-.05, -.15, -.25, -.35, -.42, -.45, -.40, -.28, -.10, .35, .85, 1.10, 1.20, 1.24, 1.25];
  const FALL_ELBOW = [-.35, -.45, -.55, -.65, -.72, -.75, -.70, -.55, -.30, .05, .30, .32, .28, .22, .18];
  const FALL_WRIST = [-.10, -.10, -.10, -.12, -.14, -.16, -.16, -.14, -.10, -.05, 0, .05, .08, .10, .10];

  class Skeleton2D {
    constructor(asset) {
      this.asset = asset;
      this.width = asset.width;
      this.height = asset.height;
      this.baseline = asset.baseline;
      this.bones = new Map(asset.bones.map(b => [b.name, { ...b }]));
      this.layers = asset.bones.filter(b => b.image).sort((a, b) => a.z - b.z);
      this.outfits = asset.outfits || [];
      this.pixels = new Map();
      /* The live colour table. `asset.rgba` stays as drawn; this is what the
         layers are actually expanded with, so dyeing is a matter of changing a
         few entries and expanding again rather than of touching the art. */
      this.colors = asset.rgba.map(([r, g, b, a]) => (r | g << 8 | b << 16 | a << 24) >>> 0);
      this.ramps = asset.ramps || {};
      this.eyes = asset.eyes || null;
      this.dye = {};
      this.blink = 0; this.gaze = 1;
      this.expand();
      this.pose = {};
      this.rootOffset = [0, 0]; this.frame = null;
      /* Per-screen-row sampling offsets, two floats per row, keyed by the name a
         layer carries in its `sway` field. A row is displaced as a whole, so it
         samples one translated copy of a row of the source: no pixel can be
         dropped and no gap can open inside the shape. Neighbouring rows are kept
         within a pixel of each other by the solver, so the silhouette stays
         connected too. */
      this.sway = new Map();
      this.pins = new Map();
      /* Whole-pixel offsets, keyed by the channel a layer names in its `drift`
         field. Breathing, weight, lag and cloth all push layers around through
         these. They are integers on purpose: a bitmap cannot be moved half a
         pixel, so anything fractional would only ever show up as a pop at an
         arbitrary moment instead of as motion. */
      this.drift = new Map();
      for (const name of new Set(asset.bones.concat(asset.outfits || []).map(b => b.drift).filter(Boolean))) {
        this.drift.set(name, [0, 0]);
      }
      for (const name of Object.keys(asset.sway || {})) this.sway.set(name, new Float64Array(this.height * 2));
      this.world = new Map();
      this.resolve();
    }

    // Expand every layer's run-length art with the current colour table.
    expand() {
      for (const b of [...this.layers, ...this.outfits]) {
        const data = new Uint32Array(this.width * this.height);
        for (let i = 0; i < b.runs.length; i += 3)
          data.fill(this.colors[b.runs[i + 2]], b.runs[i], b.runs[i + 1] + b.runs[i]);
        this.pixels.set(b.name, data);
      }
      return this.buildFaces();
    }

    /* Face variants, built in the head's native coordinates; the drawn art is
       never touched. Two eyelid stages for the blink, and a version with both
       irises moved to the outer pixel of their socket so she can look the other
       way. One pixel each — that is the whole eye, which is also why an eye is
       coloured a pixel at a time rather than through a ramp. */
    buildFaces() {
      this.blink = this.blink || 0; this.gaze = this.gaze === undefined ? 1 : this.gaze;
      const head = this.pixels.get('head');
      const row = (this.eyes ? this.eyes.row : EYE_ROW) * this.width;
      const sockets = this.eyes ? this.eyes.sockets : [[EYES[0], EYES[1]], [EYES[2], EYES[3]]];
      const iris = this.eyes ? this.colors[slot(this.eyes.iris)] : 0;
      // Each socket is a white and an iris. Which pixel holds the iris is read
      // off the art, so the colour follows it when the gaze swaps them over.
      sockets.forEach((pair, i) => {
        const chosen = this.dye[i ? 'eyeRight' : 'eyeLeft'];
        if (!chosen) return;
        const at = head[row + pair[1]] === iris ? pair[1] : pair[0];
        head[row + at] = pack(unpack(chosen));
      });
      const face = () => new Uint32Array(head);
      this.eyelids = [face(), face()];
      const skin = this.colors[this.asset.palette.indexOf('#af7268') + 1];
      const lid = this.colors[this.asset.palette.indexOf('#84433c') + 1];
      for (const pair of sockets) for (const x of pair) {
        this.eyelids[0][row + x] = skin;
        this.eyelids[1][row + x] = lid;
      }
      const looking = face();
      for (const [a, b] of sockets) {
        const keep = looking[row + a]; looking[row + a] = looking[row + b]; looking[row + b] = keep;
      }
      this.faces = { 1: head, '-1': looking };
      return this;
    }

    /* Dye. `choice` names a ramp — hair, top, bottom, boots, cloak, wraps — or
       one of the two eyes, and gives the colour it should take. Anything left
       out goes back to the colour it was drawn with, so this is the whole
       state, not a patch on top of the last call. */
    restyle(choice = {}) {
      this.dye = { ...choice };
      this.colors = this.asset.rgba.map(([r, g, b, a]) => (r | g << 8 | b << 16 | a << 24) >>> 0);
      for (const [name, ramp] of Object.entries(this.ramps)) {
        const hex = choice[name];
        if (!hex) continue;
        const [br, bg, bb] = this.asset.rgba[slot(ramp.base)];
        const base = toHsl(br, bg, bb), want = toHsl(...unpack(hex));
        const turn = want[0] - base[0];
        // Saturation moves by ratio and lightness by offset: a ramp dyed a pale
        // colour should go pale all through, not lose its shading to a clamp.
        const grade = base[1] > .02 ? want[1] / base[1] : 0;
        const lift = want[2] - base[2];
        for (const tone of ramp.tones) {
          const [r, g, b] = this.asset.rgba[slot(tone)], [h, sat, l] = toHsl(r, g, b);
          this.colors[slot(tone)] = pack(toRgb(h + turn,
            Math.max(0, Math.min(1, base[1] > .02 ? sat * grade : want[1])),
            Math.max(0, Math.min(1, l + lift))));
        }
      }
      this.expand();
      return this;
    }

    resolve() {
      this.world.clear();
      const visit = name => {
        if (this.world.has(name)) return this.world.get(name);
        const b = this.bones.get(name);
        let x, y, angle = this.pose[name] || 0;
        if (!b.parent) {
          x = b.pivot[0] + this.rootOffset[0]; y = b.pivot[1] + this.rootOffset[1];
        } else {
          const p = visit(b.parent), bind = this.bones.get(b.parent).pivot;
          const dx = b.pivot[0] - bind[0], dy = b.pivot[1] - bind[1];
          x = p.x + p.c * dx - p.s * dy; y = p.y + p.s * dx + p.c * dy;
          angle += p.angle;
        }
        const w = { x, y, angle, c: Math.cos(angle), s: Math.sin(angle) };
        this.world.set(name, w);
        return w;
      };
      for (const name of this.bones.keys()) visit(name);
      return this.world;
    }

    /* The anchor's transform with its horizontal position pinned to a whole
       pixel. Vertical stays continuous, so the walk's bob still reads.

       Rounding alone is not enough. Walking puts the head at x 32.50, sitting
       exactly on a rounding boundary, and a third of a pixel of breathing is
       then enough to throw it a whole pixel back and forth every few frames.
       So the pin is sticky: it only moves once the true position has clearly
       left the pixel being held. Real movement still shows; a value parked on
       the boundary stays where it is. */
    anchored(bone) {
      const w = this.world.get(bone.name);
      if (this.physical) return w;
      /* Rotation below UNIT_SNAP is dropped. Animation tilts the head by at most
         two and a half degrees, which cannot turn a bitmap — all it does is take
         a pixel off the end of one row and not the next, which breaks a two
         pixel strand into a dotted diagonal. Past the threshold the tilt is
         worth a pixel and the unit really does rotate, so the inspector still
         works. */
      const angle = Math.abs(w.angle) < UNIT_SNAP ? 0 : w.angle;
      const want = w.x - bone.pivot[0];
      let held = this.pins.get(bone.name);
      if (held === undefined) held = Math.round(want);
      else if (want - held > .75) held = Math.round(want);
      else if (held - want > .75) held = Math.round(want);
      this.pins.set(bone.name, held);
      return {x: bone.pivot[0] + held, y: w.y, angle, c: Math.cos(angle), s: Math.sin(angle)};
    }

    // Forget where the pins are being held: a scrubbed frame must not depend on
    // which frame happened to be on screen before it.
    repin() { this.pins.clear(); return this; }

    // Analytic two-bone IK: hip -> knee -> ankle, knee bends toward facing.
    solveLeg(side, target) {
      const thigh = this.bones.get(`thigh_${side}`), shin = this.bones.get(`shin_${side}`);
      const foot = this.bones.get(`foot_${side}`), hip = this.world.get(thigh.name);
      const l1 = Math.hypot(shin.pivot[0] - thigh.pivot[0], shin.pivot[1] - thigh.pivot[1]);
      const l2 = Math.hypot(foot.pivot[0] - shin.pivot[0], foot.pivot[1] - shin.pivot[1]);
      const dx = target[0] - hip.x, dy = target[1] - hip.y;
      const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + .001, l1 + l2 - .001);
      const theta = Math.atan2(dy, dx);
      const a1 = theta - Math.acos(clamp((l1*l1 + d*d - l2*l2)/(2*l1*d), -1, 1));
      const a2 = theta + Math.acos(clamp((l2*l2 + d*d - l1*l1)/(2*l2*d), -1, 1));
      const bind1 = Math.atan2(shin.pivot[1] - thigh.pivot[1], shin.pivot[0] - thigh.pivot[0]);
      const bind2 = Math.atan2(foot.pivot[1] - shin.pivot[1], foot.pivot[0] - shin.pivot[0]);
      const parentAngle = this.world.get(thigh.parent).angle;
      this.pose[thigh.name] = a1 - bind1 - parentAngle;
      this.pose[shin.name] = a2 - bind2 - (a1 - bind1);
      this.pose[foot.name] = -(a2 - bind2); // Soles stay parallel to ground.
      this.resolve();
    }

    setAnimation(mode, time, amount = 1) {
      this.pose = {}; this.rootOffset = [0, 0]; this.frame = null;
      const p = this.pose;
      if (mode === 'idle') {
        p.arm_near = Math.sin(time * 1.4 + .3) * .012;
        p.forearm_near = .016 * Math.sin(time * 1.4 - .5);
      } else if (mode === 'walk') {
        const phase = (time * 1.25) % 1, swing = Math.sin(phase * TAU);
        const halfPhase=(phase*2)%1;
        const downUp=(1-Math.cos(halfPhase*TAU))*.5;
        this.rootOffset = [0, .65 + downUp * .45];
        p.torso = -.035 + Math.sin(phase * TAU) * .012;
        p.head = .03 - Math.sin(phase * TAU) * .01;
        p.hair_back = .02 + Math.sin(phase * TAU - .6) * .025;
        p.arm_near = swing * .26; p.arm_far = -swing * .24;
        p.forearm_near = -.10 - Math.max(0, -swing) * .17;
        p.forearm_far = -.10 - Math.max(0, swing) * .17;
        p.hand_near = -.06 * swing;
        p.hand_far = .05 * swing;
        p.neck = .01;
        this.resolve();
        for (const [side, offset] of [['near', 0], ['far', .5]]) {
          const foot = this.bones.get(`foot_${side}`);
          const rest = this.bones.get(`thigh_${side}`).pivot[0]+1;
          const sole = foot.bounds[3] - 1;
          const cycle = (phase + offset) % 1;
          // First half planted, moving backward at a constant ground speed.
          const t = (cycle - .5) * 2;
          const eased = t*t*(3-2*t);
          const x = cycle < .5 ? rest + 5 - 20 * cycle : rest - 5 + eased * 10;
          const lift = cycle < .5 ? 0 : Math.sin(t * Math.PI) ** 2 * 3.5;
          this.solveLeg(side, [x, foot.pivot[1] + this.baseline - sole - lift]);
        }
      } else if (mode === 'run') {
        /* Fifteen stepped frames, read off `png/Run (1..15).png`. A run is not a
           fast walk: the stance is short, both feet leave the ground between
           steps, the body leans into it and the arms are folded and swing hard
           against the legs. */
        // The phase offset lines the widest stride up with frames 4-5 of the
        // sheet, which is where the reference reaches its split.
        const raw = ((time * 1.9 - .17) % 1 + 1) % 1;
        const phase = Math.floor(raw * FRAMES.run) / FRAMES.run;
        this.frame = Math.round(phase * FRAMES.run) % FRAMES.run;
        const swing = Math.sin(phase * TAU);
        // Lowest at contact, highest through the flight between steps.
        const bounce = Math.cos(((phase * 2) % 1) * TAU);
        this.rootOffset = [0, .2 + (1 - bounce) * .8];
        p.torso = -.13 + swing * .02;          // leaning into the run
        p.abdomen = -.05;
        p.neck = .05; p.head = .08 - swing * .012;
        /* The elbow closes to about ninety degrees and stays closed, and the
           hands stay inside the width of the chest, as they do in every drawing
           of the sheet. Opening the elbow is what turns a run into a zombie
           walk; swinging the whole arm wide turns it into a march. */
        p.arm_near = swing * .34; p.forearm_near = -1.35 + swing * .46;
        p.arm_far = -swing * .34; p.forearm_far = -1.35 - swing * .46;
        p.hand_near = -.18; p.hand_far = -.18;
        this.resolve();
        for (const [side, offset] of [['near', 0], ['far', .5]]) {
          const foot = this.bones.get(`foot_${side}`);
          const rest = this.bones.get(`thigh_${side}`).pivot[0] + 1;
          const sole = foot.bounds[3] - 1;
          const cycle = (phase + offset) % 1;
          // Stance is barely a third of the cycle, which is what leaves the gap
          // where neither foot is down.
          let x, lift;
          if (cycle < STANCE) {
            const t = cycle / STANCE;
            x = rest + 8.5 - 17 * t; lift = 0;
          } else {
            const t = (cycle - STANCE) / (1 - STANCE);
            const eased = t * t * (3 - 2 * t);
            x = rest - 8.5 + 17 * eased;
            lift = Math.sin(t * Math.PI) ** .8 * 5.8;
          }
          this.solveLeg(side, [x, foot.pivot[1] + this.baseline - sole - lift]);
        }
      } else if (mode === 'fall') {
        /* Fifteen held frames traced off `png/Dead (1..15).png`. The reference
           is a table of drawings, so this is a table too: a formula would have
           to be bent out of shape to hit fifteen specific poses, and a table
           can be corrected one frame at a time without disturbing the rest.

           FALL_PITCH is measured, not invented — it is the angle of the line
           from the hips to the chest in each reference drawing, which runs 10
           degrees at the first frame to 85 at the last. Everything else is read
           off the drawings by eye. */
        const f = Math.min(FRAMES.fall - 1, Math.max(0, Math.floor(time / FALL_SPAN * FRAMES.fall)));
        // Which of the fifteen drawings is on screen. The motion layer reads it
        // to measure the body's real speed from drawing to drawing, which a
        // derivative of the held pose cannot give it.
        this.frame = f;
        const at = row => row[f];
        /* The pitch is shared between turning at the waist and turning the
           whole body. Early the feet are still down, so the character folds
           over them; once the feet leave the ground the root takes the turn and
           the waist straightens, which is what puts the legs out behind. */
        const pitch = at(FALL_PITCH), waist = pitch * at(FALL_WAIST);
        this.pose.root = pitch - waist;
        p.abdomen = waist * .4; p.torso = waist * .6;
        this.rootOffset = [at(FALL_SHIFT), at(FALL_DROP)];
        // The head keeps looking ahead instead of turning with the chest, so
        // the face stays readable all the way down.
        const lift = at(FALL_LOOK);
        p.neck = lift * .55; p.head = lift * .45;
        for (const [side, spread, bias] of [['near', 1, 0], ['far', -1, 1]]) {
          /* The far side trails a frame behind and folds less. Two legs doing
             exactly the same thing at the same moment read as one leg. */
          const g = Math.max(0, f - bias);
          const body = FALL_PITCH[g], turn = body * (1 - FALL_WAIST[g]);
          const fold = side === 'far' ? .78 : 1;
          /* Rotating the body turns the gap between the two shoulders into a
             difference in height: by the time the chest is down the far
             shoulder is five pixels lower than the near one, and its arm has
             nowhere left to hang. So it lies flat along the ground instead,
             which is also where an arm ends up when a body lands on it. */
          const trapped = side === 'far' ? Math.sin(body) * .9 : 0;
          const armW = mix(FALL_ARM[g] + spread * .08, 1.55, trapped);
          const elbowW = mix(FALL_ELBOW[g], 1.65, trapped);
          p[`thigh_${side}`] = FALL_THIGH[g] + spread * .06 - turn;
          p[`shin_${side}`] = FALL_KNEE[g] * fold;
          p[`foot_${side}`] = FALL_FOOT[g] * fold;
          // Arms hang off the chest, so the chest's own turn comes out of them.
          p[`arm_${side}`] = armW - body;
          p[`forearm_${side}`] = elbowW - armW;
          p[`hand_${side}`] = FALL_WRIST[g];
        }
        this.resolve();
        /* A foot still carrying weight stays exactly where it was put. Folding
           forward swings the hips down and round, and a leg left to follow them
           drives its foot through the floor — the first thing that reads as
           wrong in a fall. The near foot leaves the ground at the fourth
           drawing and the far one at the sixth, as in the reference. */
        for (const [side, until] of [['near', 3], ['far', 5]]) {
          if (f >= until) continue;
          const foot = this.bones.get(`foot_${side}`);
          const sole = foot.bounds[3] - 1;
          this.solveLeg(side, [foot.pivot[0], foot.pivot[1] + this.baseline - sole]);
        }
      } else if (mode === 'jump') {
        const fold = clamp(amount, 0, 1);
        p.torso = -.025 - fold * .045; p.head = .04; p.hair_back = -.035;
        p.arm_near = -.20 - fold*.35; p.forearm_near = -.18 - fold*.35;
        p.arm_far = .12 + fold*.30; p.forearm_far = -.15 - fold*.25;
        p.thigh_near = -.28 * fold; p.shin_near = .7 * fold; p.foot_near = -.25 * fold;
        p.thigh_far = .24 * fold; p.shin_far = .38 * fold; p.foot_far = -.2 * fold;
      }
      this.resolve();
      return this;
    }

    // Inverse point sampling directly into a 64x96 RGBA raster, one native pixel
    // per destination cell. This avoids Canvas2D's antialiased rotated edges.
    rasterize({ facing = 1, hidden = new Set(), exploded = 0, outfit = new Set(), viewport = null, wounds = null, xray = false, organs = null } = {}) {
      const {width, height, x: viewX, y: viewY} = viewport || {width:this.width,height:this.height,x:0,y:0};
      const target = new Uint32Array(width * height);
      // Scratch for a layer that is being turned, so its own holes can be found
      // before it is composited over anything else.
      if (!this.scratch || this.scratch.length !== target.length) this.scratch = new Uint32Array(target.length);
      /* A garment inherits its bone's transform but may override the drift
         channel, which is how cloth trails the body it hangs on. Where it is
         drawn is its own business: a garment with a `z` takes its place in the
         same order as the body parts, so a cloak can go over every layer rather
         than only over the one bone it hangs from. Without one it falls in
         directly behind its bone, which is where every other garment belongs.

         A garment may also declare what it `covers` — long hair goes inside a
         hood, not out over the top of it. */
      const worn = this.outfits.filter(o => outfit.has(o.slot));
      const veiled = new Set(hidden);
      for (const o of worn) for (const name of o.covers || []) veiled.add(name);
      const ordered = this.layers.map((b, i) => ({ layer: b, z: b.z, seq: i }));
      for (const o of worn) {
        const base = this.bones.get(o.bone);
        ordered.push({ layer: { ...base, ...o, bone: o.bone },
                       z: o.z === undefined ? base.z + .5 : o.z, seq: ordered.length });
      }
      ordered.sort((a, b) => a.z - b.z || a.seq - b.seq);
      const renderLayers = ordered.map(e => e.layer);
      for (const b of renderLayers) {
        const boneName=b.bone || b.name;
        const injury=!b.bone && wounds?wounds.get(boneName):null;
        if (veiled.has(boneName) || veiled.has(b.name)) continue;
        const sway = b.sway ? this.sway.get(b.sway) : null;
        /* Layers that carry an `anchor` are one rigid unit — the head and the
           two hair layers. They all sample through the anchor's own transform
           and pivot, which is the same picture for each of them and makes it
           impossible for one to slip a pixel against another. Horizontally the
           unit is pinned to whole pixels: a head that drifts a third of a pixel
           cannot be drawn, it can only pop a whole pixel back and forth. */
        const anchor = b.anchor ? this.bones.get(b.anchor) : null;
        const localMirror=(boneName==='head'||anchor?.name==='head')?(this.headMirror||1):1;
        const w = anchor ? this.anchored(anchor) : this.world.get(boneName);
        const shift = b.drift ? this.drift.get(b.drift) : null;
        const driftX = shift ? shift[0] : 0, driftY = shift ? shift[1] : 0;
        const src = b.name !== 'head' ? this.pixels.get(b.name)
          : this.blink > 0 ? this.eyelids[this.blink >= .75 ? 1 : 0]
          : this.faces[this.gaze < 0 ? '-1' : 1];
        const px = anchor ? anchor.pivot[0] : b.pivot[0], py = anchor ? anchor.pivot[1] : b.pivot[1];
        // Below UNIT_SNAP the layer is not turned at all, so it is sampled the
        // way it always was: one point per cell, the art unchanged pixel for
        // pixel. The area sampling below exists only for real rotation.
        const turned = w.angle !== 0;
        const out = turned ? this.scratch : target;
        if (turned) out.fill(0);
        const ox = exploded * (px - 34), oy = exploded * (py - 48);
        let minX=0,minY=0,maxX=width,maxY=height;
        // A free body can leave the original sprite tile. Rasterize only its
        // transformed bounds instead of sampling the entire enlarged viewport.
        if(this.physical && b.bounds) {
          const [l,t,r,bottom]=b.bounds;
          const corners=[[l,t],[r,t],[l,bottom],[r,bottom]].map(([x,y])=>({
            x:w.x+w.c*(x-px)*localMirror-w.s*(y-py)+ox+driftX-viewX,
            y:w.y+w.s*(x-px)*localMirror+w.c*(y-py)+oy+driftY-viewY}));
          minX=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x)))-2);
          minY=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y)))-2);
          maxX=Math.min(width,Math.ceil(Math.max(...corners.map(p=>p.x)))+2);
          maxY=Math.min(height,Math.ceil(Math.max(...corners.map(p=>p.y)))+2);
        }
        /* The sway curve is written in the art's own rows. Look it up by the
           row of the source being sampled, not by the row on screen: the moment
           the body bobs or breathes, those differ, and reading the curve at the
           wrong row slides the bend along the hair and dithers its edge. */
        for (let y = minY; y < maxY; y++) {
        const row = sway ? Math.min(this.height - 1, Math.max(0, Math.floor(y + viewY + .5 - w.y + py - driftY))) : 0;
        const swayX = sway ? sway[row * 2] : 0, swayY = sway ? sway[row * 2 + 1] : 0;
        for (let x = minX; x < maxX; x++) {
          const dx = x + viewX + .5 - w.x - ox - swayX - driftX, dy = y + viewY + .5 - w.y - oy - swayY - driftY;
          let color = 0;
          if (!turned) {
            const sx = Math.floor((w.c * dx + w.s * dy)*localMirror + px + 1e-8);
            const sy = Math.floor(-w.s * dx + w.c * dy + py + 1e-8);
            if (sx < 0 || sy < 0 || sx >= this.width || sy >= this.height) continue;
            color = src[sy * this.width + sx];
          } else {
            /* Turned far enough to matter, so the cell is sampled by the area it
               covers rather than by its centre alone: the centre first, then its
               four quarters, nearest hit wins. One point per cell is what breaks
               a two pixel strand into specks and closes a one pixel gap on one
               row and not the next — the same artefact seen from both sides.
               An area that overlaps the cluster keeps the cell either way. */
            for (let k = 0; k < AREA.length; k += 2) {
              const ax = dx + AREA[k], ay = dy + AREA[k + 1];
              const sx = Math.floor((w.c * ax + w.s * ay)*localMirror + px + 1e-8);
              const sy = Math.floor(-w.s * ax + w.c * ay + py + 1e-8);
              if (sx < 0 || sy < 0 || sx >= this.width || sy >= this.height) continue;
              const hit = src[sy * this.width + sx];
              if (hit >>> 24) { color = hit; break; }
            }
          }
          if (color >>> 24) {
            if(boneName==='head' && wounds && this.eyes) {
              const sx=Math.floor((w.c*dx+w.s*dy)*localMirror+px),sy=Math.floor(-w.s*dx+w.c*dy+py);
              for(let eye=0;eye<2;eye++) {
                const injury=wounds.get(eye?'eye_right':'eye_left');
                if(injury?.hp<100 && sy===this.eyes.row && this.eyes.sockets[eye].includes(sx))color=injury.hp===0?0xff39343d:0xff46409f;
              }
            }
            if(injury && (injury.bruise>0 || injury.cut>0)) {
              const lx=(w.c*dx+w.s*dy)*localMirror+px-(b.pivot[0]+b.end[0])*.5;
              const ly=-w.s*dx+w.c*dy+py-(b.pivot[1]+b.end[1])*.5;
              if(injury.bruise>0 && lx*lx/10+ly*ly/6<1) {
                const a=Math.min(.72,.25+injury.bruise*.006);
                const r=Math.round((color&255)*(1-a)+93*a),g=Math.round((color>>>8&255)*(1-a)+48*a),blue=Math.round((color>>>16&255)*(1-a)+105*a);
                color=(255<<24)|(blue<<16)|(g<<8)|r;
              }
              if(injury.cut>0 && Math.abs(lx)<3 && Math.abs(ly-lx*.4)<.7)color=0xff31309e;
            }
            if(injury?.necrosis>0){
              const amount=Math.min(1,injury.necrosis/100);
              const r=color&255,g=color>>>8&255,blue=color>>>16&255;
              const gray=25+(.2126*r+.7152*g+.0722*blue)*.15;
              color=(255<<24)|(Math.round(blue+(gray-blue)*amount)<<16)|(Math.round(g+(gray-g)*amount)<<8)|Math.round(r+(gray-r)*amount);
            }
            if(injury?.bandaged && injury.cut>0){
              const ly=-w.s*dx+w.c*dy+py-(b.pivot[1]+b.end[1])*.5;
              if(Math.abs(ly)<1.5)color=0xffb8cbd6;
            }
            if(typeof scope.anatomyColor==='function' && !b.bone && (xray||organs||injury?.splinted||injury?.severedRoot||injury?.stumps?.length)) {
              const sx=Math.floor((w.c*dx+w.s*dy)*localMirror+px),sy=Math.floor(-w.s*dx+w.c*dy+py);
              color=scope.anatomyColor(this,b,sx,sy,color,injury,xray,organs);
            }
            out[y * width + (facing < 0 ? width - 1 - x : x)] = color;
          }
        }
        }
        if (turned) {
          /* A cell the turn left empty between four of its own neighbours is an
             artefact of rotating a bitmap and nothing the artist drew — the
             source art has no enclosed pixel anywhere, and this is checked at
             build time. Found per layer, before compositing, so a real gap
             between two different parts is never touched. */
          const fill = [];
          for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            if (out[i] >>> 24) continue;
            const l = out[i - 1], r = out[i + 1], u = out[i - width], d = out[i + width];
            if (l >>> 24 && r >>> 24 && u >>> 24 && d >>> 24) fill.push(i, l);
          }
          for (let i = 0; i < fill.length; i += 2) out[fill[i]] = fill[i + 1];
          for (let i = 0; i < out.length; i++) if (out[i] >>> 24) target[i] = out[i];
        }
      }
      return new Uint8ClampedArray(target.buffer);
    }

    // Useful to inspect clipping independently from the raster output.
    transformedBounds() {
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (const b of this.layers) {
        const src = this.pixels.get(b.name);
        const sway = b.sway ? this.sway.get(b.sway) : null;
        const w = b.anchor ? this.anchored(this.bones.get(b.anchor)) : this.world.get(b.name);
        const shift = b.drift ? this.drift.get(b.drift) : [0, 0];
        let reach = 0;
        if (sway) for (let i = 0; i < sway.length; i += 2) reach = Math.max(reach, Math.hypot(sway[i], sway[i + 1]));
        for (let i = 0; i < src.length; i++) if (src[i] >>> 24) {
          const pivot = b.anchor ? this.bones.get(b.anchor).pivot : b.pivot;
          const localMirror=(b.name==='head'||b.anchor==='head')?(this.headMirror||1):1;
          const dx = (i % this.width + .5 - pivot[0])*localMirror, dy = Math.floor(i / this.width) + .5 - pivot[1];
          const x = w.x + w.c * dx - w.s * dy + shift[0], y = w.y + w.s * dx + w.c * dy + shift[1];
          if (reach) { left = Math.min(left, x - reach); right = Math.max(right, x + reach);
                       top = Math.min(top, y - reach); bottom = Math.max(bottom, y + reach); }
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      return [left, top, right, bottom];
    }
  }
  scope.Skeleton2D = Skeleton2D;
  if (typeof module !== 'undefined') module.exports = { Skeleton2D, clamp, mix };
})(globalThis);
