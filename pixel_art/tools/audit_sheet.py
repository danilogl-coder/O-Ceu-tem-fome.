"""Contact sheets for the animation audit: every frame blown up 6x with the
skeleton drawn over it and the joint angles printed underneath, so anything a
body cannot do is visible at a glance and measurable.
    python pixel_art/tools/audit_sheet.py [audit_dir] [clip ...]
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'generated' / 'audit'
clips = sys.argv[2:] or None
report = json.loads((SRC / 'report.json').read_text())
S = 6
CHAIN = [('root','pelvis'),('pelvis','thigh_near'),('thigh_near','shin_near'),('shin_near','foot_near'),
         ('pelvis','thigh_far'),('thigh_far','shin_far'),('shin_far','foot_far'),
         ('root','abdomen'),('abdomen','torso'),('torso','neck'),('neck','head'),
         ('torso','arm_near'),('arm_near','forearm_near'),('forearm_near','hand_near'),
         ('torso','arm_far'),('arm_far','forearm_far'),('forearm_far','hand_far')]
ENDS = {'foot_near':(30,75),'foot_far':(39,75),'hand_near':(24,54),'hand_far':(35,54),'head':(33,24)}
PIV = {'foot_near':(27,72),'foot_far':(35,72),'hand_near':(25,50),'hand_far':(35,50),'head':(33,32)}

def sheet(clip, frames, per_row=8):
    first = SRC / f'{clip}_000.rgba'
    if not first.exists():
        return
    size = (144, 144) if clip == 'ragdoll' else (64, 96)
    w, h = size[0] * S, size[1] * S + 92
    rows = (len(frames) + per_row - 1) // per_row
    img = Image.new('RGB', (w * per_row, h * rows), '#d9dde4')
    d = ImageDraw.Draw(img)
    for n, f in enumerate(frames):
        raw = (SRC / f'{clip}_{n:03}.rgba').read_bytes()
        im = Image.frombytes('RGBA', size, raw).resize((size[0] * S, size[1] * S), Image.Resampling.NEAREST)
        ox, oy = (n % per_row) * w, (n // per_row) * h
        img.paste(im, (ox, oy), im)
        # baseline
        if clip != 'ragdoll':
            d.line([(ox, oy + 76 * S), (ox + w, oy + 76 * S)], fill='#7d8a72', width=1)
        if 'world' in f:
            W = f['world']
            def pt(name):
                x, y, _ = W[name]; return (ox + x * S, oy + y * S)
            for a, b in CHAIN:
                col = '#2c6fb0' if b.endswith('far') else '#c0392b'
                d.line([pt(a), pt(b)], fill=col, width=2)
            for name, end in ENDS.items():
                x, y, ang = W[name]; px, py = PIV[name]
                import math
                dx, dy = end[0] - px, end[1] - py
                ex = x + math.cos(ang) * dx - math.sin(ang) * dy
                ey = y + math.sin(ang) * dx + math.cos(ang) * dy
                d.line([pt(name), (ox + ex * S, oy + ey * S)], fill='#2c6fb0' if name.endswith('far') else '#c0392b', width=2)
            for name in W:
                x, y = pt(name); d.ellipse([x - 2, y - 2, x + 2, y + 2], fill='#111')
        j = f['joints']
        label = f"{clip} {n}" + (f" d{f['drawing']+1}" if 'drawing' in f else '') + (f" {f.get('animation','')} t={f.get('t','')} f={f.get('facing','')}" if clip == 'play' else '') + (f" {f.get('phase','')}" if clip == 'ragdoll' else '')
        d.text((ox + 3, oy + size[1] * S + 2), label, fill='#1b1f2a')
        lines = [
            f"sho {j['shoulder_near']:>4}/{j['shoulder_far']:<4} elb {j['elbow_near']:>4}/{j['elbow_far']:<4} wri {j['wrist_near']:>3}/{j['wrist_far']:<3}",
            f"hip {j['hip_near']:>4}/{j['hip_far']:<4} kne {j['knee_near']:>4}/{j['knee_far']:<4} ank {j['ankle_near']:>3}/{j['ankle_far']:<3}",
            f"neck {j['neck']:>3} waist {j['waist']:>3}" + (f" root {j['root']} torsoW {j['torsoWorld']} headW {j['headWorld']}" if 'root' in j else ''),
        ]
        for k, line in enumerate(lines):
            d.text((ox + 3, oy + size[1] * S + 16 + k * 13), line, fill='#1b1f2a')
    img.save(SRC / f'sheet_{clip}.png')
    print(clip, len(frames), img.size)

for clip, frames in report.items():
    if clips and clip not in clips:
        continue
    sheet(clip, frames)
