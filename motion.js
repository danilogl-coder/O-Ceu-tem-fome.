/* Fixed-step game physics and additive character motion. No dependencies. */
(function (scope) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const approach = (v, target, delta) => v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);

  class CharacterPhysics {
    constructor() { this.reset(); }
    reset(x = 240) {
      this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
      this.grounded = true; this.jumpBuffer = 0; this.jumpHeld = false;
      this.landing = 0; this.acceleration = 0; this.accelerationY = 0;
      this.impact = 0; this.facing = 1; this.crouch = 0; this.fallen = null; this.rising = null;
    }
    /* Going down. `fallen` is the clock the fall clip plays on, and while it is
       running the character takes no input: a fall the player can steer out of
       is not a fall. It only clears on reset, so the last frame holds. */
    trip() { if (this.fallen === null) { this.fallen = 0; this.rising = null; this.jumpBuffer = 0; this.crouch = 0; } }
    // Only ever on purpose, and only once she has actually finished going down.
    rise() { if (this.fallen !== null && this.rising === null && this.fallen >= FALL_PLAY) this.rising = this.fallen; }
    // How far through the get-up she is, 0..1, or null when not getting up.
    get risingProgress() { return this.rising === null ? null : clamp((this.fallen - this.rising) / GETUP_TIME, 0, 1); }
    get down() { return this.fallen !== null && this.rising === null && this.fallen >= FALL_PLAY; }
    // A jump from standing gathers itself first. Only from standing: a jump
    // buffered in the air has already been anticipated and must fire on contact.
    pressJump() { this.jumpBuffer = .12; this.jumpHeld = true; if (this.grounded) this.crouch = .055; }
    releaseJump() { this.jumpHeld = false; }
    step(dt, direction = 0, sprint = false) {
      const oldVx = this.vx, oldVy = this.vy;
      if (this.fallen !== null) {
        // Down means down. The clock keeps running so the body can go on
        // settling and breathing, but nothing here gets her up.
        this.fallen += dt; direction = 0; sprint = false;
        if (this.rising !== null && this.fallen > this.rising + GETUP_TIME) {
          this.fallen = null; this.rising = null;
        }
      }
      // Sprinting is a different gait, not a faster walk, so the top speed is
      // most of a stride longer and it takes a moment to wind up to it.
      const top = sprint && this.grounded ? SPRINT : WALK;
      // A body that has just tripped keeps sliding; stopping dead reads as
      // hitting a wall rather than as falling over.
      const acceleration = this.fallen !== null ? 150
        : this.grounded ? (direction ? (sprint ? 300 : 420) : 550) : 220;
      this.vx = approach(this.vx, clamp(direction, -1, 1) * top, acceleration * dt);
      this.acceleration = (this.vx - oldVx) / dt;
      this.x += this.vx * dt;
      if (direction) this.facing = Math.sign(direction);
      this.landing *= Math.exp(-dt * 13);
      this.impact = 0;
      if (this.jumpBuffer > 0 && this.grounded && this.fallen === null) {
        if (this.crouch > 0) this.crouch = Math.max(0, this.crouch - dt);
        else { this.vy = 225; this.grounded = false; this.jumpBuffer = 0; }
      } else this.crouch = Math.max(0, this.crouch - dt);
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      if (!this.grounded) {
        // Releasing the button shortens ascent; falling has a firmer weight.
        const gravity = this.vy > 0 ? (this.jumpHeld ? 570 : 1050) : 760;
        this.vy -= gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.landing = clamp(-this.vy / 300, 0, 1);
          this.impact = this.landing;
          this.y = 0; this.vy = 0; this.grounded = true;
        }
      }
      // Vertical acceleration excludes the landing stop, which arrives as an
      // impulse instead: a single frame of -infinity would shock the hair.
      this.accelerationY = this.impact ? 0 : (this.vy - oldVy) / dt;
    }
  }

  // Top ground speeds, scene pixels per second. The run clip takes over between
  // them, so the two gaits never have to share a speed.
  const WALK = 72, SPRINT = 132, RUN_FROM = 96;
  /* The fall is 0.9s of clip and then she stays down. `fallen` counts past the
     end and the clip holds its last drawing; nothing stands her back up on its
     own. Getting up is a separate decision — `CharacterPhysics.rise()` — and it
     is a movement of its own, the `getup` clip: hands under the shoulders, push
     the chest up, knee under, kneel, stand. It used to be the fall played
     backwards, which floated her at sixty degrees with nothing under her. */
  const FALL_PLAY = .9, FALL_STAY = 3.2, GETUP_TIME = 1.5;
  const fallClock = t => Math.min(t, FALL_PLAY);

  class Spring {
    constructor() { this.value = 0; this.velocity = 0; }
    step(dt, target, stiffness = 90, damping = 13) {
      this.velocity += ((target - this.value) * stiffness - this.velocity * damping) * dt;
      this.value = clamp(this.value + this.velocity * dt, -.24, .24);
      return this.value;
    }
  }


  // Per-link tuning. `stiff` is the spring back to the drawn pose (1/s^2, so a
  // steady push of A px/s^2 settles A/stiff pixels away), `drag` bleeds momentum
  // (1/s, under 2*sqrt(stiff) so the hair overshoots and whips), `bend` caps how
  // far the link may stray from the drawn angle (radians) and `lead` weights how
  // much of the body's inertia reaches it.
  const STRAND_PROFILE = {
    mid:  {stiff: 58, drag: 10, bend: .26, lead: .75},
    tail: {stiff: 44, drag: 8.5, bend: .34, lead: 1},
    tip:  {stiff: 34, drag: 7, bend: .44, lead: 1.3},
    /* The cloak. Heavy cloth, not hair: it takes longer to get going, swings
       through a smaller arc and takes longer to stop, so its natural period is
       nowhere near the hair's and the two never fall into step. That is the
       whole point of giving it a strand of its own rather than borrowing the
       hair's — a cloak that rippled at the same rate as the hair would read as
       one object wearing another. */
    shoulder: {stiff: 96, drag: 15, bend: .11, lead: .35},
    skirt:    {stiff: 62, drag: 11.5, bend: .19, lead: .7},
    hem:      {stiff: 40, drag: 8.5, bend: .28, lead: 1.05},
  };
  // No row may sit further than this from its neighbour, which is what keeps the
  // deformed mass a single connected shape.
  const ROW_SLACK = .9;

  /* What the air does to each simulated thing. Hair and a cloak do not live in
     the same weather: hair is light and catches every flicker of a breeze, a
     cloak is heavy cloth that ignores the flicker and billows from the wearer's
     own movement instead. So they get their own gusts, at periods deliberately
     unrelated to each other — no ratio near a whole number — and their own
     sensitivity to speed, to acceleration and to the chest rising.

     This is what keeps them off each other's beat. Identical stiffness would do
     it too, but two things driven by the same wind still swing together however
     differently they are strung; the drive has to differ as well. */
  const WIND = {
    mass: {gust: [[.9, 19, 0], [2.17, 27, 1.3], [4.6, 15, .4]], speed: 2.4, accel: .08,
           rise: 1.3, drop: .04, land: 380, breath: 30},
    cape: {gust: [[.37, 24, .7], [1.31, 15, 2.2], [2.9, 7, 1.1]], speed: 3.1, accel: .15,
           rise: .7, drop: .015, land: 250, breath: 9},
  };

  /* The hair as one image that bends, not as parts that hinge.

     A pinned verlet strand is simulated in the sprite's own 64x96 space, exactly
     as a chain of bones would be. What is different is the output: instead of
     rotating separate layers, the solved curve is written out as one horizontal
     and vertical offset per screen row, which `Skeleton2D.rasterize` applies
     while sampling. Every row then draws a whole translated copy of a row of the
     source art, so no pixel is ever skipped and no seam exists to open.

     The drawn pose is the equilibrium. There is no standing gravity: the art was
     drawn hanging correctly, and the solver only ever adds the difference that
     movement makes, so a still character is pixel for pixel the original art. */
  class HairSway {
    constructor(rig, key, spec) {
      this.rig = rig; this.key = key;
      this.anchor = spec.anchor;
      const origin = rig.bones.get(this.anchor).pivot;
      this.local = spec.joints.map(([x, y]) => [x - origin[0], y - origin[1]]);
      this.row = spec.joints.map(([, y]) => y);
      this.span = []; this.bind = [];
      for (let i = 0; i < this.local.length - 1; i++) {
        const dx = this.local[i + 1][0] - this.local[i][0];
        const dy = this.local[i + 1][1] - this.local[i][1];
        this.span.push(Math.hypot(dx, dy));
        this.bind.push(Math.atan2(dy, dx));
      }
      // A link is named from STRAND_PROFILE, or a garment brings its own numbers.
      this.profile = spec.links.map(name => typeof name === 'object' ? name : STRAND_PROFILE[name]);
      this.wind = spec.wind ? {...WIND.cape, ...spec.wind} : null;
      this.point = this.local.map(() => [0, 0]);
      this.previous = this.local.map(() => [0, 0]);
      this.settled = false;
    }

    // Where every joint would sit if the hair were perfectly rigid.
    drawn() {
      const w = this.rig.world.get(this.anchor);
      return this.local.map(([dx, dy]) => [w.x + w.c * dx - w.s * dy, w.y + w.s * dx + w.c * dy]);
    }

    reset() { this.settled = false; return this.solve(0, 0, 0); }

    /* An impulse, not a force. The floor stopping a body does not push its hair
       for a while — it changes the hair's velocity inside one frame. Verlet
       keeps velocity as the gap back to the previous position, so that gap is
       what an impulse moves. Weighted by `lead`, so the tip whips further than
       the roots, which is the whole reason the hair is simulated at all. */
    kick(vx, vy) {
      for (let i = 1; i < this.point.length; i++) {
        const lead = this.profile[i - 1].lead;
        this.previous[i][0] -= vx * lead;
        this.previous[i][1] -= vy * lead;
      }
      return this;
    }

    solve(dt, forceX, forceY) {
      const rest = this.drawn(), n = this.point.length;
      if (!this.settled || !(dt > 0)) {
        for (let i = 0; i < n; i++) { this.point[i] = [...rest[i]]; this.previous[i] = [...rest[i]]; }
        this.settled = true; this.rig.repin();
        if (!(dt > 0)) return this.write(rest, rest);
      }
      this.point[0] = [...rest[0]]; this.previous[0] = [...rest[0]];
      for (let i = 1; i < n; i++) {
        const {stiff, drag, lead} = this.profile[i - 1];
        const keep = Math.exp(-drag * dt), step = dt * dt;
        const px = this.point[i][0], py = this.point[i][1];
        const vx = (px - this.previous[i][0]) * keep, vy = (py - this.previous[i][1]) * keep;
        const ax = (rest[i][0] - px) * stiff + forceX * lead;
        const ay = (rest[i][1] - py) * stiff + forceY * lead;
        this.previous[i] = [px, py];
        this.point[i] = [px + vx + ax * step, py + vy + ay * step];
      }
      // Exact link lengths and a hard cap on the swing, root to tip.
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n - 1; i++) {
          const bend = this.profile[i].bend;
          const ax = this.point[i][0], ay = this.point[i][1];
          const angle = Math.atan2(this.point[i + 1][1] - ay, this.point[i + 1][0] - ax);
          const target = Math.atan2(rest[i + 1][1] - rest[i][1], rest[i + 1][0] - rest[i][0]);
          const offset = clamp(Math.atan2(Math.sin(angle - target), Math.cos(angle - target)), -bend, bend);
          const held = target + offset;
          this.point[i + 1] = [ax + Math.cos(held) * this.span[i], ay + Math.sin(held) * this.span[i]];
        }
      }
      return this.write(this.point, rest);
    }

    /* Sample the solved curve once per screen row. Above the strand's root the
       hair is scalp and does not move; below the tip it carries the tip's
       offset. Rows in between interpolate, then every row is pulled to within
       ROW_SLACK of the row above so the mass cannot tear into stripes. */
    write(point, rest) {
      const table = this.rig.sway.get(this.key);
      if (!table) return this;
      const rows = this.rig.height;
      /* Nothing here turns the hair. An anchored layer is already drawn rotated
         by its anchor's own angle, and the tilts the rasteriser refuses to draw
         are the ones under UNIT_SNAP, which this project treats as noise rather
         than motion — welding the hair to the head is what stopped it blinking.
         Adding the head's turn here as a shear on top would turn it twice:
         invisible while the head stays near upright, and a mess the moment a
         clip rolls it onto the floor. Above the strand's root the offset is
         held at exactly zero: that is scalp, and a fraction of a pixel of
         wobble there is enough to round one row of the fringe the other way
         from its neighbours and make it blink. */
      let previousX = 0, previousY = 0;
      for (let y = 0; y < rows; y++) {
        let dx = 0, dy = 0;
        if (y > this.row[0]) {
          let i = this.row.length - 1;
          while (i > 0 && y <= this.row[i - 1]) i--;
          const y0 = this.row[i - 1], y1 = this.row[i];
          const t = clamp((y - y0) / (y1 - y0), 0, 1);
          const ax = point[i - 1][0] - rest[i - 1][0], ay = point[i - 1][1] - rest[i - 1][1];
          const bx = point[i][0] - rest[i][0], by = point[i][1] - rest[i][1];
          dx += mix(ax, bx, t); dy = mix(ay, by, t);
        }
        if (y) { dx = clamp(dx, previousX - ROW_SLACK, previousX + ROW_SLACK);
                 dy = clamp(dy, previousY - ROW_SLACK, previousY + ROW_SLACK); }
        table[y * 2] = previousX = dx;
        table[y * 2 + 1] = previousY = dy;
      }
      return this;
    }

    // Largest distance any joint sits from its drawn position, in pixels.
    get displacement() {
      const rest = this.drawn();
      return Math.max(...this.point.map((p, i) => Math.hypot(p[0] - rest[i][0], p[1] - rest[i][1])));
    }
  }

  // Read straight out of the rig, so hair.py stays the only place the strand is
  // declared.
  function hairSways(rig, asset) {
    return Object.entries(asset.sway || {}).map(([key, spec]) => new HairSway(rig, key, spec));
  }


  /* ------------------------------------------------------------------ life

     Everything below is a separate system with its own clock, and no two
     periods share a factor. That separation is the whole point: a character
     whose breathing, weight, blink, eyes and hair all beat together reads as
     one swinging puppet, and the same motion split across unrelated rhythms
     reads as a person standing still. */
  const RHYTHM = {
    breathRest: 3.7, breathRun: 1.45,   // seconds per breath
    breathHurt: 1.15,                   // winded: short, shallow and uneven
    weight: 6.3,                        // base wait before the weight changes foot
    blink: 2.5,                         // shortest wait between blinks
    saccade: 1.6,                       // shortest wait before the eyes move on their own
    gesture: 9.4,                       // quietest wait before an idle gesture
  };

  /* A held whole-pixel value. Hysteresis, because a channel parked on a
     boundary would otherwise flip a pixel back and forth every frame. */
  class PixelPin {
    constructor() { this.held = 0; }
    step(value) {
      if (Math.abs(value - this.held) > .65) this.held = Math.round(value);
      return this.held;
    }
  }

  /* Breathing. Not a sine: air goes in faster than it comes out, and the pause
     sits at the bottom. Rate and depth follow effort, so standing is a slow
     shallow swell and running is quick and deep. */
  class Breath {
    constructor() { this.phase = 0; this.value = 0; this.depth = 1; this.lift = 0; this.shoulder = 0;
                    this.winded = 0; this.jitter = 0; this.chest = new PixelPin(); }
    /* The wind knocked out. A body that lands hard stops mid-breath and then
       starts again short and ragged, getting its rhythm back only slowly. It
       runs off the same clock as ordinary breathing so nothing else has to know
       she is hurt — the cadence itself carries it. */
    startle(force) { this.winded = Math.min(1.5, this.winded + force * 1.1); this.phase = .84; }
    step(dt, effort, tired) {
      this.winded = Math.max(0, this.winded - dt * .38);
      this.jitter += dt * 1.9;
      const hurt = Math.min(1, this.winded);
      // Winded breathing is not just faster: the length of each breath wanders,
      // which is what makes it read as ragged rather than as panting.
      const period = mix(mix(RHYTHM.breathRest, RHYTHM.breathRun, effort),
                         RHYTHM.breathHurt * (1 + Math.sin(this.jitter) * .42), hurt);
      this.phase = (this.phase + dt / period) % 1;
      const t = this.phase;
      // 0 .. .38 in, .38 .. .82 out, .82 .. 1 the pause before the next one.
      this.value = t < .38 ? -Math.cos(t / .38 * Math.PI)
                 : t < .82 ? Math.cos((t - .38) / .44 * Math.PI)
                 : -1;
      this.depth = mix(1.05, 1.9, effort) * mix(1, 1.18, tired)    // at most two pixels of rise
                 * mix(1, .58 + Math.sin(this.jitter * 2.3) * .26, hurt);
      const rise = (this.value + 1) * .5 * this.depth;
      this.lift = this.chest.step(rise);
      /* Tired shoulders work harder than the chest does, but as an angle, not
         as a second vertical channel: lifting the arms a pixel further than the
         torso puts a moving step through the shoulder, and the two channels
         crossing their rounding thresholds a frame apart is a visible blink. */
      this.shoulder = this.value * mix(.004, .05, tired) * mix(.6, 1, effort);
      return this;
    }
  }

  /* Weight transfer. Standing square on both feet is the one thing a person
     never does, so the hips drift onto one leg and, every six to twelve
     seconds, quietly change their mind. The feet stay planted and the knees
     take up the difference through the leg IK, which is what makes it read as
     weight rather than as sliding. */
  class WeightShift {
    constructor() { this.side = 1; this.value = 0; this.velocity = 0;
                    this.clock = 0; this.count = 0; this.wait = RHYTHM.weight; }
    step(dt, settled) {
      this.clock += dt;
      if (settled && this.clock > this.wait) {
        this.side = -this.side; this.count++; this.clock = 0;
        // Irregular on purpose, and stable across framerates.
        this.wait = RHYTHM.weight + ((this.count * 79) % 61) / 10;
      }
      if (!settled) this.clock = 0;
      const target = settled ? this.side : 0;
      // Heavily damped: weight moves like weight, not like a switch.
      this.velocity += ((target - this.value) * 7.5 - this.velocity * 5.2) * dt;
      this.value = clamp(this.value + this.velocity * dt, -1, 1);
      return this.value;
    }
  }

  /* Blinking. Irregular by construction, and a quarter of the time it comes as
     a pair, which is what a real blink pattern looks like. */
  class Blink {
    constructor() { this.clock = 0; this.wait = 2.9; this.count = 0; this.value = 0; this.double = false; }
    step(dt) {
      this.clock += dt;
      const age = this.clock - this.wait;
      this.value = age >= 0 && age < .15 ? (age < .035 || age > .115 ? .5 : 1) : 0;
      if (age >= .15) {
        if (this.double) {
          this.double = false; this.clock = 0; this.wait = .11;   // the second of a pair
        } else {
          this.count++; this.clock = 0;
          this.wait = RHYTHM.blink + ((this.count * 137) % 451) / 100;   // 2.5 .. 7.0s
          this.double = ((this.count * 211) % 100) < 26;
        }
      }
      return this.value;
    }
  }

  /* Where the eyes are pointed. One pixel of iris, so there are two answers:
     the pointer decides when it is over the scene, and when it is not the eyes
     wander on their own. The dead zone keeps a pointer near the middle from
     flipping the iris every frame. */
  class Gaze {
    constructor() { this.side = 1; this.clock = 0; this.count = 0; this.wait = 2.4; this.led = false; }
    step(dt, pointer) {
      this.clock += dt;
      if (pointer !== null && pointer !== undefined) {
        const want = pointer > .16 ? 1 : pointer < -.16 ? -1 : this.side;
        if (want !== this.side) { this.side = want; this.clock = 0; }
        this.led = true;
        return this.side;
      }
      this.led = false;
      if (this.clock > this.wait) {
        this.count++; this.clock = 0;
        this.wait = RHYTHM.saccade + ((this.count * 163) % 170) / 100;   // 1.6 .. 3.3s
        this.side = ((this.count * 3) % 5) < 2 ? -1 : 1;
      }
      return this.side;
    }
  }

  // Ease in, hold, ease out — the shape every one of the idle gestures runs on.
  const envelope = t => {
    const ease = u => u * u * (3 - 2 * u);
    return t < .28 ? ease(t / .28) : t < .68 ? 1 : ease((1 - t) / .32);
  };

  /* Things a person does while waiting. Each one is an additive pose, so it
     rides on top of whatever the body is already doing rather than replacing
     it, and each has its own length so they never fall into a pattern. */
  const GESTURES = [
    // Hand comes up to the waist and rubs. The small fast wobble during the
    // hold is the scratch itself; without it the arm just poses.
    {name: 'scratch', span: 1.9, pose: (t, e) => ({
      arm_near: e * .5, forearm_near: e * -1.15 + (t > .3 && t < .66 ? Math.sin(t * 78) * .07 : 0),
      hand_near: e * -.3, head: e * .03, neck: e * .02,
    })},
    /* Tossing the hair back. Reaching a hand to the head would need about 150
       degrees of shoulder rotation, which this arm sprite cannot take — its
       shading would end up on the wrong side. Tipping the head and letting the
       hair physics carry the weight says the same thing and costs nothing. */
    {name: 'hairToss', span: 1.7, pose: (t, e) => ({
      head: e * -.11 * Math.cos(t * Math.PI * 1.6), neck: e * -.05,
      torso: e * .03, arm_near: e * .16, arm_far: e * .1,
    }), hair: t => t < .45 ? -130 * Math.sin(t / .45 * Math.PI) : 60 * Math.sin((t - .45) / .55 * Math.PI)},
    {name: 'shoulders', span: 1.5, pose: (t, e) => ({
      arm_near: e * -.2 * Math.cos(t * Math.PI * 2), arm_far: e * -.17 * Math.cos(t * Math.PI * 2 + .7),
      torso: e * .045, neck: e * -.02,
    })},
    /* Looks away and back. On a head nine pixels wide the turn IS the eye:
       rotating the sprite far enough to read would put its shading on the wrong
       side and snap the thin lock at the cheek. So the eyes lead, the neck
       gives a hint, and the hair takes the swing. */
    {name: 'glance', span: 2.7, pose: (t, e) => ({
      head: e * .05, neck: e * .028, torso: e * .012,
    }), look: t => t > .12 && t < .8 ? -1 : null,
       hair: t => t < .2 ? -70 * Math.sin(t / .2 * Math.PI) : t > .78 ? 55 * Math.sin((t - .78) / .22 * Math.PI) : 0},
  ];

  class IdleLife {
    constructor() { this.still = 0; this.playing = null; this.t = 0; this.count = 0; this.wait = RHYTHM.gesture; }
    step(dt, settled) {
      if (!settled) { this.still = 0; this.playing = null; this.t = 0; return this; }
      this.still += dt;
      if (!this.playing && this.still > this.wait) {
        this.count++;
        this.playing = GESTURES[(this.count * 3) % GESTURES.length];
        this.t = 0;
        // Next one is never the same distance away as the last.
        this.wait = RHYTHM.gesture + ((this.count * 167) % 690) / 100;   // 9.4 .. 16.3s
      }
      if (this.playing) {
        this.t += dt / this.playing.span;
        if (this.t >= 1) { this.playing = null; this.t = 0; this.still = 0; }
      }
      return this;
    }
    apply(add) {
      if (!this.playing) return;
      const pose = this.playing.pose(this.t, envelope(this.t));
      for (const name of Object.keys(pose)) add(name, pose[name]);
    }
    // Extra push the gesture sends into the hair, in the same units as wind.
    get hair() { return this.playing && this.playing.hair ? this.playing.hair(this.t) : 0; }
    // Where the gesture wants the eyes, or null to leave them alone.
    get look() { return this.playing && this.playing.look ? this.playing.look(this.t) : null; }
    get name() { return this.playing ? this.playing.name : null; }
  }

  /* Inertia. A body that changes speed leaves its own parts behind for a few
     frames, and the further a part is from the hips the longer it takes to
     catch up. Each channel has its own stiffness, so they arrive one after
     another instead of together. */
  class Lag {
    /* Damping is set just past critical on purpose. A channel that moves in
       whole pixels has nowhere to put an overshoot: ringing across the rounding
       threshold does not read as springiness, it reads as a pixel flickering.
       The springiness lives in the hair, which has the sub-pixel room for it. */
    constructor(stiff, limit, damp = 2.1 * Math.sqrt(stiff)) {
      this.stiff = stiff; this.damp = damp; this.limit = limit;
                                      this.value = 0; this.velocity = 0; this.pin = new PixelPin(); }
    kick(impulse) { this.velocity += impulse; return this; }
    step(dt, drive) {
      this.velocity += (drive * this.stiff - this.value * this.stiff - this.velocity * this.damp) * dt;
      this.value = clamp(this.value + this.velocity * dt, -this.limit, this.limit);
      return this.pin.step(this.value);
    }
  }

  /* What hitting the ground does to a body.

     The impulse is not a number picked to look right: it is read off the fall
     itself. The clip carries the body down at some speed and the floor stops
     it, and the size of that deceleration — velocity killed over the frame it
     was killed in — is the impact. Everything that hangs off the body keeps
     going for a moment afterwards, which is what this spreads around: the ribs
     compress into the ground and push back, the body skids to a stop against
     friction, the limbs shudder, and the hair, being the loosest thing on her,
     whips hardest and settles last.

     Each part gets its own frequency and its own damping. A single shared decay
     would read as the whole sprite wobbling as one object — the same mistake as
     animating breath, blink and hair on one clock. */
  class Impact {
    constructor() { this.squash = 0; this.squashV = 0; this.slide = 0; this.slideV = 0;
                    this.strength = 0; this.age = 9; }
    clear() { this.strength = 0; this.age = 9; this.slide = 0; this.slideV = 0; return this; }
    /* Fires when a body that was moving down gets stopped. Both halves matter:
       without the speed test every held frame of a stepped clip looks like a
       deceleration, and without the deceleration test she would be hit on the
       way down as well as at the bottom. */
    hit(speed, decel) {
      if (speed < 25 || decel < 180 || this.age < .5) return 0;
      const force = clamp(decel / 300, .2, 1.2);
      this.strength = force; this.age = 0;
      this.squashV += force * 13;                 // ribs compressing into the floor
      this.slideV += force * 10;                  // still travelling when she lands
      return force;
    }
    step(dt) {
      this.age += dt;
      // Stiff and damped hard: a body gives once against the ground and comes
      // back. Anything springier reads as a bouncing ball.
      this.squashV += (-this.squash * 200 - this.squashV * 18) * dt;
      // A pixel or so of give. More than that stops reading as flesh against a
      // floor and starts reading as the floor swallowing her.
      this.squash = clamp(this.squash + this.squashV * dt, -.6, 1.4);
      // Friction. The slide is a position she keeps, not an offset that snaps
      // back — sliding forward and then sliding back is not how floors work.
      this.slideV *= Math.exp(-dt * 7);
      this.slide += this.slideV * dt;
      return this;
    }
    // A limb shuddering after the body stops, each at its own rate.
    shudder(phase, rate, decay) {
      if (this.age > 1.8) return 0;
      return this.strength * Math.sin((this.age * rate + phase) * TAU) * Math.exp(-this.age * decay);
    }
    get settling() { return this.age < 1.8; }
  }

  class CharacterMotion {
    constructor(rig) {
      this.rig = rig; this.clock = 0; this.gait = 0;
      this.pose = {}; this.offset = [0, 0]; this.initialized = false;
      this.enter = 0; this.lastClip = null;
      this.hair = new Spring(); this.hand = new Spring();
      this.strands = hairSways(rig, rig.asset); this.hairPhysics = true; this.breeze = 1;
      this.blink = 0; this.breath = 0; this.fatigue = 0; this.pointer = null;
      // One instance per system, each with its own clock. See RHYTHM.
      this.breathing = new Breath();
      this.weight = new WeightShift();
      this.blinking = new Blink();
      this.gaze = new Gaze();
      this.idle = new IdleLife();
      // Stiffer at the chest than at the arms: the parts arrive one after
      // another rather than all together. Clothes have no lag of their own —
      // they ride on the channel of the part they are worn on (skeleton.js).
      this.chestLag = new Lag(34, 1);
      this.armsLag = new Lag(22, 1.3);
      this.lastAccel = 0; this.life = true; this.turn = 0; this.lastDirection = undefined;
      this.impact = new Impact();
      this.clipFrame = null; this.clipDrop = 0; this.clipSpeed = 0; this.clipAge = 0;
      /* What the leg solver returns for the drawn pose. The drawn legs are not
         a configuration this IK would pick on its own — it bends the knee the
         other way — so planting the feet is applied as the difference from this
         reading. A hip that has not moved then leaves the legs exactly as
         drawn, and a hip that has moved bends the knees by the difference. */
      this.legRest = {};
      rig.setAnimation('rest', 0);
      for (const side of ['near', 'far']) {
        const foot = rig.bones.get(`foot_${side}`);
        rig.solveLeg(side, [foot.pivot[0], foot.pivot[1]]);
      }
      for (const name of ['thigh_near','shin_near','foot_near','thigh_far','shin_far','foot_far'])
        this.legRest[name] = rig.pose[name] || 0;
      rig.setAnimation('rest', 0);
    }
    /* External acceleration on the hair, in sprite pixels per second squared.
       Scene axes are x right and y up; the sprite's are x forward and y down,
       and the raster mirrors afterwards, so horizontal terms follow `direction`
       rather than the sign of the scene velocity. */
    solveHair(dt, body, direction = 1, grounded = 0) {
      const t = this.clock;
      this.hairForce = [0, 0];
      for (const strand of this.strands) {
        const air = strand.wind || WIND[strand.key] || WIND.mass;
        /* Ambient air: three slow beats that never repeat on a tidy loop, so
           the cloth keeps drifting even when the character is perfectly still —
           except when it is not hanging in the air at all. Lying face down the
           hair is spread on the floor, and a breeze cannot lift what the ground
           is holding. */
        const breeze = this.breeze * mix(1, .12, grounded);
        let fx = 0;
        for (const [rate, force, phase] of air.gust) fx += breeze * Math.sin(t * rate + phase) * force;
        let fy = this.breath * air.breath * mix(1, .45, grounded);
        if (body) {
          const vx = body.vx * direction, ax = body.acceleration * direction;
          fx -= clamp(vx * air.speed + ax * air.accel, -170, 170);
          fy += clamp(body.vy * air.rise + body.accelerationY * air.drop, -160, 160);
          fy += body.landing * air.land;   // impact keeps it travelling down
        }
        if (strand.key === 'mass') fx += this.gestureHair || 0;
        if (strand.key === 'mass') this.hairForce = [fx, fy];
        strand.solve(this.hairPhysics ? dt : 0, fx, fy);
      }
      return this;
    }

    // Largest offset from the drawn hair pose across every link, in pixels.
    get hairSway() {
      return this.strands.length ? Math.max(...this.strands.map(s => s.displacement)) : 0;
    }

    applyLimp(dt,animation,mode,time,body) {
      const m=this.health?.mobility;
      const walking=(animation==='walk'||animation==='run')&&(mode!=='play'||body.grounded);
      const target=m&&!m.crawl&&!this.health.dead&&walking?m.limpSeverity:0;
      this.limpBlend=(this.limpBlend||0)+(target-(this.limpBlend||0))*(1-Math.exp(-dt*12));
      this.limp=null;
      if(!m || this.limpBlend<.001 || !walking)return;
      const rig=this.rig,weight=this.limpBlend,weak=m.limpSide;
      const phase=((mode==='play'?this.gait:time*1.25)+(weak==='far' ? .5 : 0))%1;
      const weakStance=mix(.5,.3,weight),load=phase<weakStance?Math.sin(phase/weakStance*Math.PI)**2:0;
      rig.resolve();
      const current=Object.fromEntries(['near','far'].map(side=>[side,{...rig.world.get(`foot_${side}`)}]));
      rig.rootOffset[1]+=weight*(.35+load*1.35);
      rig.pose.torso=(rig.pose.torso||0)+weight*(.06+load*.08);
      rig.pose.head=(rig.pose.head||0)-weight*(.04+load*.06);
      rig.pose[`arm_${weak}`]=(rig.pose[`arm_${weak}`]||0)-weight*.16;
      rig.resolve();
      const targets={};
      for(const side of ['near','far']){
        const hurt=side===weak,cycle=(phase+(hurt?0:.5))%1,stance=hurt?weakStance:mix(.5,.64,weight);
        const span=20*stance,t=(cycle-stance)/(1-stance),eased=t*t*(3-2*t);
        const b=rig.bones.get(`foot_${side}`),rest=rig.bones.get(`thigh_${side}`).pivot[0]+1;
        const x=cycle<stance?rest+span*.5-20*cycle:rest-span*.5+span*eased;
        const lift=cycle<stance?0:Math.sin(t*Math.PI)**2*(hurt?mix(3.5,.35,weight):3.5);
        const y=b.pivot[1]+rig.baseline-(b.bounds[3]-1)-lift;
        targets[side]={x:mix(current[side].x,x,weight),y:mix(current[side].y,y,weight)};
        rig.solveLeg(side,[targets[side].x,targets[side].y]);
      }
      this.limp={side:weak,strength:weight,phase,weakStance,targets};
    }
    update(dt, mode, time, body, direction = 1) {
      this.clock += dt;
      let animation = mode, amount = .7, phaseTime = time;
      if (mode === 'play') {
        animation = body.fallen !== null ? (body.rising !== null ? 'getup' : 'fall')
          : !body.grounded ? 'jump'
          : Math.abs(body.vx) > RUN_FROM ? 'run'
          : Math.abs(body.vx) > 1 ? 'walk' : 'idle';
        /* The cycle follows distance, not key state, so the feet cannot skate:
           a walking stride covers 40 scene pixels and a running one 96. Both
           clips are fed the time that puts them at this many cycles. */
        this.gait += Math.abs(body.vx) * dt / (animation === 'run' ? 96 : 40);
        phaseTime = animation === 'run' ? (this.gait + .17) / 1.9 : this.gait * .8;
        /* A heel lands every half cycle: the near foot on the whole numbers,
           the far one half way. Whoever listens gets told. */
        const step = Math.floor(this.gait * 2);
        if ((animation === 'walk' || animation === 'run') && body.grounded && this.lastStep !== undefined && step !== this.lastStep) this.onFootstep?.({side: step % 2 === 0 ? 'near' : 'far', run: animation === 'run', speed: Math.abs(body.vx)});
        this.lastStep = step;
        if (body.landing > .6 && !this.landed) { this.landed = true; this.onFootstep?.({side: 'both', land: true, speed: Math.abs(body.vx)}); }
        if (body.landing < .2) this.landed = false;
        if (animation === 'fall') phaseTime = fallClock(body.fallen);
        if (animation === 'getup') phaseTime = body.fallen - body.rising;
        amount = clamp((body.vy + 110) / 310, .08, .9);
      } else if (mode === 'fall') {
        // The preview shows the whole thing on a loop: down, a long moment on
        // the floor while she settles and breathes, then the get-up, then a
        // breath standing before it starts again.
        const loop = time % (FALL_PLAY + FALL_STAY + GETUP_TIME + 1);
        if (loop < FALL_PLAY + FALL_STAY) { animation = 'fall'; phaseTime = fallClock(loop); }
        else if (loop < FALL_PLAY + FALL_STAY + GETUP_TIME) { animation = 'getup'; phaseTime = loop - FALL_PLAY - FALL_STAY; }
        else { animation = 'idle'; phaseTime = loop; }
      } else if (mode === 'jump') {
        amount = clamp((body.vy + 110) / 310, .08, .9);
        if (body.grounded) animation = 'idle';
      }
      const rig = this.rig;
      rig.setAnimation(animation, phaseTime, amount);
      if (body.landing > .01 && animation !== 'fall' && animation !== 'getup' && (mode === 'play' || mode === 'jump')) {
        /* Landing. The hips drop and the knees take it, the chest comes
           forward over the feet — never back, a body that lands leaning back
           is a body about to sit down — and the arms come forward and out. */
        const l = body.landing;
        rig.rootOffset[1] += l * 2.2;
        const give = (name, v) => rig.pose[name] = (rig.pose[name] || 0) + v;
        give('torso', l * .12); give('abdomen', l * .04); give('head', -l * .08); give('neck', -l * .05);
        give('arm_near', -l * .55); give('forearm_near', -l * .4); give('hand_near', l * .1);
        give('arm_far', -l * .4); give('forearm_far', -l * .35);
        rig.resolve();
        if (body.grounded) for (const side of ['near','far']) rig.plantFoot(side, rig.world.get(`foot_${side}`).x);
      }
      /* Blend the base pose first. Breathing/blinking are applied afterwards,
         so clip changes cannot reset their clocks or fade them out.

         The run and the fall are traced off fifteen drawings each and are meant
         to be seen as fifteen drawings: smoothing between them would average
         the poses away and there would be no point having copied them. So those
         two are taken whole, and the smoothing is kept only for the moment the
         clip changes, which would otherwise snap. */
      const stepped = animation === 'run' || animation === 'fall';
      this.enter = animation === this.lastClip ? Math.max(0, this.enter - dt) : .14;
      this.lastClip = animation;
      const blend = !this.initialized || (stepped && this.enter <= 0) ? 1 : 1 - Math.exp(-dt * 18);
      for (const name of rig.bones.keys()) {
        const target = rig.pose[name] || 0;
        this.pose[name] = (this.pose[name] || 0) + (target - (this.pose[name] || 0)) * blend;
      }
      for (let i=0;i<2;i++) this.offset[i] += (rig.rootOffset[i]-this.offset[i])*blend;
      this.initialized = true;
      rig.pose = {...this.pose}; rig.rootOffset = [...this.offset];
      const add = (name, angle) => rig.pose[name] = (rig.pose[name] || 0) + angle;
      const live = mode === 'play' || mode === 'jump';
      const speed = live ? Math.abs(body.vx) / 72 : animation === 'walk' ? .62 : 0;
      const effort = clamp(speed, 0, 1);
      const settled = animation === 'idle' || animation === 'rest';
      const grounded = !live || body.grounded;
      // Fatigue builds faster than it clears, so the breathing stays heavy for a
      // while after the running stops.
      this.fatigue += (effort - this.fatigue) * (effort > this.fatigue ? dt * .3 : dt * .09);

      const breath = this.breathing.step(this.life ? dt : 0, effort, this.fatigue);
      this.breath = breath.value;
      const alive = this.life ? 1 : 0;
      /* The visible part of a breath is the pixel or two the chest rises; the
         angles are decoration. They stay small on purpose — rotating the torso
         swings the head sideways, and a head that wanders more than a pixel
         while walking is exactly the thing that reads as a twitch. */
      add('torso', breath.value * .012 * alive);
      add('abdomen', -breath.value * .005 * alive);
      add('neck', -breath.value * .008 * alive);
      add('head', -breath.value * .012 * alive);
      add('arm_near', (-breath.value * .012 - breath.shoulder) * alive);
      add('arm_far', (-breath.value * .012 - breath.shoulder * .82) * alive);

      // Weight on one foot, changing its mind every six to twelve seconds.
      const weight = this.weight.step(this.life ? dt : 0, settled && grounded);
      if (settled && grounded && this.life) {
        rig.rootOffset[0] += weight * .9;
        add('pelvis', weight * .055);
        add('abdomen', -weight * .03);
        add('torso', -weight * .022);
        add('head', weight * .016);
      }
      // Gathering before the legs push: hips down, chest forward, arms back.
      if (live && body.crouch > 0) {
        rig.rootOffset[1] += 1.35;
        add('torso', .12); add('abdomen', .04); add('head', -.05);
        add('arm_near', .38); add('arm_far', .3); add('forearm_near', -.25); add('forearm_far', -.2);
      }
      /* Turning round. The sprite mirrors in one frame, which is how pixel art
         turns, but the body still has to sell it: for a few frames she leans
         into the new direction, the near arm swings across and the head turns
         first. The hair does its own part — the wind on it flips sign. */
      if (live && this.lastDirection !== undefined && direction !== this.lastDirection && body.grounded && this.life) this.turn = .16;
      this.lastDirection = direction;
      if (this.turn > 0) {
        const e = Math.sin(Math.PI * (1 - this.turn / .16));
        add('torso', .13 * e); add('abdomen', .04 * e); add('head', -.07 * e); add('neck', -.03 * e);
        add('arm_near', -.4 * e); add('forearm_near', -.35 * e); add('arm_far', .28 * e);
        rig.rootOffset[1] += .8 * e;
        this.turn = Math.max(0, this.turn - dt);
      }

      /* The impact is measured, not chosen. The clip carries the body down and
         the floor stops it, and the size of that deceleration is the impulse —
         so a gentle settle stays gentle and a hard landing hits hard, with no
         hand-picked trigger frame.

         The clip is fifteen held drawings, so its drop is a staircase and its
         raw derivative is a train of spikes. What the body actually does is the
         staircase's envelope, so that is what gets differentiated: one short
         low pass, about a frame long, and the landing comes out clean. */
      /* The clip is fifteen held drawings, so the body's speed is what changes
         between one drawing and the next — differentiating the held pose gives
         a train of spikes and nothing useful. So the drop is sampled once per
         drawing, and the frame the floor kills that speed is the landing. */
      if (animation === 'fall' && dt > 0 && rig.frame !== null && rig.frame !== this.clipFrame) {
        const span = Math.max(this.clipAge, dt);
        const speed = (rig.rootOffset[1] - this.clipDrop) / span;
        if (this.clipFrame !== null && this.life) {
          const slam = this.impact.hit(this.clipSpeed, (this.clipSpeed - speed) / span);
          if (slam) {
            /* Everything loose keeps travelling for a moment after the body has
               stopped. The hair takes the biggest share, being the loosest
               thing on her, and it gets a sideways component too: she is still
               sliding forward when she lands. */
            for (const strand of this.strands) strand.kick(slam * .07, -slam * .13);
            this.chestLag.kick(slam * 8); this.armsLag.kick(slam * 12);
            this.breathing.startle(slam);
          }
        }
        this.clipSpeed = speed; this.clipDrop = rig.rootOffset[1]; this.clipAge = 0;
      }
      this.clipAge += dt;
      this.clipFrame = animation === 'fall' ? rig.frame : null;
      if (animation !== 'fall') { this.impact.clear(); this.clipSpeed = 0; this.clipDrop = 0; }
      this.impact.step(this.life ? dt : 0);
      if (animation === 'fall') {
        /* What is left of the landing. The ribs give against the floor and push
           back, the body slides to a stop against friction, and the limbs
           shudder — each at its own rate, so it reads as a body settling rather
           than as one object wobbling. */
        rig.rootOffset[1] += this.impact.squash;
        rig.rootOffset[0] += this.impact.slide;
        if (this.impact.settling) {
          add('thigh_near', this.impact.shudder(0, 3.4, 3.2) * .10);
          add('shin_near', this.impact.shudder(.18, 4.6, 3.8) * .16);
          add('thigh_far', this.impact.shudder(.42, 3.0, 2.9) * .08);
          add('shin_far', this.impact.shudder(.55, 4.1, 3.5) * .12);
          add('forearm_near', this.impact.shudder(.28, 5.2, 4.4) * .13);
          add('forearm_far', this.impact.shudder(.67, 4.8, 4.1) * .10);
          add('head', this.impact.shudder(.12, 2.6, 5.0) * .07);
          add('neck', this.impact.shudder(.12, 2.6, 5.0) * .05);
        }
      }
      this.idle.step(this.life ? dt : 0, settled && grounded && !live);
      this.idle.apply(add);
      this.gestureHair = this.idle.hair;

      /* Planting the feet and solving the legs to them is what turns the hip
         drift into weight: the ankles stay where the art put them and the knees
         take up the difference. Without it the whole character would slide. */
      rig.resolve();
      // A clip that poses its own legs keeps them: planting the feet under a
      // run or a fall would drag them back to where the character is standing.
      const ownLegs = animation === 'walk' || animation === 'run' || animation === 'fall' || animation === 'getup';
      if (grounded && !ownLegs && !(body && body.landing > .01)) {
        const held = {};
        for (const name of Object.keys(this.legRest)) held[name] = rig.pose[name] || 0;
        for (const side of ['near', 'far']) {
          const foot = rig.bones.get(`foot_${side}`);
          rig.solveLeg(side, [foot.pivot[0], foot.pivot[1]]);
        }
        for (const name of Object.keys(this.legRest))
          rig.pose[name] = held[name] + (rig.pose[name] - this.legRest[name]);
        rig.resolve();
      }

      /* Inertia. The counter-move comes first: the frame the body starts to
         push, every part above the hips gets kicked the other way. */
      const accel = live ? body.acceleration * direction : 0;
      if (Math.abs(this.lastAccel) < 40 && Math.abs(accel) > 120) {
        const kick = -Math.sign(accel) * 15;
        this.chestLag.kick(kick); this.armsLag.kick(kick * 1.3);
      }
      this.lastAccel = accel;
      const drive = -clamp(accel * .0022, -1.3, 1.3);
      const step = this.life ? dt : 0;
      const chestX = this.chestLag.step(step, drive);
      const armsX = this.armsLag.step(step, drive * 1.3);
      if (rig.drift.size && !this.life) for (const key of rig.drift.keys()) rig.drift.set(key, [0, 0]);
      if (rig.drift.size && this.life) {
        const lift = -breath.lift;
        if (rig.drift.has('chest')) rig.drift.set('chest', [chestX, lift]);
        if (rig.drift.has('arms')) rig.drift.set('arms', [armsX, lift]);
      }

      const force = live ? body.vx * direction * .001 + body.acceleration * direction * .00013 + body.vy * .0003 : 0;
      // Kept as a reading of how hard the air is pushing; the hair itself is
      // moved by the sway curve, never by posing the layers against each other.
      this.hair.step(dt, clamp(force + this.breath * .018, -.16, .16));
      const hand = this.hand.step(dt, live ? clamp(-body.acceleration * direction * .00016, -.09, .09) : this.breath * .015, 120, 17);
      add('hand_near', hand); add('hand_far', hand * .65);
      this.blink = this.blinking.step(this.life ? dt : 0);
      const wandering = this.gaze.step(this.life ? dt : 0, this.pointer);
      rig.gaze = this.idle.look !== null ? this.idle.look : wandering;
      rig.blink = this.blink;
      this.applyLimp(dt,animation,mode,time,body);
      // Resolve first: the strands hang off the head, and the head has just
      // picked up breathing. Then solve the hair and resolve again.
      rig.resolve();
      // Lying on the floor: the hair is resting on it, not hanging off her.
      const floored = animation === 'fall' ? clamp((phaseTime - .55) / .3, 0, 1)
        : animation === 'getup' ? clamp(1 - phaseTime / .6, 0, 1) : 0;
      this.solveHair(dt, live ? body : null, direction, floored);
      // Whatever every layer added up to, no joint goes past what a body can do.
      if (rig.clampPose) rig.clampPose();
      rig.resolve();
      this.displayPose = {...rig.pose}; this.displayOffset = [...rig.rootOffset];
      this.animation = animation;
      return rig;
    }
  }
  // Visual-only reactions: never change velocity, root position or collision bodies.
  const PAIN_PROFILES={
    heart:{label:'Dor no peito',period:2.1,base:{torso:.055,arm_near:-.4,forearm_near:-2.35,hand_near:-.1},pulse:{torso:.16,arm_near:-.14,forearm_near:-.15,hand_near:-.15,neck:-.12}},
    lungs:{label:'Falta de ar',period:2.8,base:{arm_near:.35,forearm_near:-.8,arm_far:-.5,forearm_far:-.75,neck:-.04},pulse:{torso:-.15,neck:-.12,arm_near:-.2,forearm_near:-.5,forearm_far:-.25}},
    liver:{label:'Dor abdominal',period:3.7,base:{torso:.12,arm_near:.2,forearm_near:-1.3,hand_near:-.1},pulse:{torso:.18,arm_near:.12,forearm_near:-.2,head:-.13}},
    kidneys:{label:'Dor nos flancos',period:4.2,base:{arm_near:.45,forearm_near:-1.2,arm_far:.25,forearm_far:-.35},pulse:{torso:-.12,arm_near:.2,forearm_near:-.3,neck:.08}},
    head:{label:'Dor na cabeça',period:3.1,base:{arm_near:-1.7,forearm_near:-1.65,hand_near:.1},pulse:{head:.16,neck:-.08,arm_near:-.18,forearm_near:.2,hand_near:-.2}},
    neck:{label:'Dor no pescoço',period:3.4,base:{neck:-.06,arm_near:-1.2,forearm_near:-1.8,hand_near:.15},pulse:{head:-.14,neck:.16,arm_near:-.12,forearm_near:-.2,hand_near:.15}},
    torso:{label:'Trauma no tórax',period:2.9,base:{torso:.08,arm_near:-.3,forearm_near:-2.2,forearm_far:-.4},pulse:{torso:.17,neck:-.13,arm_near:-.15,forearm_near:-.2}},
    blood:{label:'Fraqueza por perda de sangue',period:4.8,base:{torso:.07,head:.035,forearm_near:-.25},pulse:{neck:.16,arm_near:.2,forearm_near:.4,hand_far:-.12,torso:.12}}
  };
  class InjuryReaction {
    constructor(){this.active=null;this.clock=0;this.pain=null;this.painAge=0;this.painBlend=0;}
    cause(health){
      if(health.dead)return null;
      const key=health.vitalState==='agony'?'deathAt':'collapseAt';
      const episode=[...health.episodes.values()].sort((a,b)=>a[key]-b[key])[0];
      if(episode)return episode.id==='core'?['head','neck','torso'].find(n=>health.parts.get(n).hp<=0)||'torso':episode.id;
      if(health.blood<25)return 'blood';
      // Pain is a visual response to injury, not a synonym for organ failure.
      // One HUD organ hit (40 HP) must already produce a recognizable reaction.
      const organ=[...health.organs].filter(([,o])=>o.hp<=60).sort((a,b)=>a[1].hp-b[1].hp)[0];
      if(organ)return {brain:'head',heart:'heart',lung_left:'lungs',lung_right:'lungs',liver:'liver',kidney_left:'kidneys',kidney_right:'kidneys'}[organ[0]];
      const region=['head','neck','torso','abdomen'].find(name=>{const p=health.parts.get(name);return !p.missing&&(p.hp<=50||p.fracture&&!p.splinted);});
      return region==='abdomen'?'liver':region||null;
    }
    step(dt,health){
      this.clock+=dt;
      const cause=this.cause(health);
      if(cause!==this.pain){this.pain=cause;this.painAge=0;this.painBlend=0;}
      this.painAge+=dt;this.painBlend=Math.min(1,this.painBlend+dt*3);
      if(this.active){this.active.age+=dt;if(this.active.age>=this.active.duration)this.active=null;}
      const events=health.drainDamageEvents();
      if(health.dead){this.active=null;return;}
      const strongest=events.reduce((best,e)=>!best||e.severity>best.severity?e:best,null);
      if(strongest&&(!this.active||strongest.severity>this.active.severity))this.active={...strongest,age:0,duration:[0,.45,.75,1,1.3][strongest.severity]};
    }
    offsets(health){
      if(health.dead)return {};
      const result={},profile=PAIN_PROFILES[this.pain];
      if(profile){
        // Short contractions separated by recovery, rather than constant shaking.
        const phase=(this.painAge%profile.period)/profile.period;
        const wave=(at,width)=>Math.abs(phase-at)<width?Math.pow(Math.cos((phase-at)/width*Math.PI/2),2):0;
        const pulse=wave(.23,.17)+(this.pain==='heart'?.55*wave(.52,.10):this.pain==='lungs'?.35*wave(.62,.15):0);
        const agony=health.vitalState==='agony',strength=this.painBlend*(agony?1:.75);
        // The guarding pose must actually reach the injured region. Only the
        // contractions vary in amplitude; halving joint angles misses the target.
        for(const [name,value] of Object.entries(profile.base))result[name]=value*this.painBlend;
        for(const [name,value] of Object.entries(profile.pulse))result[name]=(result[name]||0)+value*pulse*strength;
        if(agony){result.hand_near=(result.hand_near||0)+Math.sin(this.painAge*13)*pulse*.045;result.forearm_far=(result.forearm_far||0)+Math.sin(this.painAge*10)*pulse*.04;}
      }
      const a=this.active;if(!a)return result;
      const phase=Math.min(1,a.age/a.duration),ease=t=>t*t*(3-2*t);
      const envelope=phase<.2?ease(phase/.2):phase<.52?1:1-ease((phase-.52)/.48);
      const strength=envelope*[0,.35,.55,.75,1][a.severity];
      let side=a.part.endsWith('far')||a.part==='eye_left'?'far':'near';
      if(health.parts.get(`arm_${side}`)?.missing)side=side==='near'?'far':'near';
      let kick={torso:.26,neck:-.12,[`arm_${side}`]:-.35,[`forearm_${side}`]:-1.1,[`hand_${side}`]:.16};
      // The far arm can be occluded by the torso in side view. Let the visible
      // arm brace as well, while the injured side still gets its own response.
      if(side==='far')kick.forearm_near=-.8;
      if(/^(head|neck|eye_)/.test(a.part))kick={torso:.08,head:-.14,arm_near:-1.45,forearm_near:-1.4};
      else if(/^(thigh_|shin_|foot_)/.test(a.part))kick={torso:.3,neck:-.15,head:-.15,forearm_near:-1.3};
      else if(['torso','abdomen','pelvis'].includes(a.part))kick={torso:.24,neck:-.1,arm_near:-.3,forearm_near:-1.8};
      // Losing the reacting limb must not erase the reaction. This bend exceeds
      // the rasterizer's rotation threshold even if both arms are absent.
      if(a.type==='sever'||a.type==='ejection')Object.assign(kick,{torso:.34,neck:-.22,head:.08});
      for(const [name,value] of Object.entries(kick))result[name]=(result[name]||0)+value*strength*(profile?.4:1);
      return result;
    }
    heldArm(name){return !!this.pain&&/^(arm_|forearm_|hand_)/.test(name);}
    applyPose(rig,health){for(const [name,angle] of Object.entries(this.offsets(health)))if(!health.parts.get(name)?.missing)rig.pose[name]=(rig.pose[name]||0)*(this.heldArm(name)?1-this.painBlend:1)+angle;}
    applyPhysical(rig,health){
      const offsets=this.offsets(health),base=new Map(rig.world),transforms=new Map();
      // Rebuild visual descendants around their parent's pivot. The physical
      // bodies remain untouched, and head + hair retain one common transform.
      const visit=name=>{
        if(transforms.has(name))return transforms.get(name);
        const w=base.get(name),bone=rig.bones?.get(name);if(!w)return null;
        if(health.parts.get(name)?.missing){transforms.set(name,w);return w;}
        let x=w.x,y=w.y,inherited=0,p=null,old=null;
        if(bone?.parent&&base.has(bone.parent)){
          p=visit(bone.parent);old=base.get(bone.parent);inherited=p.angle-old.angle;
          const c=Math.cos(inherited),s=Math.sin(inherited),dx=w.x-old.x,dy=w.y-old.y;
          x=p.x+c*dx-s*dy;y=p.y+s*dx+c*dy;
        }
        const angle=p&&this.heldArm(name)&&Object.hasOwn(offsets,name)?p.angle+(w.angle-old.angle)*(1-this.painBlend)+offsets[name]:w.angle+inherited+(offsets[name]||0);
        const out={...w,x,y,angle,c:Math.cos(angle),s:Math.sin(angle)};
        transforms.set(name,out);return out;
      };
      for(const name of base.keys())rig.world.set(name,visit(name));
    }
    snapshot(){return this.pain?{cause:this.pain,label:PAIN_PROFILES[this.pain].label,age:this.painAge}:null;}
  }
  scope.InjuryReaction=InjuryReaction;
  scope.PAIN_PROFILES=PAIN_PROFILES;
  scope.CharacterPhysics = CharacterPhysics;
  scope.CharacterMotion = CharacterMotion;
  scope.GETUP_TIME = GETUP_TIME;
  if (typeof module !== 'undefined') module.exports = {CharacterPhysics, CharacterMotion, InjuryReaction, PAIN_PROFILES, GETUP_TIME, HairSway};
})(globalThis);
