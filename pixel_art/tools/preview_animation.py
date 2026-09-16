from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'generated'
for mode in ['rest','idle','walk','jump']:
    frames=[]
    for path in sorted((OUT/'animation').glob(f'{mode}_*.rgba')):
        im=Image.frombytes('RGBA',(64,96),path.read_bytes())
        im.save(path.with_suffix('.png'))
        frame=Image.new('RGB',(64,96),'#dce0e6');frame.paste(im,(0,0),im)
        frames.append(frame.resize((256,384),Image.Resampling.NEAREST))
    frames[0].save(OUT/f'{mode}.gif',save_all=True,append_images=frames[1:],duration=[20,20,10]*16,loop=0,optimize=False)
    sheet=Image.new('RGB',(64*8,112),'#dce0e6');d=ImageDraw.Draw(sheet)
    for j,i in enumerate(range(0,48,6)):
        im=Image.open(OUT/'animation'/f'{mode}_{i:02}.png')
        sheet.paste(im,(j*64,12),im);d.text((j*64+4,1),str(i),fill='#282c58')
    sheet.resize((1024,224),Image.Resampling.NEAREST).save(OUT/f'{mode}_contact_sheet.png')
# The two traced clips. Fifteen drawings each, one per reference frame, rendered
# as the game plays them — hair simulated, breathing running. Frames come from
# tools/render_clips.js.
clips = OUT/'clips'
for mode, duration in [('run', 66), ('fall', 90), ('fallcycle', 33), ('cloak', 33)]:
    paths = sorted(clips.glob(f'{mode}_*.rgba')) if clips.exists() else []
    if not paths: continue
    frames = []
    for path in paths:
        im = Image.frombytes('RGBA', (64, 96), path.read_bytes())
        im.save(path.with_suffix('.png'))
        frame = Image.new('RGB', (64, 96), '#dce0e6'); frame.paste(im, (0, 0), im)
        frames.append(frame.resize((192, 288), Image.Resampling.NEAREST))
    frames[0].save(OUT/f'{mode}.gif', save_all=True, append_images=frames[1:],
                   duration=duration, loop=0, optimize=False)
    if mode in ('fallcycle', 'cloak'): continue
    # All fifteen drawings side by side, at native size, nothing resampled but
    # the final nearest-neighbour blow-up.
    sheet = Image.new('RGB', (64*15, 112), '#dce0e6'); d = ImageDraw.Draw(sheet)
    for i, path in enumerate(paths):
        im = Image.open(path.with_suffix('.png'))
        sheet.paste(im, (i*64, 12), im); d.text((i*64+4, 1), str(i+1), fill='#282c58')
    sheet.resize((64*15*2, 224), Image.Resampling.NEAREST).save(OUT/f'{mode}_contact_sheet.png')
    print(f'Rendered {mode}.gif and its contact sheet from {len(frames)} drawings')

# The clip GIFs above hold the hair rigid, because setAnimation is the base
# pose. These come from tests/motion.test.js, which runs the hair simulation.
physics = sorted((OUT/'motion').glob('play_*.rgba'))
if physics:
    for mode, name in [('play', 'hair_physics'), ('rest', 'hair_rest')]:
        paths = sorted((OUT/'motion').glob(f'{mode}_*.rgba'))[::2]
        if not paths: continue
        frames = []
        for path in paths:
            im = Image.frombytes('RGBA', (64, 96), path.read_bytes())
            frame = Image.new('RGB', (64, 96), '#dce0e6'); frame.paste(im, (0, 0), im)
            frames.append(frame.resize((192, 288), Image.Resampling.NEAREST))
        frames[0].save(OUT/f'{name}.gif', save_all=True, append_images=frames[1:],
                       duration=84, loop=0, optimize=False)
    print('Rendered hair physics GIFs from the simulated motion frames')
# The idle life layer: breathing, weight, blinking, eyes and the gestures.
# Frames come from tools/render_life.js.
life = sorted((OUT/'life').glob('idle_*.rgba')) if (OUT/'life').exists() else []
if life:
    frames = []
    for path in life:
        im = Image.frombytes('RGBA', (64, 96), path.read_bytes())
        frame = Image.new('RGB', (64, 96), '#dce0e6'); frame.paste(im, (0, 0), im)
        frames.append(frame.resize((192, 288), Image.Resampling.NEAREST))
    frames[0].save(OUT/'idle_life.gif', save_all=True, append_images=frames[1:],
                   duration=33, loop=0, optimize=False)
    print(f'Rendered idle_life.gif from {len(frames)} frames')
else:
    print('No simulated frames yet: run node tests/motion.test.js for the hair GIFs')
print('Rendered animation GIFs and contact sheets with nearest neighbor')
