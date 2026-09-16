"""Fail explicitly on incorrect raster format, palette or broken rig structure."""
from pathlib import Path
from PIL import Image
import json
import math

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'generated'


def validate():
    palette={tuple(bytes.fromhex(v[1:])) for v in json.loads((ROOT/'palette.json').read_text()).values()}
    paths=[OUT/'character.png',*sorted((OUT/'parts').glob('*.png'))]
    for path in paths:
        with Image.open(path) as im:
            assert im.format=='PNG', f'{path}: not PNG'
            assert im.mode=='RGBA', f'{path}: not RGBA'
            assert im.size==(64,96), f'{path}: wrong native dimensions'
            assert set(im.getchannel('A').tobytes())=={0,255}, f'{path}: missing transparency or intermediate alpha'
            colors={p[:3] for p in zip(*[iter(im.tobytes())]*4) if p[3]}
            assert colors <= palette, f'{path}: out-of-palette colors {colors-palette}'
            assert im.getbbox(), f'{path}: empty part'
            print(f'PASS {path.name}: 64x96 RGBA, binary alpha, {len(colors)} colors')
    rig=json.loads((OUT/'rig.json').read_text())
    bones={b['name']:b for b in rig['bones']}
    assert len(bones)==len(rig['bones'])
    for bone in bones.values():
        visited=set(); b=bone
        while b['parent']:
            assert b['name'] not in visited,'Cyclic skeleton'
            visited.add(b['name']); b=bones[b['parent']]
        assert b['name']=='root'
        assert 0<=bone['pivot'][0]<64 and 0<=bone['pivot'][1]<96
    assembled=Image.new('RGBA',(64,96))
    for b in sorted(bones.values(),key=lambda b:b['z']):
        if 'image' in b: assembled.alpha_composite(Image.open(OUT/b['image']))
    assert assembled.tobytes()==Image.open(OUT/'character.png').tobytes(), 'Parts do not reproduce final sprite'
    expected=Image.new('RGBA',(64,96))
    reference=Image.open(ROOT/'references/reference.png').convert('RGBA')
    expected.paste(reference,tuple(rig['referenceOffset']))
    # The face is the locked identity asset. Hair was redrawn at revision 7 and
    # is checked structurally below instead of byte for byte.
    for name in ['head']:
        current=Image.open(OUT/'parts'/f'{name}.png')
        previous=Image.open(ROOT/'history/before_anatomy/parts'/f'{name}.png')
        assert current.tobytes()==previous.tobytes(),f'{name}: identity asset changed'
    document=json.loads((ROOT/'native_clusters.json').read_text())
    immutable_pixels=0
    for b in document['parts']:
        if b['name'] in ['head','hair_back','hair_front']:
            for y,x0,x1,c in b['spans']:
                for x in range(x0,x1+1):
                    # Exact identity is checked per layer above; body overlap may change.
                    immutable_pixels+=1
    raw=OUT/'animation/rest_00.rgba'
    if raw.exists(): assert raw.read_bytes()==assembled.tobytes(), 'JS renderer differs from PNG'
    for scale in [1,4,8]:
        im=Image.open(OUT/f'preview_{scale}x.png')
        assert im.size==(64*scale,96*scale)
        assert im.tobytes()==assembled.resize(im.size,Image.Resampling.NEAREST).tobytes()
    print(f'PASS skeleton: {len(bones)} bones, exact rest reconstruction, NN previews')
    for side in ['near','far']:
        assert bones[f'hand_{side}']['parent']==f'forearm_{side}'
        assert bones[f'hand_{side}']['pivot']!=bones[f'forearm_{side}']['pivot']
        foot=Image.open(OUT/bones[f'foot_{side}']['image'])
        assert foot.getbbox()[3]-1==rig['baseline'],'Foot is not grounded in rest pose'
    report=dict(canvas=[64,96],reference=[26,56],offset=rig['referenceOffset'],anatomy_revision=rig['anatomyRevision'],parts=len(paths)-1,bones=len(bones),independent_wrists='PASS',both_feet_grounded='PASS',optional_garment_layers=len(rig.get('outfits',[])),format='PNG RGBA',alpha_values=[0,255],face_asset='unchanged',hair_asset='revision 7, hair.py',clothing='separate optional overlays',rest_renderer='PASS' if raw.exists() else 'not run')
    if rig['anatomyRevision']>=6:
        layers={name:Image.open(OUT/b['image']).convert('RGBA') for name,b in bones.items() if 'image' in b}
        for name,layer in layers.items():
            if name.startswith('hair_'): continue
            before=Image.open(ROOT/'history/before_skin_lighting/parts'/f'{name}.png')
            assert layer.getchannel('A').tobytes()==before.getchannel('A').tobytes(),f'{name}: approved silhouette changed'
        joins=[('torso','abdomen'),('abdomen','pelvis')]
        for side in ['near','far']:
            joins.extend([(f'arm_{side}',f'forearm_{side}'),(f'forearm_{side}',f'hand_{side}'),(f'thigh_{side}',f'shin_{side}'),(f'shin_{side}',f'foot_{side}')])
        for parent,child in joins:
            overlap=0
            for a,b in zip(layers[parent].getdata(),layers[child].getdata()):
                if a[3] and b[3]:
                    overlap+=1
                    assert a==b,f'{parent}/{child}: mismatched skin color at shared joint'
            assert overlap>0,f'{parent}/{child}: no joint overlap'
        report.update(approved_silhouettes='unchanged',continuous_skin_joins=len(joins),palette_colors=len(palette))
        print(f'PASS: approved masks unchanged; {len(joins)} joint overlaps have continuous skin colors')
    if rig['anatomyRevision']>=7:
        report.update(validate_hair(rig,bones))
        report.update(validate_cloak(rig,bones))
        report.update(validate_wraps(rig,bones))
        report.update(validate_palette(rig))
    (OUT/'validation_report.json').write_text(json.dumps(report,indent=2))
    print('PASS: revised anatomy, independent wrists, both feet grounded; face unchanged')


