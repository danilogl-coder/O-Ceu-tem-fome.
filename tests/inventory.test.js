'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { Inventory, ITEM_DEFS, footprint, itemIcon, CELL } =
  require(path.resolve(__dirname, '../inventory.js'));

// --- footprints and rotation -------------------------------------------------
assert.deepEqual(footprint('splint', 0), { w: 3, h: 1 }, 'tala deitada ocupa 3x1');
assert.deepEqual(footprint('splint', 1), { w: 1, h: 3 }, 'tala em pe ocupa 1x3');
assert.deepEqual(footprint('antibiotic', 0), { w: 1, h: 2 });
assert.deepEqual(footprint('antibiotic', 1), { w: 2, h: 1 });

// Every sprite must match the footprint it claims, or the art will not line up
// with the squares it reserves.
for (const [id, def] of Object.entries(ITEM_DEFS)) {
  assert.equal(def.grid.length, def.h * CELL, `${id}: altura do sprite`);
  for (const row of def.grid) assert.equal(row.length, def.w * CELL, `${id}: largura do sprite`);
  const used = new Set(def.grid.join('').split('').filter(c => c !== '.'));
  for (const ch of used) assert(def.palette[ch], `${id}: cor ${ch} fora da paleta`);
  assert(used.size > 3, `${id}: sprite quase vazio`);
}

// --- placement rejects overlap and out-of-bounds -----------------------------
{
  const inv = new Inventory(10, 6);
  assert.equal(inv.capacity, 60);
  const b = inv.place('bandage', 0, 0);
  assert(b, 'bandagem entra numa maleta vazia');
  assert.equal(inv.fits('bandage', 1, 0, 0), false, 'nao pode sobrepor');
  assert.equal(inv.fits('bandage', 2, 0, 0), true, 'encosta sem sobrepor');
  assert.equal(inv.fits('splint', 8, 0, 0), false, 'tala 3x1 nao cabe na coluna 8');
  assert.equal(inv.fits('splint', 7, 0, 0), true);
  assert.equal(inv.fits('antibiotic', 0, 5, 0), false, 'antibiotico 1x2 nao cabe na ultima linha');
  assert.equal(inv.fits('bandage', -1, 0, 0), false);
  assert.equal(inv.place('bandage', 1, 0), null, 'place recusa posicao ocupada');
}

// --- rotation --------------------------------------------------------------
{
  const inv = new Inventory(10, 6);
  const s = inv.place('splint', 0, 0);
  assert(inv.rotate(s.id), 'tala gira para 1x3');
  assert.equal(s.rot, 1);
  assert.deepEqual([s.x, s.y], [0, 0]);

  // Rotating against the edge pulls the item back inside instead of failing.
  const inv2 = new Inventory(10, 6);
  const s2 = inv2.place('splint', 0, 4);          // 3x1 na penultima linha
  assert(inv2.rotate(s2.id), 'gira e recua para caber');
  assert.equal(s2.rot, 1);
  assert.equal(s2.y, 3, 'subiu para a linha 3 para os 3 quadrados caberem');

  // A rotation with no room at all must leave the item exactly where it was.
  const inv3 = new Inventory(3, 1);
  const s3 = inv3.place('splint', 0, 0);
  assert.equal(inv3.rotate(s3.id), false, 'sem espaco a rotacao falha');
  assert.equal(s3.rot, 0);
  assert.deepEqual([s3.x, s3.y], [0, 0], 'item nao se mexeu');
}

// --- moving ----------------------------------------------------------------
{
  const inv = new Inventory(10, 6);
  const a = inv.place('bandage', 0, 0);
  inv.place('bandage', 4, 0);
  assert.equal(inv.move(a.id, 4, 0), false, 'nao move para cima de outro');
  assert.equal(inv.move(a.id, 0, 1), true);
  assert.deepEqual([a.x, a.y], [0, 1]);
  // Moving onto its own squares is legal - skipId ignores the mover itself.
  assert.equal(inv.move(a.id, 1, 1), true, 'desliza sobre a propria area');
}

// --- stacking --------------------------------------------------------------
{
  const inv = new Inventory(10, 6);
  assert.equal(inv.add('bandage', 2), 0, 'duas bandagens entram numa pilha so');
  assert.equal(inv.entries.length, 1);
  assert.equal(inv.count('bandage'), 2);
  assert.equal(inv.add('bandage', 2), 0, 'estoura a pilha de 3 e abre outra');
  assert.equal(inv.entries.length, 2);
  assert.equal(inv.count('bandage'), 4);
  assert.equal(ITEM_DEFS.bandage.stack, 3);
  assert.equal(inv.entries[0].qty, 3);
  assert.equal(inv.entries[1].qty, 1);
}

