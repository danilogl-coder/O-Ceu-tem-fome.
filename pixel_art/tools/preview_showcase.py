"""GIFs from the showcase frames: python pixel_art/tools/preview_showcase.py"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'generated'
SRC = OUT / 'showcase'
for name, scale in [('roupas', 3), ('clipes', 3), ('peles', 3)]:
    paths = sorted(SRC.glob(f'{name}_*.rgba'))
    if not paths:
        continue
    frames = []
    for path in paths:
        im = Image.frombytes('RGBA', (64, 96), path.read_bytes()).crop((8, 12, 56, 80))
        frame = Image.new('RGB', im.size, '#dce0e6'); frame.paste(im, (0, 0), im)
        frames.append(frame.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST))
    frames[0].save(OUT / f'{name}.gif', save_all=True, append_images=frames[1:], duration=33, loop=0, optimize=False)
    print(f'{name}.gif: {len(frames)} frames')

# A contact sheet of every outfit, one frame each, mid-walk: the sets on
# the first row, the characters from the reference sheets on the second.
import json
paths = sorted(SRC.glob('roupas_*.rgba'))
labels_file = SRC / 'labels.json'
if paths and labels_file.exists():
    names = json.loads(labels_file.read_text())
    per = len(paths) // len(names)
    cols = 13
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new('RGB', (48 * 4 * cols + 10, (68 * 4 + 24) * rows), '#dce0e6')
    d = ImageDraw.Draw(sheet)
    for i, name in enumerate(names):
        p = paths[i * per + per // 2]
        im = Image.frombytes('RGBA', (64, 96), p.read_bytes()).crop((8, 12, 56, 80)).resize((192, 272), Image.Resampling.NEAREST)
        x, y = (i % cols) * 192 + 5, (i // cols) * (68 * 4 + 24)
        sheet.paste(im, (x, y + 20), im)
        d.text((x + 3, y + 4), name, fill='#282c58')
    sheet.save(OUT / 'roupas_contact_sheet.png')
    print('roupas_contact_sheet.png')
