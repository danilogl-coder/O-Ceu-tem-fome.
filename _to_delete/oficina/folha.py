import json, sys, math, os
from PIL import Image
base = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(base,'pixels.json')))
nomes = list(d.keys())
saida = sys.argv[1]
zooms = [int(z) for z in (sys.argv[2].split(',') if len(sys.argv)>2 else ['8','3','1'])]
def sprite(n):
    im = Image.new('RGBA',(64,64),(0,0,0,0)); px = im.load()
    for y in range(64):
        for x in range(64):
            c = d[n][y*64+x]
            if c: px[x,y] = (int(c[1:3],16), int(c[3:5],16), int(c[5:7],16), 255)
    return im
larg = sum(64*z+10 for z in zooms) + 10
alt  = max(64*z for z in zooms) + 20
img = Image.new('RGB',(larg, alt*len(nomes)),(18,16,26))
for i,n in enumerate(nomes):
    x = 10
    for z in zooms:
        s = sprite(n)
        if z>1: s = s.resize((64*z,64*z), Image.NEAREST)
        img.paste(s,(x, i*alt+10), s)
        x += 64*z+10
img.save(os.path.join(base,saida))
print(saida, img.size)