// --- the case fills up ------------------------------------------------------
{
  const inv = new Inventory(4, 2);                 // 8 quadrados
  assert.equal(inv.add('splint', 2), 0, 'duas talas numa pilha de 3x1');
  assert.equal(inv.entries.length, 1);
  const left = inv.add('bandage', 99);
  assert(left > 0, 'sobra item quando a maleta enche');
  assert(inv.used <= inv.capacity, 'nunca passa da capacidade');
}

// --- consuming --------------------------------------------------------------
{
  const inv = new Inventory(10, 6);
  inv.add('antibiotic', 5);                        // pilha de 4 + pilha de 1
  assert.equal(inv.count('antibiotic'), 5);
  assert.equal(inv.entries.length, 2);
  assert(inv.consume('antibiotic', 1), 'gasta um');
  assert.equal(inv.count('antibiotic'), 4);
  assert.equal(inv.entries.length, 1, 'a pilha de 1 sumiu do tabuleiro');
  assert.equal(inv.consume('antibiotic', 9), false, 'nao gasta o que nao tem');
  assert.equal(inv.count('antibiotic'), 4, 'falha nao consome nada');
  assert(inv.consumeFor('antibiotic'), 'consumo por efeito');
  assert.equal(inv.hasFor('splint'), false);
}

// --- auto sort --------------------------------------------------------------
{
  const inv = new Inventory(10, 6);
  inv.add('bandage', 3); inv.add('splint', 2); inv.add('antibiotic', 4);
  // Scatter them, then check the sort packs everything back without loss.
  inv.entries[0].x = 7; inv.entries[0].y = 4;
  inv.entries[1].x = 0; inv.entries[1].y = 2;
  const before = inv.entries.length, area = inv.used;
  assert(inv.autoSort(), 'tudo coube depois de organizar');
  assert.equal(inv.entries.length, before, 'nenhum item perdido');
  assert.equal(inv.used, area, 'area total inalterada');
  // No square may be claimed twice after a sort.
  const map = inv.occupancy();
  const seen = map.filter(Boolean).length;
  assert.equal(seen, area, 'ocupacao bate com a area dos itens');
  for (const e of inv.entries) {
    const f = footprint(e.def, e.rot);
    assert(e.x >= 0 && e.y >= 0 && e.x + f.w <= inv.cols && e.y + f.h <= inv.rows,
      `${e.def} ficou fora da maleta`);
  }
}

// --- sorting never deletes an item that no longer fits ----------------------
{
  const inv = new Inventory(3, 1);
  inv.place('splint', 0, 0);
  inv.entries.push({ id: 99, def: 'bandage', x: 0, y: 0, rot: 0, qty: 1 });
  assert.equal(inv.autoSort(), false, 'avisa que nem tudo coube');
  assert.equal(inv.entries.length, 2, 'o item sem lugar continua na lista');
}

// --- svg rendering ----------------------------------------------------------
{
  const flat = itemIcon('splint', 0), turned = itemIcon('splint', 1);
  assert(flat.includes(`viewBox="0 0 ${3 * CELL} ${1 * CELL}"`), 'viewBox deitado');
  assert(turned.includes(`viewBox="0 0 ${1 * CELL} ${3 * CELL}"`), 'viewBox em pe');
  assert(turned.includes('rotate(90)'), 'sprite girado por transform');
  assert(flat.includes('<rect'), 'desenha pixels');
  assert.equal(itemIcon('nada'), '', 'id desconhecido nao quebra');
}

// --- failed packing must preserve a valid, completely full layout -----------
{
  const inv=new Inventory(7,3);
  for(const [def,x,y,rot] of [
    ['splint',0,2,0],['splint',1,1,0],['splint',1,0,0],
    ['bandage',4,0,1],['bandage',5,1,0],['bandage',3,2,0],
    ['antibiotic',5,2,1],['bandage',0,0,1],['antibiotic',5,0,1]
  ])assert(inv.place(def,x,y,rot));
  const before=inv.snapshot(),entries=inv.entries.slice(),serial=inv.serial;
  assert.equal(inv.used,inv.capacity);
  assert.equal(inv.autoSort(),false,'greedy cannot repack this valid arrangement');
  assert.deepEqual(inv.snapshot(),before,'failure preserves positions, quantities and revision');
  assert.equal(inv.serial,serial);
  entries.forEach((entry,i)=>assert.equal(inv.entries[i],entry,'failure preserves references'));
}

