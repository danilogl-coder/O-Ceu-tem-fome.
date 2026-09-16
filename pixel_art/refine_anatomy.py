"""Native anatomical layers. Integer clusters, hidden joint overlap, no resizing.

Coordinates are in the reference's local 26x56 space, translated by (19,20)
onto the existing 64x96 canvas. Hair and facial identity are retained.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'generated'
OLD=ROOT/'history/before_anatomy'
PAL=list(json.loads((ROOT/'palette.json').read_text()).values())
NAMES={n:i for i,n in enumerate(json.loads((ROOT/'palette.json').read_text()))}
SIZE=(64,96)


def point(p): return (p[0]+19,p[1]+20)


def build(revision=7):
    bones=[dict(name='root',parent=None,pivot=point((13,28)),end=point((13,26)),z=-1)]
    parts={}
    def part(name,parent,pivot,end,z,shapes):
        im=Image.new('RGBA',SIZE);d=ImageDraw.Draw(im)
        for color,poly in shapes:
            if revision>=3 and color==3 and 'far' not in name and not name.startswith('foot_'): color=4
            if revision>=3 and name=='shin_far': poly=[(x+(2 if y>=50 else 1 if y>=46 else 0),y) for x,y in poly]
            if revision>=3 and name=='foot_far': poly=[(x+2,y) for x,y in poly]
            d.polygon([point(p) for p in poly],fill=PAL[color])
        if revision>=3 and name=='foot_near': d.rectangle([point((16,54)),point((17,55))],fill=(0,0,0,0))
        if revision>=3 and name=='foot_far': pivot=(19,52);end=(23,55)
        if revision>=3 and name=='shin_far': end=(19,52)
        parts[name]=im
        bones.append(dict(name=name,parent=parent,pivot=point(pivot),end=point(end),z=z,image=f'parts/{name}.png',bounds=im.getbbox()))
    # Hidden side is darker and complete, not a single-color line.
    part('arm_far','torso',(16,15),(17,24),1,[
      (3,[(15,14),(17,14),(19,17),(19,20),(18,25),(16,26),(15,23),(15,18)]),
      (4,[(16,15),(17,16),(18,18),(17,22),(17,25),(16,24)])])
    part('forearm_far','arm_far',(17,24),(17,31),2,[
      (3,[(16,23),(18,23),(19,26),(18,31),(18,33),(16,33),(15,30)]),
      (4,[(16,24),(17,24),(18,26),(17,30),(17,32),(16,31)])])
    part('hand_far','forearm_far',(17,31),(18,35),3,[
      (3,[(16,30),(18,30),(18,32),(19,34),(19,35),(18,36),(17,35),(16,33)]),
      (4,[(17,31),(17,33),(18,34),(18,35),(17,34)])])
    part('thigh_far','pelvis',(15,29),(16,41),4,[
      (3,[(13,28),(16,27),(18,29),(18,33),(17,36),(18,40),(17,43),(15,43),(14,40),(14,36),(13,32)]),
      (4,[(14,29),(16,29),(17,31),(16,35),(16,38),(17,41),(15,41),(15,36),(14,33)]),
      (5,[(14,30),(15,30),(15,33),(14,34)])])
    part('shin_far','thigh_far',(16,41),(17,52),5,[
      (3,[(15,40),(17,40),(18,43),(19,45),(18,48),(18,52),(19,54),(16,54),(15,51),(16,47),(15,44)]),
      (4,[(16,41),(17,42),(18,45),(17,48),(17,52),(16,52),(17,46),(16,44)])])
    part('foot_far','shin_far',(17,52),(21,55),6,[
      (3,[(16,51),(18,51),(18,53),(20,54),(22,54),(22,55),(16,55),(15,54)]),
      (4,[(17,52),(18,54),(21,54),(20,54),(17,54),(16,54)]),
      (5,[(17,52),(17,53),(18,54)])])
    part('thigh_near','pelvis',(12,29),(12,41),7,[
      (3,[(10,28),(13,28),(15,30),(15,34),(14,37),(14,40),(13,43),(10,43),(10,40),(9,36),(9,31)]),
      (4,[(10,29),(13,29),(14,31),(14,35),(12,39),(13,42),(11,42),(11,38),(10,35)]),
      (5,[(10,30),(12,30),(13,32),(12,36),(11,39),(11,41),(10,40),(10,36)])])
    part('shin_near','thigh_near',(12,41),(11,52),8,[
      (3,[(10,40),(13,40),(14,43),(13,47),(12,50),(12,53),(10,54),(9,52),(10,48),(9,45),(9,42)]),
      (4,[(11,41),(13,42),(12,47),(11,50),(11,53),(10,52),(11,48),(10,45)]),
      (5,[(10,41),(12,41),(12,44),(11,47),(10,48),(10,45)])])
    part('foot_near','shin_near',(11,52),(15,55),9,[
      (3,[(10,51),(12,51),(12,53),(15,54),(16,54),(17,55),(10,55),(9,54),(9,53)]),
      (4,[(10,52),(11,52),(12,54),(15,54),(16,55),(11,55),(10,54)]),
      (5,[(10,52),(11,52),(11,53),(13,54),(11,54),(10,53)])])
    # Abdomen is independent from ribcage and pelvis: no rectangular shorts block.
    part('abdomen','root',(13,27),(13,22),10,[
      (3,[(11,20),(15,20),(17,22),(16,25),(17,28),(15,30),(11,29),(10,26),(11,23)]),
      (4,[(12,21),(15,22),(15,24),(16,27),(14,29),(11,27),(12,24)]),
      (5,[(12,22),(14,22),(14,25),(13,27),(11,26),(12,24)])])
    part('pelvis','root',(13,28),(13,31),11,[
      (3,[(11,25),(14,25),(17,27),(18,29),(17,32),(15,34),(12,33),(10,32),(9,30),(9,28)]),
      (4,[(11,26),(14,26),(16,28),(17,30),(15,32),(12,32),(10,30),(10,28)]),
      (5,[(11,27),(13,27),(14,29),(13,32),(11,31),(10,29)])])
    part('torso','abdomen',(13,22),(13,15),12,[
      (3,[(12,13),(15,13),(17,15),(18,17),(18,19),(17,21),(15,23),(12,23),(10,21),(10,17),(9,16),(10,14)]),
      (4,[(12,14),(15,14),(16,16),(17,17),(17,19),(15,22),(12,22),(11,19),(11,16)]),
      (5,[(12,14),(14,15),(15,16),(16,17),(16,18),(14,19),(12,18),(11,16)]),
      (5,[(12,20),(14,21),(14,22),(12,22)])])
    part('neck','torso',(14,14),(14,11),13,[
      (3,[(12,10),(15,10),(16,12),(16,14),(15,16),(12,15),(11,14),(13,12)]),
      (4,[(13,11),(15,11),(15,14),(14,15),(12,14),(13,13)]),
      (5,[(13,12),(14,12),(14,14),(13,14)])])
    part('arm_near','torso',(10,15),(9,24),14,[
      (3,[(9,14),(11,14),(12,16),(12,19),(11,22),(11,25),(9,26),(7,24),(8,20),(8,16)]),
      (4,[(9,15),(11,16),(11,19),(10,22),(10,25),(8,24),(9,20)]),
      (5,[(9,15),(10,15),(10,18),(9,20),(9,23),(8,23),(9,19)])])
    part('forearm_near','arm_near',(9,24),(10,31),15,[
      (3,[(8,23),(10,23),(11,25),(11,28),(12,31),(11,33),(9,33),(8,29),(7,26)]),
      (4,[(9,24),(10,25),(10,28),(11,31),(10,32),(9,30),(9,28),(8,26)]),
      (5,[(8,24),(9,24),(9,27),(10,30),(10,31),(9,30),(8,27)])])
    # Relaxed palm and fingers: narrow wrist, thumb to the front, no star shape.
    part('hand_near','forearm_near',(10,31),(11,35),16,[
      (3,[(9,30),(11,30),(12,32),(12,33),(13,34),(12,35),(12,36),(10,36),(9,34)]),
      (4,[(10,31),(11,32),(11,34),(12,35),(11,35),(10,34)]),
      (5,[(10,31),(10,33),(11,34),(10,34),(10,32)])])
    # Keep the source facial clusters; hair is rebuilt by hair.py at revision 7.
    old=json.loads((OLD/'rig.json').read_text())
    for name,z in [('hair_back',0),('head',17),('hair_front',18)]:
        b=next(b for b in old['bones'] if b['name']==name).copy()
        b['z']=z
        if name=='head': b['parent']='neck'
        im=Image.open(OLD/b['image']).convert('RGBA')
        parts[name]=im; bones.append(b)
    if revision>=2:
        # Let the relaxed hand hang behind the thigh instead of merging with it.
        for name,dx in [('forearm_near',-1),('hand_near',-2)]:
            shifted=Image.new('RGBA',SIZE);shifted.paste(parts[name],(dx,0));parts[name]=shifted
            b=next(b for b in bones if b['name']==name)
            if name=='hand_near': b['pivot']=point((8,31));b['end']=point((9,35))
            else: b['end']=point((8,31))
        # Local cleanup only: eliminate transverse cut lines across joints.
        for name,shapes in {
          'shin_near':[(5,[(11,40),(12,40),(12,42),(11,43),(10,42)]),(4,[(12,43),(13,43),(12,46)])],
          'forearm_near':[(5,[(8,23),(8,24),(8,25),(7,24)]),(4,[(9,24),(9,26)])],
          'hand_near':[(5,[(8,30),(8,32)]),(4,[(9,33),(10,34)])],
          'pelvis':[(4,[(14,26),(16,28),(16,30),(15,31)]),(5,[(11,28),(12,28),(12,30),(11,30)])],
        }.items():
            d=ImageDraw.Draw(parts[name])
            for color,points in shapes: d.polygon([point(p) for p in points],fill=PAL[color])
    if revision>=3:
        # Small occlusion accents separate overlapping volumes without joint bands.
        for name,segments in {
          'arm_near':[[(11,19),(10,21)]],
          'hand_near':[[(10,33),(10,34)],[(9,36),(10,35)]],
          'abdomen':[[(16,23),(15,25)]],
          'shin_near':[[(13,44),(12,46)]],
        }.items():
            d=ImageDraw.Draw(parts[name])
            for segment in segments:d.line([point(p) for p in segment],fill=PAL[3])
    if revision>=4:
        from reference_body import refine
        parts,bones=refine(parts,bones,revision)
    if revision>=6:
        from skin_lighting import shade
        parts=shade(parts,PAL)
    if revision>=7:
        # Hair is authored from scratch as two fully overlapping layers.
        from hair import build as build_hair
        parts,bones=build_hair(parts,bones,PAL)
    for b in bones:
        if b['name'] in parts: b['bounds']=parts[b['name']].getbbox()
    return parts,bones


def export(revision=7):
    parts,bones=build(revision)
    folder=OUT/'parts'; folder.mkdir(exist_ok=True)
    # Drop PNGs left behind by an earlier revision's part list, so `parts/` is
    # always exactly the current rig and nothing stale is validated or shipped.
    current={b['image'].split('/')[-1] for b in bones if 'image' in b}
    for stale in folder.glob('*.png'):
        if stale.name not in current: stale.unlink(); print(f'removed stale part {stale.name}')
    im=Image.new('RGBA',SIZE)
    for b in sorted(bones,key=lambda b:b['z']):
        if b['name'] not in parts: continue
        layer=parts[b['name']];layer.save(OUT/b['image']);im.alpha_composite(layer)
    im.save(OUT/f'anatomy_v{revision}.png')
    im.resize((512,768),Image.Resampling.NEAREST).save(OUT/f'anatomy_v{revision}_8x.png')
    im.save(OUT/'character.png')
    old=json.loads((OLD/'rig.json').read_text())
    # Refit existing optional equipment to the revised limbs; default stays bare.
    outfits=[]
    color_map={tuple(bytes.fromhex(c[1:]))+(255,):i for i,c in enumerate(PAL)}
    for name,layer in parts.items():
        if name in ['head','hair_front','hair_back','neck','hand_near','hand_far']:continue
        gear=Image.new('RGBA',SIZE);gp=gear.load();slot=None
        for y in range(96):
            for x in range(64):
                p=layer.getpixel((x,y))
                if not p[3]:continue
                c=color_map[p];sy=y-20;sx=x-19
                if name=='torso' or (name.startswith('arm_') and sy<=18):
                    if name=='torso' and sy<=15 and sx>=12:continue
                    slot='top';color=11 if c==5 else 10
                elif name=='pelvis' or (name.startswith('thigh_') and sy<=33):
                    slot='bottom';color=(15 if c==5 else 14) if sy==33 else (NAMES['denim_high'] if c==5 else 13)
                elif name.startswith('foot_') or (name.startswith('shin_') and sy>=48):
                    # Boots get tones of their own rather than borrowing the
                    # body's: a colour picker needs every ramp to be separate,
                    # or dyeing the boots would also dye her skin.
                    slot='boots';color=NAMES['boot_light'] if c==5 else NAMES['boot'] if c==4 else 12
                else:continue
                gp[x,y]=tuple(bytes.fromhex(PAL[color][1:]))+(255,)
        if gear.getbbox():
            file=f'outfits/reference/{name}.png';gear.save(OUT/file)
            outfits.append(dict(name=f'reference_{name}',bone=name,slot=slot,image=file,bounds=gear.getbbox()))
    rig={**old,'palette':PAL,'bones':bones,'outfits':outfits,'anatomyRevision':revision,'baseline':75}
    if revision>=7:
        import hair, cloak, wraps
        rig['sway']={hair.SWAY['name']:{k:v for k,v in hair.SWAY.items() if k!='name'}}
        # The cloak is a slot of its own, drawn over everything, simulated on its
        # own curve. Built last so nothing else can reorder it.
        names=list(json.loads((ROOT/'palette.json').read_text()))
        # Bandages first, and half a step lower than every other garment: they go
        # on the skin and everything else goes on top of them.
        under=wraps.build(OUT, parts, names, PAL)
        depth={b['name']:b['z'] for b in rig['bones']}
        for o in under: o['z']=depth[o['bone']]+wraps.Z_OFFSET
        rig['outfits']=under+rig['outfits']
        rig['outfits']+=cloak.build(OUT, names, PAL, head=parts['head'])
        rig['sway'][cloak.SWAY['name']]={k:v for k,v in cloak.SWAY.items() if k!='name'}
        # Whole-pixel offset channels. Every layer of a channel moves together,
        # so a channel never opens a seam inside itself; the seams that matter
        # are between channels, and those sit where parts already overlap.
        channels={
            'chest':['torso','neck','head','hair_back','hair_front'],
            'arms':['arm_near','forearm_near','hand_near','arm_far','forearm_far','hand_far'],
        }
        for channel,members in channels.items():
            for b in rig['bones']:
                if b['name'] in members: b['drift']=channel
        # Cloth hangs off the body rather than being welded to it, so the
        # garment layers carry their own channel and lag a frame behind.
        for o in rig['outfits']:
            if o['slot'] in ('cloak','wraps'): continue   # carry their own
            o['drift']='cloth' if o['slot']=='top' else 'hem' if o['slot']=='bottom' else None
            if o['drift'] is None: del o['drift']
        rig['channels']=list(channels)+['cloth','hem','cloak']
    # Which palette entries move together when something is dyed, and which one
    # of them is the colour the picker actually shows. Every ramp is disjoint
    # from the body's own tones, so dyeing a garment can never touch her skin,
    # and the eyes are a pair of single pixels handled on their own.
    ramp=lambda base,tones: dict(base=NAMES[base],tones=[NAMES[t] for t in tones])
    rig['ramps']={
        'hair':   ramp('hair',  ['hair_deep','hair_shadow','hair','hair_light']),
        'wraps':  ramp('wrap',  ['wrap_deep','wrap_shadow','wrap','wrap_light','wrap_stain']),
        'top':    ramp('gold',  ['gold_shadow','gold']),
        'bottom': ramp('denim', ['denim','denim_high','hem_shadow','hem']),
        'boots':  ramp('boot',  ['leather_shadow','boot','boot_light']),
        'cloak':  ramp('cloak', ['cloak_deep','cloak_shadow','cloak','cloak_light','cloak_glow',
                                 'cloak_lining','cloak_lining_light']),
    }
    # The eyes: the row, the two sockets, and which pixel of each is the iris.
    rig['eyes']=dict(row=27, sockets=[[32,33],[35,36]], iris=NAMES['denim_light'])
    (OUT/'rig.json').write_text(json.dumps(rig,indent=2))
    joints=[]
    for b in bones:
        joint=next((kind for prefix,kind in [('hand_','wrist'),('forearm_','elbow'),('arm_','shoulder'),('shin_','knee'),('foot_','ankle'),('thigh_','hip'),('neck','cervical'),('abdomen','lumbar'),('hair_','scalp')] if b['name'].startswith(prefix)),b['name'])
        joints.append(dict(name=b['name'],joint=joint,parent=b['parent'],pivot=b['pivot'],end=b['end'],independent=True))
    (OUT/'joints.json').write_text(json.dumps(joints,indent=2))
    print(f'Anatomy v{revision}: {len(parts)} independent parts, {len(bones)} bones')


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--revision',type=int,default=7,choices=[1,2,3,4,5,6,7]);args=parser.parse_args()
    export(args.revision)
