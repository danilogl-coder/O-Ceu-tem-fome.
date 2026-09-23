import json, math, os
from PIL import Image, ImageDraw
base = os.path.dirname(os.path.abspath(__file__))
saida = os.path.join(os.path.dirname(base), 'Claude outputs')
d = json.load(open(os.path.join(base, 'pixels.json')))
nomes = list(d.keys()); FUNDO = (17,15,25)
def sprite(n):
    im = Image.new('RGBA',(64,64),(0,0,0,0)); px = im.load()
    for y in range(64):
        for x in range(64):
            c = d[n][y*64+x]
            if c: px[x,y] = (int(c[1:3],16), int(c[3:5],16), int(c[5:7],16), 255)
    return im
def folha(arq, zoom, cols, rotulo=True, pad=8):
    cell = 64*zoom; lbl = 13 if rotulo else 0
    rows = math.ceil(len(nomes)/cols)
    img = Image.new('RGB',(cols*(cell+pad)+pad, rows*(cell+lbl+pad)+pad), FUNDO)
    dr = ImageDraw.Draw(img)
    for i,n in enumerate(nomes):
        cx = pad+(i%cols)*(cell+pad); cy = pad+(i//cols)*(cell+lbl+pad)
        s = sprite(n)
        if zoom>1: s = s.resize((cell,cell), Image.NEAREST)
        img.paste(s,(cx,cy),s)
        if rotulo: dr.text((cx+1, cy+cell+1), n, fill=(190,185,205))
    img.save(os.path.join(saida, arq)); print(arq, img.size)
folha('ficha-pericias.png', 4, 7)
folha('ficha-pericias-tamanho-real.png', 1, 14, rotulo=False, pad=6)
folha('ficha-pericias-prancha.png', 2, 7)
perto = ['reflexos','atletismo','adestramento','percepcao','furtividade','fortitude']
cell = 64*8
img = Image.new('RGB',(3*(cell+10)+10, 2*(cell+24)+10), FUNDO); dr = ImageDraw.Draw(img)
for i,n in enumerate(perto):
    cx = 10+(i%3)*(cell+10); cy = 10+(i//3)*(cell+24)
    img.paste(sprite(n).resize((cell,cell), Image.NEAREST),(cx,cy))
    dr.text((cx+2, cy+cell+4), n, fill=(200,195,215))
img.save(os.path.join(saida,'ficha-pericias-de-perto.png')); print('de-perto', img.size)
