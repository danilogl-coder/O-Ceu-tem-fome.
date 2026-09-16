"""Transcribe the unchanged source pixels into editable 64x96 scanlines.

Only transparent padding is added. No enlargement, reduction or resampling.
"""
from pathlib import Path
from PIL import Image
import json

ROOT=Path(__file__).resolve().parents[1]
ref=Image.open(ROOT/'references/reference.png')

def xy(x,y): return [19+round(x),20+round(y)]

def owner(x,y,c):
    if y<=12:
        if x<11 and y>=7: return 'hair_back'
        if c in [1,2] or (c==0 and (y<=6 or x<=13)): return 'hair_front'
        return 'head'
    if y<=29 and c in [0,1,2] and x<11: return 'hair_back'
    if y<=24:
        if x<=9 and y>=17: return 'arm_near' if y<22 else 'forearm_near'
        return 'torso'
    if y<=33 and x<8:
        return 'forearm_near' if y<30 else 'hand_near'
    if y<=32: return 'pelvis'
    side='near' if x<13 else 'far'
    if y<=40: return f'thigh_{side}'
    if y<49 or (side=='near' and y<50): return f'shin_{side}'
    return f'foot_{side}'

defs=[
 ('hair_back','head',(13,10),(5,22),0),
 ('arm_far','torso',(16,15),(17,22),1),
 ('forearm_far','arm_far',(17,22),(17,29),2),
 ('hand_far','forearm_far',(17,29),(17,32),3),
 ('thigh_far','pelvis',(16,32),(16,41),4),
 ('shin_far','thigh_far',(16,41),(16,49),5),
 ('foot_far','shin_far',(16,49),(19,53),6),
 ('thigh_near','pelvis',(10,32),(9,41),7),
 ('shin_near','thigh_near',(9,41),(8,50),8),
 ('foot_near','shin_near',(8,50),(10,55),9),
 ('torso','root',(13,25),(12,14),10),
 ('pelvis','root',(13,28),(13,32),11),
 ('arm_near','torso',(8,17),(7,22),12),
 ('forearm_near','arm_near',(7,22),(5,30),13),
 ('hand_near','forearm_near',(5,30),(4,33),14),
 ('head','torso',(14,12),(14,4),15),
 ('hair_front','head',(14,12),(14,4),16),
]
layers={name:[[None]*64 for _ in range(96)] for name,*_ in defs}
for sy in range(56):
    for sx in range(26):
        c=ref.getpixel((sx,sy))
        if c==16: continue
        x,y=xy(sx,sy)
        layers[owner(sx,sy,c)][y][x]=c
parts=[]
for name,parent,pivot,end,z in defs:
    spans=[]
    for y,row in enumerate(layers[name]):
        x=0
        while x<64:
            color=row[x]; stop=x+1
            while stop<64 and row[stop]==color: stop+=1
            if color is not None: spans.append([y,x,stop-1,color])
            x=stop
    parts.append(dict(name=name,parent=parent,pivot=xy(*pivot),end=xy(*end),z=z,spans=spans))
doc=dict(width=64,height=96,root=xy(13,28),reference_offset=[19,20],palette=[('#%02x%02x%02x'%tuple(ref.getpalette()[i*3:i*3+3])) for i in range(16)],parts=parts)
(ROOT/'native_clusters.json').write_text(json.dumps(doc,indent=2))
print('Transcribed original pixels without resampling into native 64x96 document')
