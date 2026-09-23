'use strict';
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterRagdoll}=require('../ragdoll.js');
const {CharacterHealth}=require('../health.js');
const h=new CharacterHealth();
assert.equal(h.parts.size,19);
h.impact('torso',30);assert.equal(h.vitality,100,'light contact is harmless');
h.impact('torso',100);assert(h.parts.get('torso').bruise>0);assert.equal(h.bleeding,0);
const first=h.parts.get('torso').bruise;h.impact('torso',100);assert.equal(h.parts.get('torso').bruise,first,'no repeated solver damage');
h.injure('forearm_near','cut',35);h.injure('shin_far','cut',20);
const before=h.blood;h.step(2);assert(h.blood<before);
h.bandage('forearm_near');assert.equal(h.parts.get('forearm_near').bleed,0);assert(h.parts.get('shin_far').bleed>0,'treatment is localized');
h.bandage('shin_far');const dressed=h.blood;h.step(3);
// A bandagem fecha a torneira; e com o metabolismo em dia o corpo ainda repõe o volume devagar.
assert(h.blood>=dressed,'bandagem estanca a perda');
assert.equal(Math.round((h.blood-dressed)*100)/100,.06,'reposição de ~1,2% de sangue por minuto');
h.metabolism.sangue=0;const seca=h.blood;h.step(3);assert.equal(h.blood,seca,'sem água o corpo não repõe nada');
h.metabolism.sangue=1;
// Wounds change only rendering; source pixels stay reusable across styling.
const rig=new Skeleton2D(CHARACTER_ASSET),clean=rig.rasterize();
assert.notDeepEqual(rig.rasterize({wounds:h.parts}),clean);assert.deepEqual(rig.rasterize(),clean);
// Real floor collisions feed the same model; a high fall hurts and settles.
const impactHealth=new CharacterHealth(),fall=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET),{autoRecover:false});
fall.start({ground:180});let contacts=0;
fall.onImpact=(name,speed)=>{contacts++;impactHealth.impact(name,speed);};
for(let n=0;n<700;n++){impactHealth.step(1/120);fall.step(1/120);}
assert(contacts>0);assert([...impactHealth.parts.values()].some(p=>p.bruise>0));
const revision=impactHealth.revision;
for(let n=0;n<120;n++){impactHealth.step(1/120);fall.step(1/120);}
assert.equal(impactHealth.revision,revision,'resting on floor must not deal damage');
// Separating an arm detaches all descendants while preserving their own joints.
const rag=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET));rag.start({ground:90});
const result=rag.sever('arm_near');assert.deepEqual(result.names,['arm_near','forearm_near','hand_near']);
h.sever(result.names,result.root,result.parent);
assert(h.amputated && !h.dead && !h.mobility.crawl);assert(h.parts.get('hand_near').missing);assert(!h.parts.get('arm_far').missing);
assert(!rag.joints.some(j=>j.b.name==='arm_near'));assert(rag.joints.some(j=>j.b.name==='forearm_near'));
assert(!rag.autoRecover);assert(!h.bandage('arm_near'));assert(h.parts.get(result.parent).bleed>0,'stump bleeds on attached parent');
assert.equal(rag.sever('arm_near'),null,'no repeated severing');
for(let n=0;n<900;n++){rag.step(1/120);for(const b of rag.bodies.values())assert([b.x,b.y,b.angle].every(Number.isFinite));}
assert(!rag.recovery,'cannot regrow by automatic get-up');
const arm=rag.bodies.get('arm_near');rag.pick(arm.x,arm.y);rag.move(100,20);
for(let n=0;n<120;n++)rag.step(1/120);
assert(Math.hypot(rag.point(arm,rag.grab.local).x-100,rag.point(arm,rag.grab.local).y-20)<1,'separated limb is draggable');
// Critical blood loss cannot resurrect via bandages or time.
const fatal=new CharacterHealth();fatal.injure('neck','cut',100);fatal.step(150);assert(fatal.dead);assert.equal(fatal.blood,0);assert(!fatal.bandage('neck'));
const decap=new CharacterHealth();decap.sever(['head'],'head','neck');assert(decap.dead);
const vision=new CharacterHealth();vision.injure('eye_right','eye',100);
assert.equal(vision.parts.get('eye_right').hp,0);assert(!vision.blind && !vision.dead);
vision.injure('eye_left','eye',100);assert(vision.blind && !vision.dead);
vision.step(20);assert(vision.blind,'destroyed eyes do not spontaneously heal');
const broken=new CharacterHealth();broken.injure('shin_near','fracture');
assert(broken.parts.get('shin_near').fracture && broken.parts.get('shin_near').boneHp===0);
assert(broken.parts.get('shin_near').hp<100 && broken.parts.get('shin_far').hp===100);
assert(broken.mobility.speed<1 && !broken.mobility.jump && !broken.dead);
const slow=broken.mobility.speed;broken.splint('shin_near');assert(broken.mobility.speed>slow);
assert(broken.parts.get('shin_near').fracture,'splint does not instantly heal');
const core=new CharacterHealth();for(let n=0;n<5;n++)core.injure('torso','cut',40);assert(!core.dead && core.vitalState==='critical');core.bandage('torso');core.step(30);assert(core.dead);
for(const name of ['forearm_far','hand_near','thigh_near','shin_far','foot_near','head']) {
  const r=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET));r.start({ground:110});
  const separated=r.sever(name);assert(separated && separated.names.includes(name));
  assert(!r.joints.some(j=>j.b.name===name));
  for(let n=0;n<240;n++)r.step(1/120);
  for(const b of r.bodies.values())assert([b.x,b.y,b.angle].every(Number.isFinite),name+' unstable');
  assert(!r.recovery,name+' must remain separated');
}
/* O vigor de SUBSTÂNCIA (a ficha) encolhe o que cada região aguenta: um
   personagem comum anda com o olho em 80/80 — inteiro. Nada disso pode ser
   lido como ferimento. Era o que pintava de cego quem nunca levou um
   arranhão, e o que fazia perna sadia andar devagar. */
{
  const v=new CharacterHealth();
  for(const p of v.parts.values()){p.maxHpBase=100;p.maxHp=80;p.hp=80;}
  assert.deepEqual([v.vision.right,v.vision.left],[100,100],'olho inteiro enxerga 100%, seja qual for o máximo dele');
  assert.equal(v.blind,false);
  assert.equal(v.mobility.speed,1,'perna inteira de quem tem pouco vigor não anda devagar');
  const olhos=new Skeleton2D(globalThis.CHARACTER_ASSET);
  olhos.blink=0;
  const limpo=olhos.rasterize({facing:1});
  assert.deepEqual(olhos.rasterize({facing:1,wounds:v.parts}),limpo,
    'corpo inteiro com máximo reduzido desenha igual a corpo sem ferida nenhuma');
  v.parts.get('eye_left').hp=20;
  assert.notDeepEqual(olhos.rasterize({facing:1,wounds:v.parts}),limpo,
    'e o olho ferido de verdade continua escurecendo');
  v.parts.get('eye_left').hp=0;
  assert.equal(v.vision.left,0,'olho perdido é zero');
}
/* E do outro lado da régua: o pico do vigor triplica o que cada região
   aguenta. Um corpo de 300 por região, inteiro, é um corpo SADIO — e o que
   conta como ferimento é a FRAÇÃO perdida, não o número de PV. */
{
  const forte=new CharacterHealth();
  for(const p of forte.parts.values()){p.maxHpBase=100;p.maxHp=300;p.hp=300;}
  for(const o of forte.organs.values()){o.maxHp=100;o.hp=100;}
  assert.equal(Math.round(forte.vitality),100,'corpo triplo e inteiro marca 100% de condição');
  assert.equal(forte.mobility.speed,1,'e anda a passo inteiro');
  assert.equal(forte.mobility.limp,false);
  assert.equal(forte.status,'Sem ferimentos');
  // metade do corpo levada: metade da condição, em qualquer escala
  for(const p of forte.parts.values())p.hp=150;
  assert.equal(Math.round(forte.vitality),50,'metade perdida é metade da condição');
  // o mancar começa na mesma FRAÇÃO de sempre (abaixo de 45% da perna)
  const fraco=new CharacterHealth();
  const coxa=n=>n.parts.get('thigh_near');
  coxa(fraco).hp=coxa(fraco).maxHp*.3;
  coxa(forte).hp=coxa(forte).maxHp*.3;
  assert.equal(Math.round(fraco.mobility.limpSeverity*100),Math.round(forte.mobility.limpSeverity*100),
    'perna a 30% manca igual, seja o máximo 100 ou 300');
}
/* ------------------------------------------------- O VIGOR NO OSSO E NA CURA
   SUBSTÂNCIA faz duas coisas com o corpo, e as duas se medem aqui: sobe o
   TETO da carne e do OSSO, e acelera a REGENERAÇÃO NATURAL. Em vigor 1 — o
   personagem padrão — tudo tem de dar exatamente o que sempre deu. */
{
  const padrao=new CharacterHealth();
  assert.equal(padrao.vigor,1,'o corpo nasce com o vigor do personagem padrão');
  assert.equal(padrao.parts.get('shin_near').maxBoneHp,100,'e com o osso padrão');
  assert.equal(padrao.parts.get('eye_left').maxBoneHp,null,'olho não tem osso');

  const forte=new CharacterHealth();
  forte.definirVigor(2);
  const canela=forte.parts.get('shin_near');
  assert.equal(canela.maxHp,200,'o dobro de vigor é o dobro de carne');
  assert.equal(canela.maxBoneHp,200,'e o dobro de OSSO — é isto que a mesa pediu');
  assert.equal(canela.boneHp,200,'um osso inteiro continua inteiro ao subir o teto');
  assert.equal(Math.round(forte.vitality),100,'e o corpo inteiro segue inteiro');

  /* O osso com mais vida resiste à pancada que quebra um osso comum. */
  const comum=new CharacterHealth(),duro=new CharacterHealth();
  duro.definirVigor(2);
  comum.impact('shin_near',230);
  duro.impact('shin_near',230);
  assert(comum.parts.get('shin_near').fracture,'230 quebra a canela de osso padrão');
  assert(!duro.parts.get('shin_near').fracture,'e não quebra a de quem tem o dobro de osso');
  duro.parts.get('shin_near').cooldown=0;
  duro.impact('shin_near',460);
  assert(duro.parts.get('shin_near').fracture,'mas o dobro da pancada quebra o dobro do osso');

  /* A consolidação fecha no teto DELE: comparar com um 100 fixo deixaria o
     osso grande fraturado para sempre. */
  const quebrado=new CharacterHealth();
  quebrado.definirVigor(3);
  quebrado.injure('shin_near','fracture');
  quebrado.splint('shin_near');
  const osso=quebrado.parts.get('shin_near');
  assert.equal(osso.boneHp,0);
  for(let i=0;i<600;i++)quebrado.step(30);
  assert(!osso.fracture,'o osso grande solda e a fratura fecha');
  assert.equal(osso.boneHp,osso.maxBoneHp,'e o osso fica cheio no teto dele');

  /* A regeneração natural: mais vigor, mais corpo reposto por segundo — e o
     teto que a cura alcança é o teto do vigor, e não um 100 fixo. */
  const curaDe=v=>{
    const h=new CharacterHealth();
    h.definirVigor(v);
    const p=h.parts.get('torso');
    const partida=p.maxHp*.5;
    p.hp=partida;
    /* Dois minutos de relógio, e não duas horas: com a janela grande os dois
       corpos chegam ao teto e a medida perde o sentido. */
    for(let i=0;i<120;i++)h.step(1);
    return {ganho:p.hp-partida,fracao:(p.hp-partida)/p.maxHp};
  };
  const fraco=curaDe(1),vigoroso=curaDe(3);
  assert(vigoroso.ganho>fraco.ganho*2,'quem tem vigor repõe muito mais corpo por segundo');
  assert(vigoroso.fracao>fraco.fracao*1.5,'e repõe mais depressa até em fração do próprio corpo');
  const cheio=new CharacterHealth();
  cheio.definirVigor(2);
  const tronco=cheio.parts.get('torso');
  tronco.hp=190;
  for(let i=0;i<4000;i++)cheio.step(30);
  assert.equal(tronco.hp,tronco.maxHp,'a cura natural sobe até o teto do vigor, e não para nos 100');

  /* Vigor 1 tem de dar exatamente o que dava antes de existir vigor nenhum. */
  const antes=new CharacterHealth(),depois=new CharacterHealth();
  depois.definirVigor(1);
  antes.parts.get('torso').hp=50;depois.parts.get('torso').hp=50;
  for(let i=0;i<50;i++){antes.step(30);depois.step(30);}
  assert.equal(antes.parts.get('torso').hp,depois.parts.get('torso').hp,'o corpo padrão cura como sempre curou');
}

console.log('PASS: localized bruises/cuts, blood loss, bandages, wound rendering, collision damage and cooldown, detached physical arm, no regrowth, fatal injuries, healthy eyes under a reduced maximum, vigor no osso e na regeneracao');
