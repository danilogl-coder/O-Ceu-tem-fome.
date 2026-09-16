"""Lossless nearest-neighbor inspection and chronological comparisons."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT/'generated'


def panel(images, labels, name, scale=4):
    sheet=Image.new('RGB',(len(images)*80,116),'#dce0e6')
    d=ImageDraw.Draw(sheet)
    for i,(im,label) in enumerate(zip(images,labels)):
        d.text((i*80+6,3),label,fill='#282c58')
        sheet.paste(im,(i*80+8,17),im)
    sheet.save(OUT/f'{name}_1x.png')
    sheet.resize((sheet.width*scale,sheet.height*scale),Image.Resampling.NEAREST).save(OUT/f'{name}.png')


def ref_sheet():
    """The 26x56 reference pasted at its rig offset, for like-for-like panels."""
    sheet=Image.new('RGBA',(64,96))
    sheet.paste(Image.open(ROOT/'references/reference.png').convert('RGBA'),(19,20))
    return sheet


def main():
    sprite=Image.open(OUT/'character.png').convert('RGBA')
    for scale in [1,4,8]:
        sprite.resize((64*scale,96*scale),Image.Resampling.NEAREST).save(OUT/f'preview_{scale}x.png')
    versions=[Image.open(OUT/f'v{v}_stage4.png').convert('RGBA') for v in [1,2,3,4,5,6]]
    panel(versions,['V1','V2','V3','V4 rejected','V5 exact','V6 body'],'refinements')
    for a,b in [(1,2),(2,3),(3,4),(4,5),(5,6)]:
        panel([versions[a-1],versions[b-1]],[f'Before V{a}',f'After V{b}'],f'before_after_v{b}')
    ref=Image.open(ROOT/'references/reference.png').convert('RGBA')
    # Reference kept at its actual 26x56 resolution, enlarged only by integer NN.
    canvas=Image.new('RGB',(640,512),'#dce0e6')
    d=ImageDraw.Draw(canvas)
    d.text((24,12),'REFERENCE / ORIGINAL PIXELS',fill='#282c58')
    d.text((342,12),'BODY + HAIR / NO CLOTHES',fill='#282c58')
    ref=ref.resize((208,448),Image.Resampling.NEAREST)
    big=sprite.crop((19,20,45,76)).resize((208,448),Image.Resampling.NEAREST)
    canvas.paste(ref,(40,40),ref); canvas.paste(big,(360,40),big)
    canvas.save(OUT/'reference_comparison.png')
    rig=__import__('json').loads((OUT/'rig.json').read_text())
    parts=[b for b in rig['bones'] if 'image' in b]
    rows=(len(parts)+5)//6
    sheet=Image.new('RGB',(64*6,112*rows),'#dce0e6'); d=ImageDraw.Draw(sheet)
    for i,b in enumerate(parts):
        x,y=(i%6)*64,(i//6)*112
        im=Image.open(OUT/b['image'])
        sheet.paste(im,(x,y+12),im)
        d.text((x+2,y+1),b['name'].replace('_near',' N').replace('_far',' F'),fill='#282c58')
        px,py=b['pivot']; d.rectangle((x+px-1,y+py+11,x+px+1,y+py+13),fill='#ff4b66')
    sheet.resize((1152,112*rows*3),Image.Resampling.NEAREST).save(OUT/'modular_parts.png')
    # Show every part at a useful scale with its own pivot, including both hands.
    cols=5; rows=(len(parts)+cols-1)//cols
    atlas=Image.new('RGB',(cols*144,rows*216),'#dce0e6'); d=ImageDraw.Draw(atlas)
    for i,b in enumerate(parts):
        x,y=(i%cols)*144,(i//cols)*216
        im=Image.open(OUT/b['image']); box=im.getbbox();crop=im.crop(box)
        big=crop.resize((crop.width*6,crop.height*6),Image.Resampling.NEAREST)
        ax=x+(144-big.width)//2;ay=y+28+(170-big.height)//2
        atlas.paste(big,(ax,ay),big)
        d.text((x+7,y+7),b['name'],fill='#282c58')
        px=ax+(b['pivot'][0]-box[0])*6+3;py=ay+(b['pivot'][1]-box[1])*6+3
        d.line((px-4,py,px+4,py),fill='#dd3857',width=1);d.line((px,py-4,px,py+4),fill='#dd3857',width=1)
        d.text((x+7,y+197),f"pivot {b['pivot'][0]},{b['pivot'][1]}",fill='#525d70')
    atlas.save(OUT/'articulation_sheet.png')
    panel([Image.open(ROOT/'history/before_anatomy/character.png'),Image.open(OUT/'anatomy_v1.png'),sprite],['Antes','Anatomia V1','Final'],'anatomy_comparison',6)
    panel([Image.open(ROOT/'history/before_skin_lighting/character.png'),sprite],['Antes','Pele refinada'],'skin_lighting_comparison',6)
    reference=Image.new('RGBA',(64,96))
    reference.paste(Image.open(ROOT/'references/body_reference.png').convert('RGBA'),(19,20))
    panel([reference,Image.open(ROOT/'history/before_reference_refinement/character.png'),sprite],['Referencia','Antes','Refinado'],'body_reference_comparison',6)
    before_hair=Image.open(ROOT/'history/before_hair_refinement/character.png')
    panel([ref_sheet(),before_hair,sprite],['Referencia','Cabelo antigo','Cabelo refinado'],'hair_comparison',6)
    # Head crop at 12x so every hair cluster is legible next to the reference.
    Z=12; crop=(17,18,41,52)
    strip=Image.new('RGB',((crop[2]-crop[0])*Z*3+24,(crop[3]-crop[1])*Z),'#dce0e6')
    for i,im in enumerate([ref_sheet(),before_hair.convert('RGBA'),sprite]):
        tile=im.crop(crop).resize(((crop[2]-crop[0])*Z,(crop[3]-crop[1])*Z),Image.Resampling.NEAREST)
        strip.paste(tile,(i*((crop[2]-crop[0])*Z+12),0),tile)
    strip.save(OUT/'hair_detail.png')


if __name__=='__main__': main()
