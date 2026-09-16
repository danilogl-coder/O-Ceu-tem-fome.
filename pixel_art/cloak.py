"""The hooded cloak: a garment slot of its own, drawn over everything else.

Two layers. `cloak_hood` is welded to the head, the way the hair is, so the
hood turns with it and can never slip a pixel against the face. `cloak_body`
hangs off the chest and is simulated: it carries its own sway curve, with its
own stiffness and its own drag, so it swings on a rhythm that is nothing to do
with the hair's or with the clip being played.

The shape is built procedurally — a silhouette per row, then folds, then the
light — because a cloak is a surface, and a surface wants to be shaded by a
rule that knows where its planes face rather than by a thousand typed pixels.
Everything below is in canvas pixels on the shared 64x96 sheet.
"""
from PIL import Image

mix = lambda a, b, t: a + (b - a) * t

SIZE = (64, 96)

# Palette keys, darkest to lightest, plus the lining the cloth shows when it
# turns over at an edge.
RAMP = ['cloak_deep', 'cloak_shadow', 'cloak', 'cloak_light', 'cloak_glow']
LINING = ['cloak_lining', 'cloak_lining_light']

# Light comes from the upper left and front, as everywhere else in this sprite.
# On a cloak that means: the left flank is the lit plane, the right flank turns
# away into the body's own shadow, and every fold has a lit ridge with a dark
# crease down its right side.

# --- Hood -------------------------------------------------------------------
# Outer silhouette per row. The inner edge is not given here: it is read off the
# head's own drawing at build time, so the hood always sits directly against the
# face. Naming both edges by hand is what left a pixel of daylight between the
# brim and the cheek — the two were free to disagree, and they did.
HOOD_LEFT = {18: 30, 19: 28, 20: 26, 21: 25, 22: 24, 23: 24, 24: 23, 25: 23,
             26: 23, 27: 23, 28: 23, 29: 23, 30: 23, 31: 24, 32: 25}
# Right edge only for the rows above the opening; below them it is the face's
# own edge plus the brim, so the brim is the same thickness all the way down.
HOOD_CLOSED = {18: 34, 19: 36, 20: 37, 21: 38, 22: 38}
# Rows where the hood opens for the face. Above these it closes over the skull.
HOOD_OPENS = 23
# Pixels of brim standing in front of the face. Two: one for the inside of the
# opening, which is the deepest shade on the sprite, and one for the edge
# itself. Three read as a bar of black stood next to her cheek.
BRIM = 2
# Where the light lands on the crown: (x0, y0, x1, y1). One cluster, not a
# scatter of bright pixels — a sheen has a shape.
HIGHLIGHT = (27, 19, 29, 20)

# --- Cloak body -------------------------------------------------------------
# Left and right edge per row: it leaves the shoulders narrow, flares as the
# cloth falls away from the body and draws back in at the hem, which sits at
# mid thigh. The back edge sweeps further than the front, because a cloak hangs
# behind the person wearing it.
BODY = {
    31: (29, 38), 32: (28, 39), 33: (27, 39), 34: (26, 40), 35: (26, 40),
    36: (25, 41), 37: (25, 41), 38: (24, 41), 39: (24, 41), 40: (23, 41),
    41: (23, 41), 42: (22, 41), 43: (22, 41), 44: (21, 40), 45: (21, 40),
    46: (21, 40), 47: (20, 40), 48: (20, 40), 49: (20, 39), 50: (19, 39),
    51: (19, 39), 52: (19, 38), 53: (19, 38), 54: (19, 37), 55: (20, 36),
    56: (20, 34), 57: (21, 31), 58: (23, 28),
}

# Folds, each given as the column it sits in at the shoulder and at the hem, so
# they fan out with the cloth instead of running down it like stripes. Depth is
# how hard the crease cuts, and `from_row` keeps the shorter ones from starting
# at the shoulder — cloth does not crease evenly all the way up.
FOLDS = [
    (29, 22, 3.2, 35),   # the deep one falling behind the shoulder
    (33, 28, 2.4, 33),   # the spine of the drape
    (37, 34, 3.0, 38),   # the turn towards the front edge
]

# The hood's own shadow on the shoulders below it: columns, and the row it has
# faded out by.
SHADE = (23, 39)
SHADE_TO = 36

# Where the cloth turns over and shows its lining: the front edge below the
# waist, where the cloak falls open, and all along the hem.
LINING_FROM = 53

# The simulated strand, as bind positions on the sheet. Not bones: the solver
# moves these and the rasteriser reads one offset per screen row off the curve,
# so the cloak bends as one image and cannot open a seam inside itself.
SWAY = dict(
    name='cape',
    anchor='torso',
    joints=[[32, 35], [31, 43], [30, 51], [29, 58]],
    links=['shoulder', 'skirt', 'hem'],
)

