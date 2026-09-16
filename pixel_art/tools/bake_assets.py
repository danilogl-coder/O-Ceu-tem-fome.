"""Embed authoritative PNG pixels so index.html also works from file://."""
from pathlib import Path
from PIL import Image
import json

ROOT=Path(__file__).resolve().parents[1]
rig=json.loads((ROOT/'generated/rig.json').read_text())
palette=[(0,0,0,0)]+[tuple(bytes.fromhex(c[1:]))+(255,) for c in rig['palette']]
rig['rgba']=palette
for bone in rig['bones']+rig.get('outfits',[]):
    if 'image' not in bone: continue
    im=Image.open(ROOT/'generated'/bone['image']).convert('RGBA')
    indices=[palette.index(p) if p[3] else 0 for p in zip(*[iter(im.tobytes())]*4)]
    runs=[]; i=0
    while i<len(indices):
        color=indices[i]; end=i+1
        while end<len(indices) and indices[end]==color: end+=1
        if color: runs.extend([i,end-i,color])
        i=end
    bone['runs']=runs
Path(ROOT.parent/'assets.js').write_text('// Generated from native PNG parts. Run pixel_art/tools/bake_assets.py to update.\n'+'globalThis.CHARACTER_ASSET = '+json.dumps(rig,separators=(',',':'))+';\n')
print('Baked authoritative PNG pixels into assets.js')
