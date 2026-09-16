"""Author integer raster clusters at native resolution; no source resizing."""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'generated'
PAL = json.loads((ROOT / 'palette.json').read_text())
SIZE = (64, 96)
PARTS = {}
STAGE = 0
REVISION = 1
SILHOUETTE_TRANSFORM = None
ACTIVE_NAME = ''


def part(name, parent, pivot, end, z):
    global ACTIVE, ACTIVE_NAME
    ACTIVE_NAME = name
    ACTIVE = Image.new('RGBA', SIZE)
    PARTS[name] = dict(image=ACTIVE, parent=parent, pivot=pivot, end=end, z=z)


def shape(points, color, stage=0):
    if STAGE >= stage:
        if SILHOUETTE_TRANSFORM:
            hs, ws = SILHOUETTE_TRANSFORM
            points = [(round(34+(x-34)*ws*(hs if ACTIVE_NAME=='head' else 1)), round(25+(y-25)*hs) if ACTIVE_NAME=='head' else y) for x,y in points]
        ImageDraw.Draw(ACTIVE).polygon(points, fill=PAL[color])


def line(points, color, stage=0, width=1):
    if STAGE >= stage:
        ImageDraw.Draw(ACTIVE).line(points, fill=PAL[color], width=width)


def build(stage=4, revision=3):
    global PARTS, STAGE, REVISION
    PARTS = {}
    STAGE, REVISION = stage, revision
    # Back hair: large contiguous locks, behind all articulated body pieces.
    part('hair_back', 'head', (34, 22), (22, 51), 0)
    shape([(32,7),(40,7),(41,16),(36,25),(33,35),(30,44),(28,52),(24,57),(17,60),(19,55),(17,56),(18,51),(21,48),(20,44),(22,41),(20,40),(21,35),(24,31),(25,24),(28,20),(28,12)], 'outline')
    shape([(31,13),(37,15),(33,27),(30,32),(28,40),(26,45),(27,51),(24,54),(20,55),(22,50),(23,46),(22,43),(25,37),(23,38),(25,32),(28,27),(28,20)], 'hair_shadow')
    shape([(29,24),(33,22),(30,29),(27,32),(27,36),(24,38),(24,35),(26,31)], 'hair', 2)
    shape([(24,42),(26,42),(24,48),(22,50),(22,47)], 'hair', 3)
    if revision >= 4:
        shape([(28,22),(30,26),(27,32),(24,36),(25,40),(23,44),(23,48),(20,52),(18,54),(14,55),(17,51),(16,49),(18,46),(17,43),(14,42),(16,39),(15,37),(18,35),(19,32),(22,31),(24,27)], 'outline')
        shape([(26,27),(27,29),(23,34),(21,36),(19,37),(19,39),(22,40),(22,43),(20,46),(20,49),(17,52),(19,48),(19,44),(17,41),(18,39),(17,37),(21,34),(23,32)], 'hair_shadow')
        shape([(23,31),(26,29),(24,33),(21,36),(18,37),(18,36),(20,35),(21,33)], 'hair', 2)
        shape([(18,40),(21,41),(21,43),(19,43),(17,42)], 'hair', 3)
        shape([(20,46),(22,45),(21,49),(18,51),(19,49)], 'hair', 3)
    # Far limbs deliberately use the shadow skin ramp, preserving depth.
    part('arm_far', 'torso', (39,30), (44,43), 1)
    shape([(38,29),(43,30),(46,39),(46,44),(42,46),(39,38),(36,33)], 'skin_deep')
    shape([(40,31),(43,33),(44,40),(44,44),(42,44),(40,37)], 'skin_shadow', 1)
    part('forearm_far', 'arm_far', (44,43), (43,56), 2)
    shape([(42,41),(46,42),(46,49),(45,57),(41,58),(40,55),(42,47)], 'skin_deep')
    shape([(43,44),(45,44),(44,54),(42,55)], 'skin_shadow', 1)
    part('hand_far', 'forearm_far', (43,56), (43,62), 3)
    shape([(41,54),(45,55),(46,60),(44,63),(41,62),(40,59)], 'skin_deep')
    shape([(42,56),(44,56),(44,60),(42,61)], 'skin_shadow', 2)
    part('thigh_far', 'pelvis', (39,55), (42,74), 4)
    shape([(36,54),(43,54),(46,59),(46,64),(44,72),(45,76),(40,78),(37,74),(37,67),(35,60)], 'skin_deep')
    shape([(39,58),(44,59),(44,65),(42,72),(43,75),(40,75),(39,68)], 'skin_shadow')
    shape([(39,59),(41,59),(41,64),(40,69),(39,66)], 'skin', 3)
    part('shin_far', 'thigh_far', (42,74), (42,87), 5)
    shape([(39,71),(44,72),(45,78),(44,86),(45,89),(39,90),(38,86),(39,81),(38,76)], 'skin_deep')
    shape([(40,74),(43,73),(43,81),(41,85),(40,84)], 'skin_shadow', 1)
    shape([(39,83),(44,83),(44,88),(42,91),(38,90),(38,87)], 'leather_shadow')
    shape([(39,84),(42,84),(41,88),(39,88)], 'leather', 2)
    if revision >= 4:
        shape([(39,80),(41,81),(44,80),(44,86),(41,88),(38,87)], 'leather_shadow')
        shape([(39,81),(41,82),(43,81),(42,85),(39,86)], 'leather', 1)
    part('foot_far', 'shin_far', (42,87), (49,93), 6)
    shape([(39,86),(44,86),(45,89),(49,90),(51,92),(51,94),(39,94),(37,93),(37,90)], 'leather_shadow')
    shape([(39,88),(43,88),(44,90),(47,91),(48,92),(39,92)], 'leather')
    line([(39,90),(43,90),(44,91)], 'skin_warm', 3)
    # Foreground leg: bent contour with lit front plane and calf boot.
    part('thigh_near', 'pelvis', (33,55), (31,74), 7)
    shape([(29,54),(37,54),(40,59),(39,65),(36,69),(35,74),(33,78),(28,77),(27,73),(28,66),(27,60)], 'skin_deep')
    shape([(29,58),(37,58),(38,61),(36,67),(33,72),(33,76),(29,75),(29,69),(28,64)], 'skin_shadow')
    shape([(29,59),(36,59),(37,61),(35,64),(35,67),(32,70),(31,74),(28,74),(29,68)], 'skin', 1)
    shape([(36,64),(38,62),(37,68),(34,73),(34,75),(32,75),(33,70)], 'skin_warm', 2)
    part('shin_near', 'thigh_near', (31,74), (29,88), 8)
    shape([(28,72),(34,72),(35,77),(32,83),(32,88),(30,91),(25,90),(25,85),(26,80),(26,75)], 'skin_deep')
    shape([(28,74),(33,74),(32,79),(30,83),(30,87),(27,88),(26,85),(28,79)], 'skin_shadow')
    shape([(28,74),(31,74),(31,78),(29,81),(28,84),(26,84),(27,80)], 'skin', 1)
    shape([(26,83),(29,84),(32,82),(32,87),(31,90),(25,90),(25,87)], 'leather_shadow')
    shape([(26,84),(29,85),(30,84),(30,87),(28,89),(26,89)], 'leather', 1)
    line([(26,84),(28,85)], 'skin_warm', 3)
    if revision >= 4:
        shape([(29,72),(32,72),(32,76),(30,79),(28,79),(29,76)], 'skin', 1)
        shape([(26,81),(28,82),(32,80),(32,85),(30,88),(25,88),(25,85)], 'leather_shadow')
        shape([(26,82),(28,83),(30,82),(30,85),(28,87),(26,87)], 'leather', 1)
        line([(26,82),(28,83)], 'skin_warm', 3)
    part('foot_near', 'shin_near', (29,88), (36,94), 9)
    shape([(26,86),(31,86),(32,90),(36,91),(38,93),(38,94),(24,94),(24,90)], 'leather_shadow')
    shape([(26,88),(30,88),(30,91),(34,92),(35,93),(26,93),(25,92)], 'leather')
    shape([(26,88),(29,88),(29,89),(26,90),(25,92),(25,89)], 'skin_warm', 3)
    line([(27,91),(30,91)], 'skin_warm', 3)
    # Crop top and exposed midriff share one bone. Pelvis rotates independently.
    part('torso', 'root', (34,49), (34,29), 10)
    shape([(33,22),(39,23),(39,27),(43,29),(45,34),(45,37),(42,41),(41,45),(42,50),(39,54),(30,53),(28,50),(29,45),(27,41),(26,32),(29,28),(32,27)], 'skin_deep')
    shape([(33,24),(37,24),(37,29),(41,31),(42,36),(39,44),(39,48),(40,50),(37,52),(30,51),(30,47),(32,43),(30,34),(30,29),(33,28)], 'skin_shadow')
    shape([(33,26),(36,26),(36,30),(40,32),(40,35),(34,35),(31,31),(33,29)], 'skin', 1)
    shape([(31,45),(38,45),(38,48),(35,50),(30,50)], 'skin', 1)
    shape([(29,28),(32,29),(34,32),(38,33),(39,30),(42,30),(45,34),(45,38),(43,39),(42,44),(39,46),(30,45),(29,42),(27,38),(25,32)], 'gold_shadow')
    shape([(28,29),(31,30),(33,33),(38,35),(40,34),(40,31),(42,32),(44,35),(43,38),(40,39),(38,42),(31,41),(29,37),(27,34)], 'gold', 1)
    shape([(31,36),(32,39),(35,41),(38,42),(41,41),(40,44),(31,43)], 'gold_shadow', 2)
    line([(32,43),(37,44),(39,44)], 'gold', 3)
    if revision >= 2:
        shape([(31,29),(33,30),(35,32),(38,33),(39,31),(39,30),(40,31),(40,34),(38,35),(34,33)], 'skin', 3)
        shape([(30,46),(33,47),(37,47),(38,46),(38,48),(34,49),(30,48)], 'skin_shadow', 2)
        line([(37,50),(37,51)], 'skin_deep', 4)
    part('pelvis', 'root', (34,52), (34,59), 11)
    shape([(30,50),(39,50),(42,52),(44,56),(44,61),(39,63),(35,61),(29,62),(26,60),(26,55)], 'denim')
    shape([(30,52),(35,52),(34,55),(36,57),(35,60),(28,60),(28,56)], 'denim_light', 1)
    shape([(28,59),(35,59),(35,62),(28,62),(26,61),(26,59)], 'hem_shadow')
    shape([(39,59),(43,58),(44,59),(44,61),(40,62),(36,61),(36,59)], 'hem_shadow')
    shape([(28,59),(31,59),(31,61),(28,61)], 'hem', 3)
    if revision >= 2:
        line([(31,52),(36,52)], 'denim_light', 3)
        line([(39,54),(40,56),(39,58)], 'denim_light', 4)
    part('arm_near', 'torso', (29,31), (27,44), 12)
    shape([(27,30),(32,31),(34,35),(32,41),(30,45),(28,47),(24,45),(24,42),(25,36)], 'skin_deep')
    shape([(27,34),(31,35),(31,40),(29,44),(27,45),(25,44),(26,39)], 'skin_shadow')
    shape([(27,35),(30,35),(30,39),(28,41),(28,44),(25,44),(26,40)], 'skin', 1)
    shape([(27,29),(30,29),(33,32),(33,36),(30,37),(25,36),(24,34),(25,31)], 'gold_shadow')
    shape([(27,30),(30,31),(31,33),(31,35),(25,35),(25,33)], 'gold', 1)
    part('forearm_near', 'arm_near', (27,44), (24,57), 13)
    shape([(25,42),(29,43),(30,46),(28,50),(27,56),(26,59),(22,59),(21,56),(23,50),(23,46)], 'skin_deep')
    shape([(25,44),(28,44),(28,47),(26,52),(26,57),(23,58),(22,56),(24,50)], 'skin_shadow')
    shape([(25,46),(27,46),(26,50),(25,54),(25,57),(23,57),(23,54),(24,49)], 'skin', 1)
    if revision >= 3:
        shape([(25,43),(28,44),(28,46),(25,47),(24,46)], 'skin_shadow', 2)
        line([(23,55),(25,55)], 'skin_warm', 4)
    part('hand_near', 'forearm_near', (24,57), (23,64), 14)
    shape([(22,55),(26,56),(26,59),(28,61),(27,63),(25,62),(25,65),(23,66),(20,64),(20,60)], 'skin_deep')
    shape([(22,57),(25,57),(24,60),(26,61),(25,62),(24,64),(22,64),(21,62)], 'skin_shadow')
    shape([(22,58),(24,58),(23,60),(23,63),(21,62),(21,60)], 'skin', 1)
    # Profile: one eye, stepped brow/nose, exposed ear beneath violet locks.
    part('head', 'torso', (34,25), (36,10), 15)
    nose = [(46,17),(46,18),(44,19),(44,22),(42,24)] if revision >= 4 else [(48,18),(47,19),(45,19),(45,23),(42,25)]
    shape([(32,7),(39,7),(43,10),(44,13),(44,15),(44,16),*nose,(37,24),(35,22),(31,21),(29,16),(30,11)], 'skin_deep')
    shape([(35,9),(40,10),(42,12),(43,16),(45,18),(44,19),(44,22),(41,24),(37,22),(35,20),(32,19),(32,14)], 'skin_shadow')
    shape([(37,11),(41,12),(42,14),(42,17),(45,18),(43,19),(43,21),(40,22),(37,21),(36,18),(35,16)], 'skin', 1)
    shape([(33,16),(35,15),(37,17),(36,20),(34,20),(33,18)], 'skin', 1)
    line([(34,17),(35,17),(35,19)], 'skin_deep', 3)
    line([(41,14),(43,14)], 'hair_shadow', 3)
    line([(41,16),(43,16)], 'outline', 3)
    if revision >= 2:
        line([(41,16),(41,16)], 'hem', 4)
        line([(43,21),(44,21)], 'skin_deep', 4)
        line([(40,23),(42,23)], 'skin_deep', 4)
    if revision >= 4:
        line([(41,15),(42,15)], 'hem', 4)
        line([(43,15),(43,16)], 'outline', 4)
        line([(41,16),(42,16)], 'skin_shadow', 4)
        line([(44,17),(45,18)], 'skin', 3)
        line([(43,20),(44,20)], 'skin_deep', 4)
        line([(42,21),(43,21)], 'skin', 4)
    # Crown is attached to head, avoiding a separate floating face layer.
    shape([(28,9),(30,6),(33,6),(34,4),(39,4),(39,5),(43,6),(45,9),(45,12),(43,14),(40,11),(38,11),(37,14),(35,15),(33,15),(32,19),(31,23),(28,23),(27,19),(27,13)], 'outline')
    shape([(29,10),(31,7),(35,7),(35,5),(39,6),(42,7),(43,9),(43,11),(40,9),(37,10),(36,13),(33,14),(31,19),(29,20),(28,18),(29,14)], 'hair_shadow')
    shape([(30,10),(32,8),(36,8),(36,7),(39,7),(40,8),(37,9),(34,10),(33,13),(31,14),(31,16),(29,17)], 'hair', 2)
    if revision >= 3:
        shape([(35,9),(37,8),(40,8),(42,9),(39,9),(37,10)], 'hair', 3)
        line([(32,11),(31,13)], 'hair_shadow', 4)
        shape([(29,19),(31,17),(30,21),(28,22)], 'hair_shadow', 4)
    return PARTS


