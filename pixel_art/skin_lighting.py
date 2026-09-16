"""Continuous skin planes, painted before splitting into existing rigid masks.

No blur, gradients or alpha blending. The same integer color at both sides of
a bind-pose overlap prevents the edge of a module becoming an anatomical line.
Silhouettes, pivots, face and hair remain exactly as approved in revision 5.
"""
from PIL import Image, ImageDraw


def shade(parts, palette):
    def group(names, base, clusters):
        field = Image.new('RGBA', (64, 96), palette[base])
        draw = ImageDraw.Draw(field)
        for color, points in clusters:
            draw.polygon([(x + 19, y + 20) for x, y in points], fill=palette[color])
        for name in names:
            mask = parts[name].getchannel('A')
            parts[name] = field.copy()
            parts[name].putalpha(mask)

    # One light across collarbone, ribcage, waist and hip. Shadow tapers down
    # the turning side, rather than forming horizontal bands at bone ends.
    group(['neck', 'torso', 'abdomen', 'pelvis'], 16, [
        (4, [(11,10),(16,10),(16,14),(15,16),(13,15),(12,13)]),
        (16,[(13,12),(14,12),(14,14),(16,15),(15,16),(13,14)]),
        (4, [(8,15),(10,16),(11,19),(11,22),(10,25),(10,28),(8,31),(7,29)]),
        (4, [(17,15),(19,16),(20,21),(17,24),(17,27),(20,28),(20,33),(15,35),(14,33),(16,30),(16,27),(15,25),(16,21),(18,18)]),
        (6, [(19,20),(19,22),(17,24),(17,26),(18,28),(18,31),(16,33),(17,29),(16,26),(16,24),(18,21)]),
        (5, [(10,14),(12,14),(13,15),(12,16),(10,16)]),
        (5, [(14,16),(16,16),(18,17),(18,18),(16,19),(14,19),(13,18)]),
        (16,[(12,19),(14,20),(17,20),(17,21),(14,22),(12,21)]),
        (5, [(12,21),(13,22),(14,22),(14,24),(13,27),(14,29),(13,32),(11,32),(10,30),(10,28),(11,26),(12,24)]),
        (16,[(12,25),(13,26),(13,27),(12,27)]),
    ])
    # Continuous highlight through elbow and wrist; no rings around joints.
    group(['arm_near','forearm_near','hand_near'],16,[
        (4,[(10,15),(11,17),(10,20),(9,23),(9,27),(8,30),(8,35),(6,36),(6,33),(7,29),(7,26),(8,23),(8,20)]),
        (5,[(8,15),(9,15),(10,16),(9,18),(8,20),(7,23),(7,25),(6,28),(6,30),(5,32),(5,33),(4,33),(5,29),(5,26),(6,23),(6,21),(7,18)]),
        (16,[(6,22),(7,22),(7,24),(6,25)]),
        (16,[(4,32),(5,33),(5,35),(4,35)]),
        (6,[(7,32),(8,32),(7,33)]),
    ])
    group(['arm_far','forearm_far','hand_far'],4,[
        (6,[(17,14),(19,16),(19,26),(18,30),(19,35),(17,35),(16,31),(17,26)]),
        (16,[(15,16),(16,16),(16,20),(15,24),(16,27),(16,31),(15,33),(15,29),(14,25)]),
    ])
    group(['thigh_near','shin_near','foot_near'],16,[
        (4,[(13,29),(15,30),(15,35),(13,39),(11,43),(11,47),(9,51),(10,54),(13,55),(7,56),(7,53),(8,49),(9,46),(9,43),(10,40),(11,36),(12,33)]),
        (6,[(14,34),(14,37),(12,40),(11,42),(11,44),(10,44),(10,42),(12,38)]),
        (5,[(9,29),(11,30),(12,32),(11,35),(10,37),(9,40),(9,42),(8,43),(7,43),(7,41),(8,38),(9,35),(8,33)]),
        (16,[(8,39),(9,39),(9,40),(8,41)]),
        (5,[(7,44),(8,43),(8,46),(7,49),(7,52),(8,53),(10,54),(8,54),(6,53),(6,50),(7,47)]),
        (4,[(6,54),(7,55),(13,55),(13,56),(6,56)]),
    ])
    group(['thigh_far','shin_far','foot_far'],4,[
        (6,[(17,29),(19,30),(19,38),(17,41),(18,45),(18,50),(17,53),(21,54),(22,56),(16,56),(16,52),(17,48),(16,45),(15,42),(16,39),(17,35)]),
        (3,[(18,32),(19,32),(19,38),(17,41),(17,43),(16,42),(17,38)]),
        (16,[(14,30),(15,31),(16,33),(16,36),(15,39),(15,42),(16,44),(16,47),(15,50),(15,53),(16,54),(15,54),(14,52),(15,48),(14,45),(14,41),(14,39),(15,35),(14,33)]),
        (4,[(14,40),(15,40),(15,42),(14,43)]),
        (4,[(16,53),(18,54),(20,54),(20,55),(16,54)]),
    ])
    # Hip light continues into the near thigh. Paint the shared volume onto
    # both modules, retaining their separate silhouettes and occluded pixels.
    for name in ['abdomen', 'pelvis', 'thigh_near']:
        mask = parts[name].getchannel('A')
        draw = ImageDraw.Draw(parts[name])
        for color, polygon in [
            (16,[(8,27),(12,27),(14,29),(14,33),(12,36),(8,35)]),
            (5,[(10,27),(12,28),(12,31),(11,34),(10,36),(9,36),(9,33),(8,31)]),
        ]:
            draw.polygon([(x+19,y+20) for x,y in polygon],fill=palette[color])
        parts[name].putalpha(mask)
    return parts