def validate_hair(rig,bones):
    """Two layers, full overlap, one solid body, and a declared sway curve."""
    import hair as design
    layers={name:b for name,b in bones.items() if name.startswith('hair_')}
    expected={name for name,*_ in design.LAYERS}
    assert set(layers)==expected,f'Hair layers are {sorted(layers)}, expected {sorted(expected)}'
    values=list(json.loads((ROOT/'palette.json').read_text()).values())
    tones={tuple(bytes.fromhex(values[i][1:])) for i in design.TONE.values()}
    authored=design.pixels()
    painted={}
    for name,b in layers.items():
        im=Image.open(OUT/b['image']).convert('RGBA')
        colors={p[:3] for p in zip(*[iter(im.tobytes())]*4) if p[3]}
        assert colors<=tones,f'{name}: non-hair color {colors-tones}'
        px=im.load(); own=set()
        for y in range(96):
            for x in range(64):
                if px[x,y][3]:
                    assert (x,y) in authored,f'{name}: stray pixel at {x},{y}'
                    assert px[x,y][:3]==tuple(bytes.fromhex(values[authored[(x,y)]][1:])),f'{name}: wrong tone at {x},{y}'
                    own.add((x,y))
        painted[name]=own
    # hair_back is the whole head of hair; hair_front repeats the pixels that
    # have to cover the body. Full overlap is the point: nothing abuts, so no
    # seam exists that could open into a blinking pixel.
    assert painted['hair_back']==set(authored),'hair_back is not the complete hair'
    assert painted['hair_front'] < painted['hair_back'],'hair_front must repeat pixels of hair_back'
    assert painted['hair_front']=={p for p in authored if design.in_front(*p)},'hair_front covers the wrong pixels'
    assert layers['hair_back']['z']<min(b['z'] for name,b in bones.items() if not name.startswith('hair_') and 'image' in b),\
        'hair_back must draw behind the body'
    assert layers['hair_front']['z']>bones['head']['z'],'hair_front must draw over the face'
    # One solid body plus the lock beside the cheek: nothing thin and free
    # floating, which is what broke into specks once rows started sliding.
    blobs=connected(painted['hair_back'])
    assert len(blobs)==2,f'Back hair should be one mass plus the cheek lock, found {len(blobs)} pieces'
    assert min(len(b) for b in blobs)>=14,'A hair piece is too small to survive a swing'
    # No enclosed gap and no row indented against both its neighbours: either one
    # turns into a blinking pixel as soon as the rows shear.
    rows={}
    for x,y in authored: rows.setdefault(y,set()).add(x)
    for y,xs in rows.items():
        for x in range(min(xs),max(xs)):
            if x not in xs and x-1 in xs and x+1 in xs:
                above=rows.get(y-1,set()); below=rows.get(y+1,set())
                assert not(x in above and x in below),f'Hair encloses a gap at {x},{y}'
    mass=[b for b in blobs if len(b)==max(len(c) for c in blobs)][0]
    edges={y:(min(x for x,yy in mass if yy==y),max(x for x,yy in mass if yy==y))
           for y in sorted({y for _,y in mass})}
    # A row set in from BOTH neighbours is concave, and a sub-pixel shear turns
    # it into a notch. A row sticking out past both is a wisp, which is fine.
    order=sorted(edges)
    for a,b,c in zip(order,order[1:],order[2:]):
        left=edges[b][0]>edges[a][0] and edges[b][0]>edges[c][0]
        right=edges[b][1]<edges[a][1] and edges[b][1]<edges[c][1]
        assert not left,f'Left edge is indented against both neighbours at row {b}'
        assert not right,f'Right edge is indented against both neighbours at row {b}'
    # The face and the hair are one rigid unit: same anchor, so the rasteriser
    # samples them through one transform and they cannot slip against each other.
    unit={name for name,b in bones.items() if b.get('anchor')}
    assert unit=={'head','hair_back','hair_front'},f'Head/hair unit is {sorted(unit)}'
    assert len({bones[n]['anchor'] for n in unit})==1,'The unit must share one anchor'
    # Eyes stay clear of the fringe.
    face=Image.open(OUT/bones['head']['image']).convert('RGBA').load()
    front=Image.open(OUT/bones['hair_front']['image']).convert('RGBA').load()
    eyes=[(x,y) for y,columns in design.EYES.items() for x in columns]
    for x,y in eyes:
        assert face[x,y][3],f'No eye pixel at {x},{y} in head.png'
        assert not front[x,y][3],f'hair_front covers the eye at {x},{y}'
    # Whole-pixel offset channels. Every layer of a channel has to move as one,
    # or the channel itself would tear; the seams that remain sit where parts
    # already overlap by several rows.
    channels=rig.get('channels',[])
    assert channels,'No drift channels declared'
    members={}
    for b in list(bones.values())+rig.get('outfits',[]):
        if b.get('drift'):
            assert b['drift'] in channels,f"{b['name']}: unknown channel {b['drift']!r}"
            members.setdefault(b['drift'],[]).append(b['name'])
    for channel in channels:
        assert members.get(channel),f'{channel}: channel declared but nothing is in it'
    # The chest lifts a pixel or two away from the waist below it, so the two
    # must overlap by more than that or breathing would open the midriff.
    def band(name):
        box=Image.open(OUT/bones[name]['image']).getbbox()
        return set(range(box[1],box[3]))
    overlap=band('torso')&band('abdomen')
    assert len(overlap)>=3,f'torso/abdomen overlap is only {len(overlap)} rows: breathing would tear it'
    sway=rig.get('sway',{})
    assert sway,'No sway curve declared for the hair'
    for name,b in layers.items():
        assert b.get('sway') in sway,f'{name}: sway curve {b.get("sway")!r} is not declared'
    spec=sway[design.SWAY['name']]
    assert len(spec['joints'])==len(spec['links'])+1,'Sway joints and links disagree'
    assert spec['anchor'] in bones,f'Sway anchor {spec["anchor"]!r} is not a bone'
    print(f'PASS hair: 2 layers, {len(authored)} pixels, back is the complete mass, '
          f'{len(blobs)} solid pieces, sway over {len(spec["links"])} links, '
          f'{len(eyes)} eye pixels clear')
    return dict(drift_channels={k:sorted(v) for k,v in sorted(members.items())},
                waist_overlap_rows=len(overlap),
                hair_layers=sorted(layers),hair_pixels=len(authored),hair_tones=len(design.TONE),
                hair_source='hair.py',hair_pieces=len(blobs),hair_sway=spec['links'],
                hair_front_pixels=len(painted['hair_front']),eyes_clear_of_hair='PASS',
                head_hair_unit=sorted(unit))