def composite(parts):
    image = Image.new('RGBA', SIZE)
    for item in sorted(parts.values(), key=lambda p:p['z']):
        image.alpha_composite(item['image'])
    return image


def silhouettes():
    global SILHOUETTE_TRANSFORM
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGB', (64*4, 112), '#dce0e6')
    draw = ImageDraw.Draw(sheet)
    # Raster-space alternative proportions drawn from geometry at native size.
    variants = [('A',.90,1.0),('B',1.0,1.0),('C',1.13,1.0),('D',.94,.83)]
    for idx, (label, head_scale, width_scale) in enumerate(variants):
        SILHOUETTE_TRANSFORM = (head_scale, width_scale)
        base = build(0)
        im = Image.new('RGBA', SIZE)
        for name,p in base.items():
            dst=Image.new('RGBA', SIZE, (35,5,33,255))
            dst.putalpha(p['image'].getchannel('A'))
            im.alpha_composite(dst)
        im.save(OUT/f'silhouette_{label}.png')
        sheet.paste(im,(idx*64,14),im)
        draw.text((idx*64+29,2),label,fill='#282c58')
    sheet.save(OUT/'silhouettes_1x.png')
    sheet.resize((1024,448),Image.Resampling.NEAREST).save(OUT/'silhouettes_4x.png')
    SILHOUETTE_TRANSFORM = None