// --- split reserves space, merge conserves the remainder --------------------
{
  const inv=new Inventory(10,6),a=inv.place('bandage',0,0,0,3);
  const b=inv.split(a.id,1);
  assert(b);assert.equal(a.qty,2);assert.equal(b.qty,1);assert.notEqual(a.id,b.id);
  assert.equal(inv.count('bandage'),3);assert.equal(inv.used,4);
  assert.equal(inv.merge(b.id,a.id),1);assert.equal(inv.get(b.id),null);
  assert.equal(a.qty,3);assert.equal(inv.used,2);
  const c=inv.place('bandage',3,0,0,2),d=inv.place('bandage',6,0,0,2);
  assert.equal(inv.merge(c.id,d.id),1,'partial merge respects stack limit');
  assert.equal(c.qty,1);assert.equal(d.qty,3);
  assert.deepEqual([c.x,c.y],[3,0],'remainder stays at source');
  const before=inv.snapshot();
  assert.equal(inv.merge(c.id,d.id),0,'full target');
  assert.equal(inv.merge(c.id,c.id),0,'same stack');
  assert.equal(inv.merge(c.id,999),0,'missing target');
  assert.equal(inv.merge(999,c.id),0,'missing source');
  assert.deepEqual(inv.snapshot(),before);
  const splint=inv.place('splint',0,2);
  assert.equal(inv.merge(c.id,splint.id),0,'different item types');
  const tiny=new Inventory(2,1),stack=tiny.place('bandage',0,0,0,3);
  const full=tiny.snapshot(),serial=tiny.serial;
  assert.equal(tiny.split(stack.id,1),null);
  assert.deepEqual(tiny.snapshot(),full);assert.equal(tiny.serial,serial);
}

// --- invalid inputs never mutate the inventory -----------------------------
{
  for(const size of [0,-1,1.5,NaN,Infinity,'10'])assert.throws(()=>new Inventory(size,6),RangeError);
  const inv=new Inventory(),a=inv.place('bandage',0,0,0,3);
  const before=inv.snapshot();
  for(const n of [0,-1,1.5,NaN,Infinity,'1',undefined]){
    if(n!==undefined){inv.add('bandage',n);assert.equal(inv.consume('bandage',n),false);}
    assert.equal(inv.split(a.id,n),null);
  }
  for(const n of [-1,1.5,NaN,Infinity,'1']){
    assert.equal(inv.move(a.id,n,1),false);assert.equal(inv.move(a.id,1,n),false);
    assert.equal(inv.place('splint',n,1),null);assert.equal(inv.at(n,1),null);
  }
  for(const rot of [-1,2,true,NaN]){
    assert.equal(inv.move(a.id,2,1,rot),false);assert.equal(inv.place('splint',2,1,rot),null);
  }
  for(const id of ['unknown','__proto__','constructor',null]){
    assert.equal(inv.place(id,4,1),null);assert.equal(inv.add(id,1),1);
    assert.equal(inv.consume(id),false);assert.equal(inv.findSlot(id),null);
  }
  assert.equal(inv.place('bandage',4,1,0,4),null);
  assert.equal(inv.split(a.id,3),null);assert.equal(inv.split(a.id,4),null);
  assert.deepEqual(inv.snapshot(),before);
}

// --- mixed operations preserve quantity accounting and disjoint footprints --
{
  const inv=new Inventory(),totals={bandage:0,splint:0,antibiotic:0};
  let seed=317;
  const rnd=n=>{seed=(seed*1664525+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
  for(let step=0;step<400;step++){
    const def=Object.keys(totals)[rnd(3)],a=inv.entries[rnd(inv.entries.length)],b=inv.entries[rnd(inv.entries.length)];
    switch(rnd(7)){
      case 0:{const n=1+rnd(4);totals[def]+=n-inv.add(def,n);break;}
      case 1:if(inv.consume(def))totals[def]--;break;
      case 2:if(a)inv.split(a.id,1);break;
      case 3:if(a&&b)inv.merge(a.id,b.id);break;
      case 4:if(a)inv.move(a.id,rnd(10),rnd(6),rnd(2));break;
      case 5:if(a)inv.rotate(a.id);break;
      case 6:inv.autoSort();break;
    }
    for(const id of Object.keys(totals))assert.equal(inv.count(id),totals[id]);
    const occupied=new Set();
    for(const e of inv.entries){
      assert(e.qty>0&&e.qty<=ITEM_DEFS[e.def].stack);
      assert(inv.fits(e.def,e.x,e.y,e.rot,e.id));
      const f=footprint(e.def,e.rot);
      for(let y=e.y;y<e.y+f.h;y++)for(let x=e.x;x<e.x+f.w;x++){
        assert(!occupied.has(y*inv.cols+x));occupied.add(y*inv.cols+x);
      }
    }
    assert.equal(occupied.size,inv.used);
  }
}
console.log('PASS: footprints, rotation, bounds, stacks, atomic sorting, split, merge, input validation, quantity conservation, SVG');
