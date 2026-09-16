"""Render original reference pixels plus hidden anatomical joint overlap.

All editing uses native 64x96 integer scanlines. No source resizing.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'generated'


def main():
    doc=json.loads((ROOT/'native_clusters.json').read_text())
    size=(doc['width'],doc['height']); palette=doc['palette']
    images={}; original_layers={}
    by_name={b['name']:b for b in doc['parts']}
    # Reference remains the exact visible bind pose. Anatomy drawn underneath
    # restores coverage when a joint rotates; it cannot change the rest image.
    for b in doc['parts']:
        im=Image.new('RGBA',size); draw=ImageDraw.Draw(im)
        local_color=4 if any(s in b['name'] for s in ['thigh','shin','arm','hand','torso']) else 9
        if b['name']=='head': local_color=4
        if b['name']=='pelvis': local_color=13
        if b['name'].startswith('hair_'): local_color=1
        for p in [b['pivot'],b['end']]:
            radius=2 if 'hand' not in b['name'] else 1
            draw.ellipse((p[0]-radius,p[1]-radius,p[0]+radius,p[1]+radius),fill=palette[local_color])
        if b['name']=='head':
            # Scalp beneath the removable crown; never visible with original hair.
            draw.polygon([(30,23),(33,22),(36,23),(37,25),(37,28),(34,31),(31,29),(29,26)],fill=palette[5])
        if b['name'] in ['arm_far','forearm_far','hand_far']:
            draw.line([tuple(b['pivot']),tuple(b['end'])],fill=palette[local_color],width=3)
        original=Image.new('RGBA',size); d=ImageDraw.Draw(original)
        for y,x0,x1,c in b['spans']:
            draw.line((x0,y,x1,y),fill=palette[c])
            d.line((x0,y,x1,y),fill=palette[c])
        images[b['name']]=im; original_layers[b['name']]=original
    reference=Image.new('RGBA',size)
    for b in sorted(doc['parts'],key=lambda b:b['z']): reference.alpha_composite(original_layers[b['name']])
    original=reference.load()
    # Restrict hidden caps to the reference silhouette at bind pose.
    for name,im in images.items():
        pixels=im.load()
        for y in range(size[1]):
            for x in range(size[0]):
                if not original[x,y][3]: pixels[x,y]=(0,0,0,0)
    owners={}
    for b in sorted(doc['parts'],key=lambda b:b['z']):
        for y,x0,x1,c in b['spans']:
            for x in range(x0,x1+1): owners[(x,y)]=(b['name'],b['z'])
    for b in doc['parts']:
        px=images[b['name']].load()
        for (x,y),(owner,z) in owners.items():
            if owner!=b['name'] and b['z']>z: px[x,y]=(0,0,0,0)
    folder=OUT/'parts'; folder.mkdir(parents=True,exist_ok=True)
    bones=[dict(name='root',parent=None,pivot=doc['root'],end=[doc['root'][0],doc['root'][1]-4],z=-1)]
    final=Image.new('RGBA',size)
    for b in sorted(doc['parts'],key=lambda b:b['z']):
        im=images[b['name']]; im.save(folder/f"{b['name']}.png")
        final.alpha_composite(im)
        bones.append({**{k:b[k] for k in ['name','parent','pivot','end','z']},'image':f"parts/{b['name']}.png",'bounds':im.getbbox()})
    assert final.tobytes()==reference.tobytes(), 'Modular caps changed the visible reference'
    supplied=Image.open(ROOT/'references/reference.png').convert('RGBA')
    expected=Image.new('RGBA',size); expected.paste(supplied,tuple(doc['reference_offset']))
    assert final.tobytes()==expected.tobytes(), 'Sprite differs from the original reference pixels'
    final.save(OUT/'reference_character.png'); final.save(OUT/'v5_stage4.png')
    # Final user direction: only body silhouette + hair in the base. Clothing
    # is an optional overlay, attached to the same existing bones.
    outfit_dir=OUT/'outfits'/'reference'; outfit_dir.mkdir(parents=True,exist_ok=True)
    outfit=[]
    rgba_palette=[tuple(bytes.fromhex(c[1:]))+(255,) for c in palette]
    color_index={c:i for i,c in enumerate(rgba_palette)}
    immutable={name:images[name].tobytes() for name in ['head','hair_back','hair_front']}
    body=Image.new('RGBA',size)
    for b in sorted(doc['parts'],key=lambda b:b['z']):
        name=b['name']; im=images[name].copy(); px=im.load()
        garment=Image.new('RGBA',size); gp=garment.load()
        for y in range(size[1]):
            for x in range(size[0]):
                if not px[x,y][3]: continue
                c=color_index[px[x,y]]; sx=x-19; sy=y-20
                new=c; slot=None
                if name=='torso':
                    new={0:3,1:3,9:4,10:4,11:5,12:3}.get(c,c)
                    if c in [10,11]: slot='top'
                    # Remove the crop hem's hard horizontal shading boundary.
                    if 19<=sy<=21 and 11<=sx<=17: new=5 if sx<=14 else 4
                elif name=='pelvis':
                    new=5 if sx<=13 else 4
                    if sx>=18: new=3
                    if sy<=26: new=4 if sx<=11 or sx>=17 else 5
                    slot='bottom'
                elif name.startswith(('shin_','foot_')):
                    new={0:3,6:4,9:4,12:3}.get(c,c)
                    if (sy>=44 and name=='shin_near') or (sy>=43 and name=='shin_far') or name.startswith('foot_'):
                        if c in [0,6,9,12,3,4]: slot='boots'
                        if name.startswith('foot_'):
                            new=3 if c==0 or c==12 else (5 if c==6 else 4)
                if slot:
                    gp[x,y]=px[x,y]
                px[x,y]=rgba_palette[new]
        if garment.getbbox():
            file=f'outfits/reference/{name}.png'; garment.save(OUT/file)
            slot='top' if name=='torso' else 'bottom' if name=='pelvis' else 'boots'
            outfit.append(dict(name=f'reference_{name}',bone=name,slot=slot,image=file,bounds=garment.getbbox()))
        im.save(folder/f'{name}.png'); images[name]=im; body.alpha_composite(im)
    # Face and hair pieces remain bit-for-bit unchanged by the body conversion.
    for name in ['head','hair_back','hair_front']:
        assert images[name].tobytes()==immutable[name]
    body.save(OUT/'character.png'); body.save(OUT/'v6_stage4.png')
    rig=dict(width=64,height=96,baseline=75,bones=bones,palette=palette,outfits=outfit,referenceOffset=doc['reference_offset'],referenceSize=[26,56],angles='radians relative to bind pose; positive clockwise',space='global bind pivots; parent-relative runtime transforms')
    (OUT/'rig.json').write_text(json.dumps(rig,indent=2))
    for scale in [1,4,8]: body.resize((64*scale,96*scale),Image.Resampling.NEAREST).save(OUT/f'preview_{scale}x.png')
    print('PASS: 64x96 body + original hair; garments exported as independent optional overlays')


if __name__=='__main__': main()