def export(stage, revision):
    OUT.mkdir(parents=True,exist_ok=True)
    parts=build(stage,revision)
    im=composite(parts)
    tag=f'v{revision}_stage{stage}'
    im.save(OUT/f'{tag}.png')
    im.resize((512,768),Image.Resampling.NEAREST).save(OUT/f'{tag}_8x.png')
    if stage == 4:
        im.save(OUT/'character.png')
        folder=OUT/'parts'; folder.mkdir(exist_ok=True)
        bones=[dict(name='root',parent=None,pivot=[34,52],end=[34,49],z=-1)]
        for name,p in parts.items():
            p['image'].save(folder/f'{name}.png')
            bones.append(dict(name=name,parent=p['parent'],pivot=p['pivot'],end=p['end'],z=p['z'],image=f'parts/{name}.png',bounds=p['image'].getbbox()))
        rig=dict(width=64,height=96,baseline=94,bones=bones,palette=list(PAL.values()),angles='radians relative to bind pose; positive clockwise',space='global bind pivots; parent-relative runtime transforms')
        (OUT/'rig.json').write_text(json.dumps(rig,indent=2))
    return im


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--stage',type=int,default=4,choices=range(5))
    parser.add_argument('--revision',type=int,default=4,choices=[1,2,3,4])
    parser.add_argument('--silhouettes',action='store_true')
    args=parser.parse_args()
    if args.silhouettes: silhouettes()
    else: export(args.stage,args.revision)