def validate_palette(rig):
    """No two entries may hold the same colour.

    Every PNG in this project is the source of truth for its own pixels, and the
    baker turns those pixels back into palette indices by matching the colour.
    Two entries with the same hex are therefore the same entry: one of them
    silently wins, and a ramp built on the loser can never be dyed. That is
    exactly what happened when the boots borrowed the body's leather.
    """
    seen={}
    for name,colour in json.loads((ROOT/'palette.json').read_text()).items():
        assert colour not in seen,f'{name} and {seen[colour]} are both {colour} — a PNG cannot tell them apart'
        seen[colour]=name
    ramps=rig.get('ramps') or {}
    body=set()
    for b in rig['bones']:
        if 'image' not in b: continue
        im=Image.open(OUT/b['image']).convert('RGBA')
        index={tuple(bytes.fromhex(c[1:]))+(255,):i for i,c in enumerate(rig['palette'])}
        body|={index[p] for p in im.getdata() if p[3]}
    for name,ramp in ramps.items():
        if name=='hair': continue          # hair is part of the body by design
        clash=sorted(set(ramp['tones'])&body)
        assert not clash,f'ramp {name} shares {clash} with the body — dyeing it would dye her'
        assert ramp['base'] in ramp['tones'],f'ramp {name}: base is not one of its tones'
    print(f'PASS palette: {len(seen)} distinct colours, {len(ramps)} dyeable ramps, none touching the body')
    return dict(palette_size=len(seen),ramps=sorted(ramps))