# name, bone, z. The z is what puts the cloak over every other layer instead of
# only over the one bone it hangs from.
LAYERS = [
    ('cloak_body', 'torso', 30),
    ('cloak_hood', 'head', 31),
]
SLOT = 'cloak'


def tone(index):
    """Clamp to the ramp so shading maths can run off either end safely."""
    return RAMP[max(0, min(len(RAMP) - 1, index))]


def hood_pixels(face):
    """{(x, y): palette key} for the hood.

    `face` is the head drawing's own span per row. Both the inner edge and the
    outer edge below the crown are taken from it, so hood and head are
    neighbours by construction and the brim keeps one thickness all the way
    down. Naming both edges by hand is what left a pixel of daylight between the
    brim and the cheek: the two were free to disagree, and they did.

    A hood is a ball of cloth, so the shade follows the distance from the light
    rather than the distance from the outline — shading along an edge is pillow
    shading, and on a hood it comes out as a doughnut.
    """
    out = {}
    rows = sorted(HOOD_LEFT)
    top, bottom = rows[0], rows[-1]
    for y in rows:
        x0 = HOOD_LEFT[y]
        opening = (face[y][0] + 1, face[y][1]) if y >= HOOD_OPENS and y in face else None
        x1 = opening[1] + BRIM if opening else HOOD_CLOSED[y]
        dome_to = (opening[0] - 1) if opening else x1
        for x in range(x0, x1 + 1):
            if opening and opening[0] <= x <= opening[1]: continue
            if opening and x > opening[1]:
                # The brim. Its inside is the deepest thing on the sprite, which
                # is what makes the face read as sitting down inside a hood; its
                # edge catches what light reaches round the front.
                key = tone(0) if x == opening[1] + 1 else tone(2 if y < top + 7 else 1)
            else:
                """The dome: one clean ramp from the lit back edge round to the
                   shade beside the face. Eight pixels is not room for a crease
                   as well — a valley cut into a ramp this short reads as a line
                   drawn on the cloth, not as cloth. What it is room for is one
                   highlight where the light actually lands, which is the corner
                   the light comes from."""
                across = (x - x0) / max(1, dome_to - x0)
                down = (y - top) / (bottom - top)
                level = 3.8 - across * 3.0 - down * .8
                key = tone(round(level))
                # The sheen on the crown, and a rim against the dark hair behind.
                if HIGHLIGHT[0] <= x <= HIGHLIGHT[2] and HIGHLIGHT[1] <= y <= HIGHLIGHT[3]:
                    key = tone(4)
                if x == x0 and y < top + 9: key = tone(min(4, round(level) + 1))
                # One pixel of shade inside the opening, and no more.
                if opening and x == opening[0] - 1: key = tone(0)
            out[(x, y)] = key
    return out


