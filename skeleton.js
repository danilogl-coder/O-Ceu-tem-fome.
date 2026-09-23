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
  /* How far the far leg comes down onto the floor once she has stopped moving.
     In the reference the far leg is still up in the air on the last drawings,
     which is fine for a body that has just hit the ground and wrong for one
     that is lying on it: nothing holds a leg up while you lie face down. So
     over the last four drawings the far leg lowers until it lies along the
     near one, a little further back so its foot still shows behind. */
  const FALL_SETTLE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, .2, .55, .85, 1];

  /* What the joints can do, in radians, as the local angle of the child
     against its parent. Positive is clockwise, and every limb is drawn hanging
     down with the character facing right, so for a limb a positive angle
     swings it backwards; for the spine and the head, which point up, positive
     tips them forwards. Nothing the animation, the gestures, the pain layer or
     the inspector asks for gets past these: an elbow that bends the wrong way
     or a hip folded backwards is the first thing that reads as a puppet. */
  const JOINT_LIMITS = {
    arm_near: [-3.0, 1.0], arm_far: [-3.0, 1.0],            // shoulder: 172° forward, 57° back
    forearm_near: [-2.5, .1], forearm_far: [-2.5, .1],      // elbow: 143° flexion, 6° past straight
    hand_near: [-1.2, 1.2], hand_far: [-1.2, 1.2],          // wrist
    thigh_near: [-2.1, .5], thigh_far: [-2.1, .5],          // hip: 120° forward, 29° back
    shin_near: [-.08, 2.5], shin_far: [-.08, 2.5],          // knee: 143° flexion, 5° past straight
    foot_near: [-.45, .9], foot_far: [-.45, .9],            // ankle: 26° up, 52° down
    neck: [-.55, .55], head: [-.55, .55],                   // together about 60° either way
    abdomen: [-.3, .5], torso: [-.35, .55],                 // spine: bends further forward than back
    pelvis: [-.35, .35],
  };
  /* Feet. Where the sole and the toe sit against the ankle pivot: a heel-off
     turns the foot about the toe, and the ankle has to travel with it. */
  const FOOT_TOE = 5, FOOT_SOLE = 3;
  const smooth = t => t * t * (3 - 2 * t);

  /* Keyframes of the get-up from lying face down: push the chest up on the
     hands, bring the near knee under, kneel on it with the far foot planted,
     push up to standing. Body angles as in the rest of the file; `drop` is how
     far the hips sit below their standing height, `shift` how far back. The
     legs are given as world angles (`near`, `far`: thigh, shin, foot) so the
     floor is where it should be whatever the body is doing, and the contacts
     are held by IK on top: `hands` keeps the hands flat on the floor, `plant`
     the far foot on it ahead of her, `feet` both feet where she will stand. */
  const GETUP = [
    {t: 0,    root: 1.32, abdomen: .05, torso: .06, neck: -.28, head: -.22, drop: 19.6, shift: -2.0,
     near: [1.15, 1.7, .15], far: [1.45, 1.8, .15],
     arm_near: -.20, forearm_near: -1.05, hand_near: .10, arm_far: .10, forearm_far: -.40, hand_far: .05, hands: 0},
    // Push: hands under the shoulders, chest up, legs still down.
    {t: .32,  root: .95, abdomen: .10, torso: .08, neck: -.34, head: -.24, drop: 17.2, shift: -1.4,
     near: [1.1, 1.7, .15], far: [1.4, 1.8, .15],
     arm_near: -1.55, forearm_near: -.55, hand_near: .35, arm_far: -1.35, forearm_far: -.35, hand_far: .30, hands: 1},
    // Knees under: both knees on the floor, shins folded up behind, on all fours.
    {t: .58,  root: 1.15, abdomen: .10, torso: .10, neck: -.36, head: -.26, drop: 12.5, shift: -1.0,
     near: [.45, 1.75, .2], far: [.55, 1.8, .2],
     arm_near: -1.3, forearm_near: -.4, hand_near: .3, arm_far: -1.25, forearm_far: -.3, hand_far: .3, hands: 1},
    // The far foot comes down onto the floor behind her, knee low, the near
    // knee still down. Frames that name where a foot stands are solved for
    // that contact when the clip is first used.
    {t: .72,  root: .9, abdomen: .13, torso: .12, neck: -.32, head: -.2, drop: 11.0, shift: -.8,
     near: [.45, 1.75, .2], farAt: 19,
     arm_near: -1.2, forearm_near: -.45, hand_near: .25, arm_far: -1.15, forearm_far: -.35, hand_far: .2, hands: 1},
    // Feet under: the hips lift and both feet come under her, hands still on
    // the floor — a deep squat.
    {t: .92,  root: .45, abdomen: .16, torso: .14, neck: -.24, head: -.12, drop: 9.0, shift: -.6,
     nearAt: 28, farAt: 37,
     arm_near: -1.05, forearm_near: -.5, hand_near: .2, arm_far: -1.0, forearm_far: -.4, hand_far: .1, hands: 1},
    // Crouch: hands off the floor, chest coming up.
    {t: 1.2, root: .08, abdomen: .16, torso: .2, neck: -.08, head: -.02, drop: 6.0, shift: -.3,
     nearAt: 28, farAt: 36,
     arm_near: -.55, forearm_near: -.55, hand_near: 0, arm_far: -.35, forearm_far: -.45, hand_far: 0, hands: 0},
    {t: 1.50, root: 0, abdomen: .02, torso: .03, neck: 0, head: 0, drop: 0, shift: 0,
     nearAt: 27, farAt: 35,
     arm_near: -.05, forearm_near: -.15, hand_near: 0, arm_far: .02, forearm_far: -.12, hand_far: 0, hands: 0},
  ];
  const GETUP_SPAN = GETUP[GETUP.length - 1].t;

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
      this.raise = null;   // bone name -> z lift, while a gesture needs a limb drawn in front
      /* Whole-pixel offsets, keyed by the channel a body part names in its
         `drift` field. Breathing and the body's inertia push the parts around
         through these. They are integers on purpose: a bitmap cannot be moved
         half a pixel, so anything fractional would only ever show up as a pop
         at an arbitrary moment instead of as motion. Only the body owns
         channels: clothes ride on the channel of the part they are worn on. */
      this.drift = new Map();
      for (const name of new Set(asset.bones.map(b => b.drift).filter(Boolean))) {
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

    /* Analytic two-bone IK for any limb: upper -> lower -> end. `bend` picks
       which way the middle joint folds (+1 is a knee, which points the way she
       faces; -1 is an elbow, which points behind her) and `endAngle` is the
       world angle the end piece should keep, or null to leave it as posed. */
    solveLimb(upperName, lowerName, endName, target, bend = 1, endAngle = null) {
      const upper = this.bones.get(upperName), lower = this.bones.get(lowerName), end = this.bones.get(endName);
      const origin = this.world.get(upperName);
      const l1 = Math.hypot(lower.pivot[0] - upper.pivot[0], lower.pivot[1] - upper.pivot[1]);
      const l2 = Math.hypot(end.pivot[0] - lower.pivot[0], end.pivot[1] - lower.pivot[1]);
      const dx = target[0] - origin.x, dy = target[1] - origin.y;
      const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + .001, l1 + l2 - .001);
      const theta = Math.atan2(dy, dx);
      const a1 = theta - bend * Math.acos(clamp((l1*l1 + d*d - l2*l2)/(2*l1*d), -1, 1));
      const a2 = theta + bend * Math.acos(clamp((l2*l2 + d*d - l1*l1)/(2*l2*d), -1, 1));
      const bind1 = Math.atan2(lower.pivot[1] - upper.pivot[1], lower.pivot[0] - upper.pivot[0]);
      const bind2 = Math.atan2(end.pivot[1] - lower.pivot[1], end.pivot[0] - lower.pivot[0]);
      const parentAngle = this.world.get(upper.parent).angle;
      this.pose[upperName] = a1 - bind1 - parentAngle;
      this.pose[lowerName] = a2 - bind2 - (a1 - bind1);
      if (endAngle !== null) this.pose[endName] = endAngle - (a2 - bind2);
      this.resolve();
    }
    /* hip -> knee -> ankle, knee bending the way she faces. The sole stays
       parallel to the ground unless a foot angle is given: a planted foot is
       flat, but a foot in the air hangs from the ankle, and a foot pushing off
       turns about its toe. Positive tips the toe down. */
    solveLeg(side, target, footAngle = 0) {
      this.solveLimb(`thigh_${side}`, `shin_${side}`, `foot_${side}`, target, 1, footAngle);
    }
    /* Plant a foot flat on the floor at `x`. When the knee is bent so far that
       a flat foot would need more dorsiflexion than an ankle has — a deep
       crouch — the heel comes up and the foot turns about its toe, as it does
       when a person squats, instead of the toe being driven into the floor. */
    plantFoot(side, x) {
      const foot = this.bones.get(`foot_${side}`), sole = foot.bounds[3] - 1;
      const flatY = foot.pivot[1] + this.baseline - sole;
      /* The knee goes forward, as a standing knee does. Only when that would
         fold the hip or the knee past what the joint allows — a foot far
         behind a low hip, as in the get-up — is the other solution taken. */
      const within = () => ['thigh', 'shin'].every(part => {
        const v = this.pose[`${part}_${side}`], [lo, hi] = JOINT_LIMITS[`${part}_${side}`];
        return v >= lo - .02 && v <= hi + .02;
      });
      const solve = (target, angle) => {
        this.solveLimb(`thigh_${side}`, `shin_${side}`, `foot_${side}`, target, 1, angle);
        if (within()) return;
        const forward = {...this.pose};
        this.solveLimb(`thigh_${side}`, `shin_${side}`, `foot_${side}`, target, -1, angle);
        if (!within()) { this.pose = forward; this.resolve(); }
      };
      solve([x, flatY], 0);
      const shinW = this.world.get(`shin_${side}`).angle, limit = JOINT_LIMITS[`foot_${side}`][0];
      if (shinW + limit <= 0) return this;
      const heel = shinW + limit;   // the foot angle the ankle can still hold
      const [ox, oy] = Skeleton2D.toeOff(heel);
      solve([x + ox, flatY + oy], heel);
      return this;
    }
    /* Where the ankle has to go for a foot that stands on its toe at `angle`:
       the offset from the flat ankle position, x forward and y down. */
    static toeOff(angle, about = angle >= 0 ? FOOT_TOE : -2) {
      // Turning about the toe when the toe is down, about the heel when it is
      // up, so whichever end is on the floor stays on it.
      const c = Math.cos(angle), s = Math.sin(angle);
      return [about * (1 - c) + FOOT_SOLE * s, -about * s + FOOT_SOLE * (1 - c)];
    }
    /* Hold every joint inside what a body allows. Applied last, after every
       layer has had its say, so nothing can add its way past a limit. */
    clampPose() {
      for (const [name, [lo, hi]] of Object.entries(JOINT_LIMITS)) {
        if (this.pose[name] === undefined) continue;
        this.pose[name] = clamp(this.pose[name], lo, hi);
      }
      return this;
    }
    static get limits() { return JOINT_LIMITS; }
    static get getup() { return GETUP; }

    /* One foot through a gait cycle. `cycle` runs 0..1 from the moment the
       foot lands; the first `stance` of it is on the ground, sliding back under
       the body at ground speed, the rest is the swing forward. Returns the
       ankle's offset from where it rests flat under the hip (x forward, y up)
       and the world angle the foot should hold. The sole is flat while it
       carries weight, the heel lifts and the foot turns about its toe on the
       way off, it hangs toe-down through the swing and lands heel first. The
       "flat foot floating through the air" was the single most visible thing
       wrong with the old walk and run. */
    static footCycle(cycle, {stance, reach, lift, toeOff, hang, strike, land = .2, sharp = 2}) {
      if (cycle < stance) {
        const t = cycle / stance;
        // Heel strike: toe up a touch, flat within a fifth of the stance.
        const strikeA = strike * Math.max(0, 1 - t / land);
        // Heel-off: the last third of the stance, turning about the toe.
        const push = t > .62 ? smooth((t - .62) / .38) : 0;
        const angle = strikeA + toeOff * push;
        const [ox, oy] = Skeleton2D.toeOff(angle);
        return {x: reach - 2 * reach * t + ox, y: -oy, angle, planted: true};
      }
      const t = (cycle - stance) / (1 - stance), eased = smooth(t);
      /* The ankle starts where the toe-off left it and the foot hangs off the
         shin — the ankle is relaxed, so the toe follows the shin down rather
         than the foot staying level with the floor — then comes up level for
         the strike. `angle` here is the ankle's own bend, not a world angle. */
      const [ox, oy] = Skeleton2D.toeOff(toeOff);
      const residual = Math.pow(1 - t, 3);
      const late = smooth(Math.max(0, t - .65) / .35);
      const angle = mix(hang, strike, late);
      return {x: -reach + 2 * reach * eased + ox * residual,
              y: Math.pow(Math.sin(t * Math.PI), sharp) * lift - oy * residual, angle, planted: false};
    }

    setAnimation(mode, time, amount = 1) {
      this.pose = {}; this.rootOffset = [0, 0]; this.frame = null;
      const p = this.pose;
      /* Both feet are walked around the same line. The reference stands with
         the far foot five pixels ahead of the near one, which is a standing
         pose and not a gait: kept under a walk it made every other step five
         pixels shorter than the one before it, a limp. The depth of the far
         leg still shows, in the angle the leg makes from its own hip. */
      const stride = (side, cycle, shape) => {
        const foot = this.bones.get(`foot_${side}`);
        const rest = 33;
        const sole = foot.bounds[3] - 1;
        const f = Skeleton2D.footCycle(cycle, shape);
        this.solveLeg(side, [rest + f.x, foot.pivot[1] + this.baseline - sole - f.y], f.planted ? f.angle : null);
        // In the air the foot hangs from the ankle: its angle is against the
        // shin, blending back to a level heel-strike as the foot comes down.
        if (!f.planted) {
          const t = (cycle - shape.stance) / (1 - shape.stance), late = smooth(Math.max(0, t - .65) / .35);
          const shinW = this.world.get(`shin_${side}`).angle;
          this.pose[`foot_${side}`] = mix(shape.hang, shape.strike - shinW, late);
          this.resolve();
          // A toe pointing down must not poke through the floor as the foot
          // comes in to land: lift the ankle by however far it would.
          const w = this.world.get(`foot_${side}`);
          const deepest = w.y + Math.max(w.s * FOOT_TOE, 0) + w.c * FOOT_SOLE;
          const floor = this.baseline + .4;
          if (deepest > floor) {
            const angle = w.angle;
            this.solveLeg(side, [rest + f.x, foot.pivot[1] + this.baseline - sole - f.y - (deepest - floor)], null);
            this.pose[`foot_${side}`] = angle - this.world.get(`shin_${side}`).angle;
            this.resolve();
          }
        }
        return f;
      };
      if (mode === 'idle') {
        p.arm_near = Math.sin(time * 1.4 + .3) * .012;
        p.forearm_near = .016 * Math.sin(time * 1.4 - .5);
      } else if (mode === 'walk') {
        const phase = (time * 1.25) % 1;
        // Arms swing against the legs: the near arm is furthest back the
        // moment the near heel lands in front, not a quarter cycle later.
        const swing = Math.cos(phase * TAU);
        /* Lowest when a heel lands — both feet down, legs spread — and
           highest passing over the straight support leg. It was the other way
           round, which sank the hips onto a bent knee at every mid-stance and
           made the walk crouch. */
        const halfPhase=(phase*2)%1;
        const downUp=(1-Math.cos(halfPhase*TAU))*.5;
        this.rootOffset = [0, (1 - downUp) * 1.0];
        // The drawn torso already leans back a little, so a walk leans it
        // forward past upright, as a walking body does.
        p.torso = .09 + Math.sin(phase * TAU) * .012; p.abdomen = .03;
        p.head = -.05 - Math.sin(phase * TAU) * .01;
        p.hair_back = .02 + Math.sin(phase * TAU - .6) * .025;
        p.arm_near = swing * .26; p.arm_far = -swing * .24;
        p.forearm_near = -.10 - Math.max(0, -swing) * .17;
        p.forearm_far = -.10 - Math.max(0, swing) * .17;
        p.hand_near = -.06 * swing;
        p.hand_far = .05 * swing;
        p.neck = -.02;
        this.resolve();
        const shape = {stance: .5, reach: 5, lift: 2.0, toeOff: .5, hang: .25, strike: -.12};
        for (const [side, offset] of [['near', 0], ['far', .5]]) stride(side, (phase + offset) % 1, shape);
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
        // Near arm back when the near foot lands: the arms counter the legs.
        const swing = Math.cos(phase * TAU);
        // Lowest in mid-stance, where the support leg takes the weight, and
        // highest in the flight between steps.
        const halfPhase = (phase * 2) % 1;
        const bounce = Math.cos((halfPhase - STANCE * .5) * TAU);
        this.rootOffset = [0, .2 + (1 + bounce) * .55];
        // Leaning into the run, chin tucked so the face still looks ahead.
        p.torso = .30 + swing * .02; p.abdomen = .08;
        p.neck = -.12; p.head = -.16 - swing * .012;
        /* The elbow closes to about ninety degrees and stays closed, and the
           hands stay inside the width of the chest, as they do in every drawing
           of the sheet. Opening the elbow is what turns a run into a zombie
           walk; swinging the whole arm wide turns it into a march. */
        p.arm_near = swing * .34; p.forearm_near = -1.35 + swing * .46;
        p.arm_far = -swing * .34; p.forearm_far = -1.35 - swing * .46;
        p.hand_near = -.18; p.hand_far = -.18;
        this.resolve();
        // Stance is barely a third of the cycle, which is what leaves the gap
        // where neither foot is down. Runners land on the ball of the foot.
        const shape = {stance: STANCE, reach: 8.5, lift: 5.4, toeOff: .72, hang: .35, strike: .12, land: .35, sharp: .8};
        for (const [side, offset] of [['near', 0], ['far', .5]]) stride(side, (phase + offset) % 1, shape);
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
        const settle = at(FALL_SETTLE);
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
          let thigh = FALL_THIGH[g] + spread * .06 - turn, shin = FALL_KNEE[g] * fold, foot = FALL_FOOT[g] * fold;
          if (settle > 0) {
            /* Down onto the floor. The reference holds both legs up behind
               her, horizontal at hip height, on the last drawings — right for
               the instant of landing, wrong for lying there: nothing holds a
               leg up. So the legs come down and lie along the ground, the far
               one a little further back, as world angles so the floor is
               where it should be whatever the body is doing. */
            const [thighW, shinW, footW] = side === 'near' ? [1.15, 1.7, .15] : [1.45, 1.8, .15];
            thigh = mix(thigh, thighW - this.pose.root, settle);
            shin = mix(shin, shinW - thighW, settle);
            foot = mix(foot, footW - shinW, settle);
          }
          p[`thigh_${side}`] = thigh;
          p[`shin_${side}`] = shin;
          p[`foot_${side}`] = foot;
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
      } else if (mode === 'getup') {
        this.getUp(time);
      } else if (mode === 'jump') {
        /* `amount` is where the jump is: near one at take-off, about a third
           at the top of the arc, near zero falling fast. Three shapes are mixed
           along it. Going up the legs tuck and the arms swing up with the push;
           at the top she is loosely gathered; coming down the legs reach for
           the ground, toes first, and the arms come out for balance while the
           head looks at the landing. */
        const a = clamp(amount, 0, 1);
        const rising = clamp((a - .35) / .55, 0, 1), falling = clamp((.35 - a) / .27, 0, 1);
        const apex = 1 - rising - falling;
        const shapes = {
          rise: {torso: .10, abdomen: .04, neck: -.06, head: -.12, hair_back: -.035,
                 arm_near: -1.25, forearm_near: -.95, hand_near: -.2, arm_far: -.95, forearm_far: -.8, hand_far: -.15,
                 thigh_near: -.6, shin_near: 1.15, foot_near: .45, thigh_far: -.25, shin_far: .75, foot_far: .4},
          apex: {torso: .06, abdomen: .02, neck: -.03, head: -.05, hair_back: -.02,
                 arm_near: -.95, forearm_near: -.6, hand_near: -.1, arm_far: -.65, forearm_far: -.55, hand_far: -.05,
                 thigh_near: -.4, shin_near: .85, foot_near: .35, thigh_far: -.12, shin_far: .55, foot_far: .3},
          fall: {torso: .12, abdomen: .04, neck: 0, head: 0, hair_back: .02,
                 arm_near: -1.0, forearm_near: -.65, hand_near: .05, arm_far: -.8, forearm_far: -.6, hand_far: .05,
                 thigh_near: -.3, shin_near: .4, foot_near: .2, thigh_far: .12, shin_far: .3, foot_far: .15},
        };
        for (const name of Object.keys(shapes.rise))
          p[name] = shapes.rise[name] * rising + shapes.apex[name] * apex + shapes.fall[name] * falling;
      }
      // No clip may pose a joint past what a body allows.
      this.clampPose();
      this.resolve();
      return this;
    }

    /* Getting up from lying face down, for real: hands under the shoulders
       and push, knee under, kneel, stand. The old get-up played the fall
       backwards, which left her floating at sixty degrees with nothing under
       her — a rewind, not a movement. Contacts are held by IK: while the hands
       are pushing they stay on the floor as the chest rises, and once the feet
       are planted they stay planted as the legs straighten. */
    /* Keyframes that name where a foot stands (`nearAt`, `farAt`) get their
       leg angles from the IK once, against this rig's own bone lengths, so
       the contact is exact and the frames either side interpolate from real
       angles rather than guesses. */
    compileGetup() {
      if (this.getupFrames) return this.getupFrames;
      const saved = {pose: this.pose, offset: this.rootOffset};
      const frames = GETUP.map(f => ({...f}));
      for (const f of frames) {
        this.pose = {}; this.rootOffset = [f.shift, f.drop];
        for (const name of ['root', 'abdomen', 'torso', 'neck', 'head']) this.pose[name] = f[name];
        for (const side of ['near', 'far']) if (f[side]) {
          const [thighW, shinW, footW] = f[side];
          this.pose[`thigh_${side}`] = thighW - f.root; this.pose[`shin_${side}`] = shinW - thighW; this.pose[`foot_${side}`] = footW - shinW;
        }
        this.resolve();
        for (const side of ['near', 'far']) {
          if (!f[`${side}At`]) { f[`${side}X`] = this.world.get(`foot_${side}`).x; continue; }
          this.plantFoot(side, f[`${side}At`]);
          const thighW = this.world.get(`thigh_${side}`).angle, shinW = this.world.get(`shin_${side}`).angle, footW = this.world.get(`foot_${side}`).angle;
          f[side] = [thighW, shinW, footW]; f[`${side}X`] = f[`${side}At`];
        }
      }
      this.pose = saved.pose; this.rootOffset = saved.offset; this.resolve();
      return this.getupFrames = frames;
    }
    getUp(time) {
      const p = this.pose;
      const frames = this.compileGetup();
      const t = clamp(time, 0, GETUP_SPAN);
      let i = 0;
      while (i < frames.length - 2 && t > frames[i + 1].t) i++;
      const a = frames[i], b = frames[i + 1];
      const u = smooth(clamp((t - a.t) / (b.t - a.t), 0, 1));
      const k = {};
      for (const name of Object.keys(a)) if (typeof a[name] === 'number' || Array.isArray(a[name])) k[name] = Array.isArray(a[name]) ? a[name].map((v, j) => mix(v, b[name][j], u)) : mix(a[name], b[name] ?? a[name], u);
      for (const name of Object.keys(k)) if (!['t', 'drop', 'shift', 'hands', 'near', 'far', 'nearAt', 'farAt'].includes(name)) p[name] = k[name];
      this.rootOffset = [k.shift, k.drop];
      // Legs from world angles: the floor is a world fact.
      for (const side of ['near', 'far']) {
        const [thighW, shinW, footW] = k[side];
        p[`thigh_${side}`] = thighW - k.root; p[`shin_${side}`] = shinW - thighW; p[`foot_${side}`] = footW - shinW;
      }
      this.resolve();
      const ground = this.baseline;
      /* Feet that are on the floor at the next keyframe get there by IK: the
         foot slides along the floor to its spot while the hips move, the knee
         going whichever way keeps it off the floor, and once both keyframes
         are contacts the foot simply stays planted as the legs straighten. */
      for (const side of ['near', 'far']) {
        if (!b[`${side}At`]) continue;
        const x = mix(a[`${side}X`], b[`${side}X`], u);
        this.plantFoot(side, x);
      }
      /* Hands: they slide along the floor from where they lay to under the
         shoulders and stay flat there while they carry weight; as the chest
         comes up past what the arms can reach, they let go. */
      if (k.hands > 0) for (const side of ['near', 'far']) {
        const shoulder = this.world.get(`arm_${side}`);
        const lying = side === 'near' ? 31.7 : 28.9;
        const under = shoulder.x + (side === 'far' ? 6 : 2);
        const target = [mix(lying, under, smooth(Math.min(1, k.hands * 1.5))), ground - 3.5];
        this.solveLimb(`arm_${side}`, `forearm_${side}`, `hand_${side}`, target, -1, -Math.PI / 2);
      }
      this.clampPose();
      this.resolve();
      /* Nothing goes through the floor. The lowest opaque pixel of any rigid
         part — hair is soft and left out — is lifted back onto it. */
      let deepest = -Infinity;
      for (const [name, points] of this.solidPoints()) {
        const bone = this.bones.get(name), w = this.world.get(bone.anchor || name);
        for (let j = 0; j < points.length; j += 2) deepest = Math.max(deepest, w.y + w.s * points[j] + w.c * points[j + 1]);
      }
      const sink = deepest - (ground + 1);
      if (sink > 0) { this.rootOffset[1] -= sink; this.resolve(); }
      return this;
    }
    // The rim pixels of every rigid layer, relative to its pivot, cached: all
    // that is needed to know how low a part reaches, without scanning the sheet.
    solidPoints() {
      if (this.solid) return this.solid;
      this.solid = new Map();
      for (const b of this.layers) {
        if (b.name.startsWith('hair_')) continue;
        const src = this.pixels.get(b.name), pivot = b.anchor ? this.bones.get(b.anchor).pivot : b.pivot, out = [];
        for (let p = 0; p < src.length; p++) {
          if (!(src[p] >>> 24)) continue;
          const x = p % this.width, y = (p - x) / this.width;
          const rim = [p - 1, p + 1, p - this.width, p + this.width].some(q => q < 0 || q >= src.length || !(src[q] >>> 24));
          if (rim) out.push(x + .5 - pivot[0], y + .5 - pivot[1]);
        }
        this.solid.set(b.name, out);
      }
      return this.solid;
    }

    // Inverse point sampling directly into a 64x96 RGBA raster, one native pixel
    // per destination cell. This avoids Canvas2D's antialiased rotated edges.
    rasterize({ facing = 1, hidden = new Set(), exploded = 0, outfit = new Set(), viewport = null, wounds = null, xray = false, organs = null } = {}) {
      const {width, height, x: viewX, y: viewY} = viewport || {width:this.width,height:this.height,x:0,y:0};
      const target = new Uint32Array(width * height);
      // Scratch for a layer that is being turned, so its own holes can be found
      // before it is composited over anything else.
      if (!this.scratch || this.scratch.length !== target.length) this.scratch = new Uint32Array(target.length);
      /* A garment is drawn with exactly its bone's transform and its bone's
         drift channel, so it follows the body in every frame: when the chest
         breathes or lags a pixel behind the hips, the shirt on it does the same
         thing in the same frame. A `drift` the garment declares for itself is
         ignored on purpose — clothes that trailed the body by a pixel and
         caught up later were tried, and rejected. Only a `sway` strand moves a
         garment against the body, and those belong to the loose pieces (skirt,
         cape, coat tails, scarf, tie), which hang from a point that follows it.

         Where it is drawn is its own business: a garment with a `z` takes its
         place in the same order as the body parts, so a cloak can go over every
         layer rather than only over the one bone it hangs from. Without one it
         falls in directly behind its bone, which is where every other garment
         belongs.

         A garment may also declare what it `covers` — long hair goes inside a
         hood, not out over the top of it. */
      const worn = this.outfits.filter(o => outfit.has(o.slot));
      const veiled = new Set(hidden);
      for (const o of worn) for (const name of o.covers || []) veiled.add(name);
      /* `raise` lifts whole bones (and what hangs on them) through the drawing
         order for a moment: an arm that reaches across the body has to be
         drawn in front of it, whichever side it belongs to. */
      const lift = name => (this.raise && this.raise.get(name)) || 0;
      const ordered = this.layers.map((b, i) => ({ layer: b, z: b.z + lift(b.anchor || b.name), seq: i }));
      for (const o of worn) {
        const base = this.bones.get(o.bone);
        ordered.push({ layer: { ...base, ...o, bone: o.bone, drift: base.drift },
                       z: (o.z === undefined ? base.z + .5 : o.z) + lift(o.bone), seq: ordered.length });
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
                /* Olho ferido é olho ABAIXO DO PRÓPRIO MÁXIMO, e não abaixo de 100.
                   O vigor de SUBSTÂNCIA encolhe o que cada região aguenta — um
                   personagem comum anda com o olho em 80/80, inteiro —, e comparar
                   com 100 pintava o olho de cego em todo mundo: de longe, o
                   personagem parecia estar de olhos fechados o tempo todo. */
                const cheio=injury&&injury.maxHp>0?injury.maxHp:100;
                if(injury && injury.hp<cheio && sy===this.eyes.row && this.eyes.sockets[eye].includes(sx))color=injury.hp<=0?0xff39343d:0xff46409f;
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