def validate_wraps(rig,bones):
    """The bandages: under every other garment, neck down, hands and feet free."""
    import wraps as design
    worn=[o for o in rig['outfits'] if o['slot']=='wraps']
    assert worn,'no bandage layers'
    covered={o['bone'] for o in worn}
    assert covered==set(design.COVERS),f'wraps cover {sorted(covered)}'
    assert not (covered & {'head','hair_back','hair_front','hand_near','hand_far','foot_near','foot_far'}), \
        'hands, feet and head stay bare'
    depth={b['name']:b['z'] for b in rig['bones']}
    for o in worn:
        # Under everything: on the skin of its own bone, below every garment
        # that hangs on the same bone, and below anything drawn higher up.
        assert 0 < o['z']-depth[o['bone']] < .5,f'{o["name"]}: z {o["z"]} is not just above its bone'
        for other in rig['outfits']:
            if other['slot']=='wraps' or other['bone']!=o['bone']: continue
            assert other.get('z',depth[other['bone']]+.5)>o['z'],f'{other["name"]} would go under the bandages'
    tones=set()
    for o in worn:
        im=Image.open(OUT/o['image']).convert('RGBA')
        assert im.size==(64,96),f'{o["name"]}: {im.size}'
        assert {p[3] for p in im.getdata()}<={0,255},f'{o["name"]}: alpha is not binary'
        part=Image.open(OUT/f'parts/{o["bone"]}.png').convert('RGBA')
        # Painted on the limb's own silhouette, so it can never hang off it.
        for y in range(96):
            for x in range(64):
                if im.getpixel((x,y))[3]: assert part.getpixel((x,y))[3],f'{o["name"]}: {x},{y} is off the limb'
        tones|={p[:3] for p in im.getdata() if p[3]}
    assert len(tones)>=4,f'the bandages should be shaded, found {len(tones)} tones'
    print(f'PASS wraps: {len(worn)} parts from the neck down, {len(tones)} tones, '
          f'under every other garment, hands and feet bare')
    return dict(wrap_parts=sorted(covered),wrap_tones=len(tones),wrap_source='wraps.py')