def body_pixels():
    """{(x, y): palette key} for the hanging cloak.

    Big planes first, folds second. At twenty pixels across there is no room to
    describe cloth by drawing every crease in it: what has to read is the shape
    of the light — one lit plane where the drape faces the sky, one mid plane,
    one dark plane where it turns towards the body — and only then two or three
    creases cutting across them as accents. Five even folds is corrugated iron.

    The plane boundaries lean with the drape rather than running straight down,
    which is what makes the cloak read as a cone hanging off a pair of shoulders
    instead of as a bell.
    """
    out = {}
    rows = sorted(BODY)
    top, bottom = rows[0], rows[-1]
    for y in rows:
        x0, x1 = BODY[y]
        width = max(1, x1 - x0)
        down = (y - top) / (bottom - top)
        # The two plane boundaries, as a fraction across, sliding forward as the
        # cloth falls away from the shoulder.
        lit_edge = mix(.26, .40, down)
        dark_edge = mix(.52, .66, down)
        creases = [(round(mix(cx_top, cx_hem, down)), depth, from_row)
                   for cx_top, cx_hem, depth, from_row in FOLDS]
        for x in range(x0, x1 + 1):
            across = (x - x0) / width
            # The plane the cloth sits on, before any fold: lit where the drape
            # faces the sky on the back and shoulder, sinking as it turns round
            # towards the front, and deeper again at the hem where less light
            # reaches and the cloth bunches.
            level = 3.6 - across * 2.0 - (down ** 1.6) * .9
            """A fold is a ridge and a valley, not a line. At twenty pixels
               across, a one pixel crease disappears and what is left is a flat
               sheet, so each fold gets two pixels of lit ridge and two of dark
               valley — three of those read as cloth; five one pixel creases
               read as corrugated iron."""
            for cx, depth, from_row in creases:
                if y < from_row - 1: continue
                fade = 1 if y >= from_row + 2 else .55
                offset = x - cx
                if offset == 0 or offset == 1: level -= depth * fade
                elif offset == -1: level += 1.5 * fade
                elif offset == -2: level += .8 * fade
                elif offset == 2: level -= .6 * fade
            key = tone(round(level))
            """The hood sits on these shoulders and blocks the sky from
               them: a contact shadow, fading over four rows. Without it the
               cape's lit shoulder runs as a bright band right under the hood's
               dark underside, and the two read as separate objects stacked
               rather than as one garment."""
            if SHADE_TO > y >= top and SHADE[0] <= x <= SHADE[1]:
                level -= mix(1.8, 0, (y - top) / (SHADE_TO - top))
                key = tone(round(level))
            # The top of the shoulder is the one plane still facing the sky.
            elif y <= top + 1 and across < .5: key = tone(3)
            # Selective outline: a rim where the cloak is seen against the sky,
            # the darkest step where it turns away from the light.
            if x == x0: key = tone(3 if y < top + 7 else 2 if y < top + 15 else 0)
            if x == x1: key = tone(0)
            out[(x, y)] = key
        # The cloth turns over along the hem, and the lining — warm, and lit by
        # nothing the outside ever sees — shows on that turn. Only there: all
        # the way round the silhouette it would read as a red border.
    hem = [(y, BODY[y][1]) for y in rows if y >= LINING_FROM]
    for y, x1 in hem:
        step = max(1, x1 - BODY[min(y + 1, bottom)][1])
        for k in range(step + 1):
            x = x1 - k
            if (x, y) in out and x > BODY[y][0] + 1:
                out[(x, y)] = LINING[1] if (x + y) % 3 == 0 else LINING[0]
        if (x1, y) in out: out[(x1, y)] = tone(0)
    for x in range(BODY[bottom][0] + 1, BODY[bottom][1]):
        out[(x, bottom)] = LINING[1] if (x + bottom) % 3 == 0 else LINING[0]
    return out


def enclosed(image):
    """Transparent pixels with no path to the edge — holes in the drawing."""
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


def spans(image):
    """First and last opaque column of a drawing, per row."""
    width, height = image.size
    alpha = image.load()
    out = {}
    for y in range(height):
        columns = [x for x in range(width) if alpha[x, y][3]]
        if columns: out[y] = (columns[0], columns[-1])
    return out


def build(out_dir, palette_names, palette_hex, head=None):
    """Write the two PNGs and return the outfit records plus the sway spec.

    `head` is the head part's drawing; the hood's inner edge is read off it.
    """
    face = spans(head if head is not None else Image.open(out_dir / 'parts/head.png'))
    index = {name: i for i, name in enumerate(palette_names)}
    rgba = {name: tuple(bytes.fromhex(palette_hex[index[name]][1:])) + (255,) for name in index}
    records = []
    for name, bone, z in LAYERS:
        art = hood_pixels(face) if name == 'cloak_hood' else body_pixels()
        image = Image.new('RGBA', SIZE)
        canvas = image.load()
        for (x, y), key in art.items(): canvas[x, y] = rgba[key]
        assert image.getbbox(), f'{name}: empty layer'
        assert not enclosed(image), f'{name}: the drawing walls in a transparent pixel'
        if name == 'cloak_hood':
            # Nothing may show through between the hood and the head. Both edges
            # come off the same drawing now, so this cannot drift apart — which
            # is the point of checking it here, at the build, rather than
            # discovering a pixel of daylight beside her cheek in the game.
            canvas = image.load()
            for y, (left, right) in spans(image).items():
                if y not in face: continue
                for x in range(left, right + 1):
                    if canvas[x, y][3]: continue
                    assert face[y][0] <= x <= face[y][1], \
                        f'the hood leaves a hole at {x},{y} — the head does not reach it'
        (out_dir / f'outfits/cloak').mkdir(parents=True, exist_ok=True)
        image.save(out_dir / f'outfits/cloak/{name}.png')
        record = dict(name=name, bone=bone, slot=SLOT, z=z,
                      image=f'outfits/cloak/{name}.png', bounds=image.getbbox())
        if name == 'cloak_body':
            record['sway'] = SWAY['name']
            record['drift'] = 'cloak'
            """Long hair goes inside a hood and arms go inside a cloak. The
               fringe stays, because that is what you see of someone wearing
               one; the mass down the back and the arms would otherwise swing
               out through the cloth, and a hand crossing in front of a cloak
               reads as a hand with nothing attached to it."""
            record['covers'] = ['hair_back',
                                'arm_near', 'forearm_near', 'hand_near',
                                'arm_far', 'forearm_far', 'hand_far']
        records.append(record)
    return records
