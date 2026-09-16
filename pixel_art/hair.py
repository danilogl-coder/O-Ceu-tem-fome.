"""Refined hair: hand-authored native clusters on exactly two layers.

`hair_back` is the whole head of hair, painted solid, drawn behind the body.
`hair_front` is the part that has to sit in front — the fringe over the face and
the lock that falls across the arm — and every one of its pixels is also painted
into `hair_back` underneath. Two layers with full overlap instead of many parts
that abut: parts that abut open a one pixel seam the moment they move by
different amounts, which is what made pixels blink along the hairline and down
the mass. Nothing here can open a seam, because there is no seam.

Movement is not a chain of rigid parts either. `motion.js` simulates a strand and
hands the rasteriser one horizontal and vertical offset per screen row, so each
row is a whole translated copy of a row of the source. No pixel can be dropped.

Coordinates are canvas pixels on the shared 64x96 sheet (the reference origin is
19,20). Every tone is an index into `palette.json`; nothing is blended, resized
or antialiased, and alpha stays binary.
"""
from PIL import Image

SIZE = (64, 96)

# Tones, darkest to lightest. Light reads from the top left and front, so every
# row runs light on the outer face and sinks to dark on the body-facing side.
# The mass is deliberately NOT ringed by an outline: a contour on the inner edge
# reads as a rope or a braid instead of a full head of hair.
TONE = {'0': 0,    # outline      #230521
        '1': 17,   # deep shadow  #3a1236
        '2': 1,    # shadow       #471e41
        '3': 2,    # mid          #66296c
        '4': 18}   # light        #8b3f96

# Each entry is (first x, tone string). Rows 20..32 are the crown and the lock
# beside the cheek; 33..48 are the falling mass.
#
# The hairline pulls back to x30 by row 27 and the cheek lock sits at x37. The
# eyes are at x32-33 and x35-36 on row 27, so both stay completely clear: a
# fringe that clips an eye costs the character its expression.
ART = {
    20: [(30, '00000')],
    21: [(29, '0222220')],
    22: [(28, '02332210')],
    23: [(27, '02433221'), (36, '20')],
    24: [(27, '0233221'), (36, '20')],
    25: [(27, '032211'), (37, '20')],
    26: [(27, '03221'), (37, '30')],
    27: [(26, '02221'), (37, '20')],
    28: [(26, '03221'), (37, '20')],
    29: [(26, '02221'), (37, '10')],
    30: [(25, '023221'), (36, '20')],
    31: [(24, '0232211'), (35, '20')],
    32: [(24, '022211'), (34, '10')],
    33: [(23, '2322110')],
    34: [(22, '2342110')],
    35: [(21, '2332210')],
    36: [(20, '0233211')],
    37: [(19, '23322110')],
    38: [(19, '02322110')],
    39: [(18, '023322110')],
    40: [(19, '2322110')],
    41: [(19, '0232110')],
    42: [(19, '2322110')],
    43: [(18, '02332110')],
    44: [(19, '2232110')],
    45: [(19, '0222110')],
    46: [(19, '022110')],
    47: [(20, '02110')],
    48: [(21, '010')],
}

# Leftmost column of `head.png` per row: at or right of it the hair has to draw
# over the face, so those pixels belong to the rigid fringe.
FRINGE_FROM = {20: 30, 21: 30, 22: 32, 23: 30, 24: 30, 25: 29, 26: 29,
               27: 30, 28: 30, 29: 30, 30: 31, 31: 31, 32: 30}
CROWN_ROWS = range(20, 33)

# The back hair is one solid body. Nothing thin or free floating hangs off it:
# a one or two pixel strand standing on its own breaks into specks as soon as
# neighbouring rows slide past each other, which is what was blinking.
#
# This art is approved and is not to be adjusted to make anything else easier.
# The cheek lock is two pixels wide and the gap beside it one, which a rigid
# bitmap cannot survive being rotated far — so the rasteriser thickens thin
# clusters while it turns them (Skeleton2D.rasterize) instead of the drawing
# being thickened here. Rotation is the renderer's problem, not the artist's.

# The simulated strand, as bind positions on the sheet. These are not bones: the
# solver moves them and the rasteriser reads a per-row offset off the curve, so
# the hair bends as one image instead of hinging at part boundaries.
SWAY = dict(
    name='mass',
    anchor='head',
    joints=[[25, 34], [22, 40], [22, 45], [23, 48]],
    links=['mid', 'tail', 'tip'],
)

# Rows of `head.png` that carry the eyes, and the columns they occupy. The build
# asserts the hair leaves them alone.
EYES = {27: [32, 33, 35, 36]}

# name, parent, z, pivot, end
LAYERS = [
    ('hair_back',  'head', -2, (32, 30), (25, 34)),
    ('hair_front', 'head', 19, (33, 32), (33, 24)),
]


def pixels():
    """ART expanded to {(x, y): palette index}."""
    out = {}
    for y, spans in ART.items():
        for x0, tones in spans:
            for i, ch in enumerate(tones):
                out[(x0 + i, y)] = TONE[ch]
    return out


def in_front(x, y):
    """True where the hair has to draw over the body rather than behind it.

    Only the crown: the fringe over the forehead and the lock beside the cheek.
    Everything below the jaw stays behind the body, where it cannot clip.
    """
    return y in CROWN_ROWS and x >= FRINGE_FROM[y]


def enclosed(image):
    """Transparent pixels with no path to the edge, i.e. holes in the drawing."""
    width, height = image.size
    alpha = image.load()
    outside = set()
    stack = [(x, y) for x in range(width) for y in (0, height - 1)]
    stack += [(x, y) for y in range(height) for x in (0, width - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in outside or alpha[x, y][3]: continue
        outside.add((x, y))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + dx < width and 0 <= y + dy < height: stack.append((x + dx, y + dy))
    return [(x, y) for y in range(height) for x in range(width)
            if not alpha[x, y][3] and (x, y) not in outside]


def build(parts, bones, palette):
    """Replace the hair with two fully overlapping layers plus its sway curve."""
    rgba = [tuple(bytes.fromhex(c[1:])) + (255,) for c in palette]
    art = pixels()
    bones = [b for b in bones if not b['name'].startswith('hair_')]
    for name in [n for n in parts if n.startswith('hair_')]:
        del parts[name]

    # The anchor itself joins the unit, so the face and the hair are sampled by
    # one identical transform and can never separate.
    for bone in bones:
        if bone['name'] == SWAY['anchor']: bone['anchor'] = SWAY['anchor']
    for name, parent, z, pivot, end in LAYERS:
        image = Image.new('RGBA', SIZE)
        canvas = image.load()
        for (x, y), tone in art.items():
            # hair_back carries every authored pixel; hair_front repeats the
            # ones that must cover the body, so no edge is ever unbacked.
            if name == 'hair_front' and not in_front(x, y):
                continue
            canvas[x, y] = rgba[tone]
        assert image.getbbox(), f'{name}: empty hair layer'
        # The rasteriser fills any pixel a rotation walls in, on the grounds
        # that the drawing never walls one in itself. That has to stay true.
        assert not enclosed(image), f'{name}: the drawing walls in a transparent pixel'
        if name == 'hair_front':
            for y, columns in EYES.items():
                covered = [x for x in columns if canvas[x, y][3]]
                assert not covered, f'hair_front covers the eyes at row {y}: {covered}'
        bones.append(dict(name=name, parent=parent, pivot=list(pivot), end=list(end),
                          z=z, image=f'parts/{name}.png', bounds=image.getbbox(),
                          sway=SWAY['name'], anchor=SWAY['anchor']))
        parts[name] = image
    return parts, bones