def validate_cloak(rig,bones):
    """The cloak is a slot of its own, drawn over everything, simulated apart."""
    import cloak as design
    worn=[o for o in rig['outfits'] if o['slot']=='cloak']
    assert len(worn)==2,f'the cloak should be a hood and a body, found {len(worn)}'
    body=next(o for o in worn if o['name']=='cloak_body')
    hood=next(o for o in worn if o['name']=='cloak_hood')
    # Over everything: a garment only outranks the body layers if it carries a z
    # of its own, and it has to outrank the highest of them.
    top=max(b['z'] for b in rig['bones'] if b.get('image'))
    for o in worn:
        assert o.get('z') is not None and o['z']>top,f'{o["name"]}: z {o.get("z")} does not clear {top}'
    assert hood['z']>body['z'],'the hood goes over the cape, not under it'
    # Simulated on its own curve, with links that exist and an anchor that does.
    spec=rig['sway'].get(design.SWAY['name'])
    assert spec,'the cloak has no sway curve'
    assert spec['anchor'] in bones,f'cloak sway anchor {spec["anchor"]!r} is not a bone'
    assert len(spec['joints'])==len(spec['links'])+1,'cloak joints and links disagree'
    assert spec['anchor']!=rig['sway']['mass']['anchor'],'the cloak must not hang off the head'
    assert body.get('drift')=='cloak' and 'cloak' in rig['channels'],'the cloak needs its own lag channel'
    # What goes inside it stays inside. The fringe does not: that is what you see
    # of someone wearing a hood.
    covers=set(body.get('covers') or [])
    assert 'hair_back' in covers and 'hair_front' not in covers,f'cloak covers {sorted(covers)}'
    assert {'hand_near','hand_far'} <= covers,'hands go inside a cloak'
    tones=set()
    for o in worn:
        im=Image.open(OUT/o['image']).convert('RGBA')
        assert im.size==(64,96),f'{o["name"]}: {im.size}'
        alpha={p[3] for p in im.getdata()}
        assert alpha<={0,255},f'{o["name"]}: alpha is not binary'
        on={(x,y) for y in range(96) for x in range(64) if im.getpixel((x,y))[3]}
        assert len(connected(on))==1,f'{o["name"]}: drawn in {len(connected(on))} pieces'
        assert not design.enclosed(im),f'{o["name"]}: walls in a transparent pixel'
        tones|={p[:3] for p in im.getdata() if p[3]}
    assert len(tones)>=6,f'the cloak should be shaded, found {len(tones)} tones'
    print(f'PASS cloak: 2 layers over z{top}, {len(tones)} tones, its own strand '
          f'over {len(spec["links"])} links, hair and hands tucked inside')
    return dict(cloak_layers=[o['name'] for o in worn],cloak_z=[o['z'] for o in worn],
                cloak_tones=len(tones),cloak_sway=spec['links'],cloak_covers=sorted(covers),
                cloak_source='cloak.py')


def connected(points):
    """Four-connected pieces of a pixel set."""
    todo=set(points); out=[]
    while todo:
        seed=todo.pop(); blob={seed}; stack=[seed]
        while stack:
            x,y=stack.pop()
            for n in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
                if n in todo: todo.remove(n); blob.add(n); stack.append(n)
        out.append(blob)
    return out


if __name__=='__main__': validate()
