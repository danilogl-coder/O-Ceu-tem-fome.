"""Contact sheet of the item-use audit: one frame per region x item x arm case,
blown up 4x, the item as a red mark, the case named above each.
    python pixel_art/tools/audit_treatment_sheet.py [audit_dir] [case ...]
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'generated' / 'audit_treatment'
only = sys.argv[2:] or None
report = json.loads((SRC / 'report.json').read_text())
S = 4
rows = [r for r in report if not only or r['case'] in only]
per_row = 19
w, h = 64 * S, 96 * S + 14
n_rows = (len(rows) + per_row - 1) // per_row
img = Image.new('RGB', (w * per_row, h * n_rows), '#d9dde4')
d = ImageDraw.Draw(img)
for n, r in enumerate(rows):
    raw = (SRC / f"t_{r['i']:03}.rgba").read_bytes()
    im = Image.frombytes('RGBA', (64, 96), raw).resize((64 * S, 96 * S), Image.Resampling.NEAREST)
    ox, oy = (n % per_row) * w, (n // per_row) * h
    img.paste(im, (ox, oy + 14), im)
    d.line([(ox, oy + 14 + 76 * S), (ox + w, oy + 14 + 76 * S)], fill='#7d8a72', width=1)
    s = r['samples'][2]
    bad = 'X' if s['bad'] else ''
    d.text((ox + 2, oy + 1), f"{r['case'][:7]} {r['def'][:4]} {r['region']} {bad}", fill='#282c58')
out = SRC / 'sheet.png'
img.save(out)
print(out, img.size)
