"""Bandages: the body wrapped from the neck down, hands and feet left free.

A garment slot that goes **under** everything else. The others are painted over
the skin of the bone they hang on; these are painted over the skin too, but half
a step lower, so a shirt or a cloak worn on top covers them exactly as cloth
covers a dressing underneath.

The wrap is not a drawing of its own: it is generated from each body part's own
silhouette, so it follows the limb it is on, ends where the limb ends, and moves
with it without any extra rigging. What it adds is the banding — a strip of
cloth going round and round a limb, seen from the side, is a run of soft bands
separated by the shaded line where each turn laps over the last.
"""
from PIL import Image

SIZE = (64, 96)

# Linen, darkest to lightest. Four tones: the lap line, the shaded side of each
# turn, the cloth itself and the edge catching the light.
RAMP = ['wrap_deep', 'wrap_shadow', 'wrap', 'wrap_light']
# A fifth, used sparingly: old cloth that is not quite clean any more.
STAIN = 'wrap_stain'

# Everything below the jaw. Hands and feet stay bare, which is the whole read:
# without them the character is a mummy rather than someone bandaged.
COVERS = ['neck', 'torso', 'abdomen', 'pelvis',
          'arm_near', 'forearm_near', 'arm_far', 'forearm_far',
          'thigh_near', 'shin_near', 'thigh_far', 'shin_far']

# How far apart the turns of the bandage sit, and how much they lean. A strip
# wound round a limb never sits square to it, and bands drawn dead level read as
# a striped jumper rather than as something wound on.
PITCH = 3.0
TILT = .12
# Where the lap line falls inside each turn, and how wide it is.
LAP = .34
SLOT = 'wraps'
# Half a step above the bone it is painted on, so it covers that bone's skin and
# nothing else: every other garment sits a full half step up and stays on top.
Z_OFFSET = .25


def tone(index):
    return RAMP[max(0, min(len(RAMP) - 1, index))]


def wrap_part(part, name, rgba):
    """Paint one body part as bandaged cloth, following its own silhouette."""
    out = Image.new('RGBA', SIZE)
    canvas = out.load()
    source = part.load()
    rows = {}
    for y in range(SIZE[1]):
        columns = [x for x in range(SIZE[0]) if source[x, y][3]]
        if columns: rows[y] = (columns[0], columns[-1])
    if not rows: return out
    top = min(rows)
    for y, (left, right) in rows.items():
        width = max(1, right - left)
        for x in range(left, right + 1):
            if not source[x, y][3]: continue
            # Round the limb: the light comes from the upper left, so the near
            # edge of every turn is lit and the cloth falls away across it.
            across = (x - left) / width
            level = 3.1 - across * 1.7
            """The turns. The phase is taken from the sheet's own coordinates,
               not from each row's left edge: a strip wound round a body is one
               continuous thing, so the bands have to line up from the arm to
               the ribs to the hip. Measuring from an edge that moves row by row
               is what turned them into mottling."""
            turn = (y + x * TILT) / PITCH
            phase = turn - int(turn)
            if phase < LAP: level -= 1.6           # where the turn laps over
            elif phase > 1 - LAP: level += .35     # and the edge that catches light
            key = tone(round(level))
            # Selective outline, so a bandaged limb still reads as a limb.
            if x == left: key = tone(1)
            if x == right: key = tone(0)
            # A little wear, on turns facing away from the light. Rare on
            # purpose: cloth dirty everywhere reads as a dirty colour, cloth
            # dirty in places reads as cloth.
            if key == tone(1) and (int(turn) * 5 + x) % 37 == 0: key = STAIN
            canvas[x, y] = rgba[key]
    return out


def build(out_dir, parts, palette_names, palette_hex):
    """Write one PNG per wrapped part and return the outfit records."""
    index = {n: i for i, n in enumerate(palette_names)}
    rgba = {n: tuple(bytes.fromhex(palette_hex[index[n]][1:])) + (255,) for n in index}
    (out_dir / 'outfits/wraps').mkdir(parents=True, exist_ok=True)
    records = []
    for name in COVERS:
        part = parts.get(name)
        if part is None: continue
        image = wrap_part(part, name, rgba)
        if not image.getbbox(): continue
        image.save(out_dir / f'outfits/wraps/{name}.png')
        records.append(dict(name=f'wraps_{name}', bone=name, slot=SLOT,
                            image=f'outfits/wraps/{name}.png', bounds=image.getbbox()))
    return records
