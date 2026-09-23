/* Comidas — os itens de comida e bebida da bolsa, o que cada um faz com a fome
   e a sede, as receitas de cozinha e a lógica de consumir.

   Roda depois de `inventory.js` e acrescenta ao ITEM_DEFS global os ids do
   contrato (pães, frutas, ingredientes, bebidas, pratos prontos). Cada item que
   se come ou se bebe tem `consumo`: o que ele alivia, que efeitos dá e como o
   personagem o segura na mão (o “pedido de consumo” que `consumo.js` anima).

   Aqui também mora a cozinha: RECEITAS (2 a 4 passos curtos por estação),
   ESTACOES e a máquina de estados do preparo — pura, determinística e sem DOM,
   para a interface de `mestre/interacoes-comida.js` só desenhar o que ela diz
   e para os testes rodarem no Node.

   Decisões de sabor: alívio negativo = mata a fome ou a sede; comida mal feita
   (qualidade 1) alivia metade, caprichada (3) alivia 25% a mais e ainda deixa
   `bem_alimentada`; estragada alivia 3/4 e arrisca intoxicação. Ingredientes de
   despensa (sal, açúcar, óleo, pó de café, manteiga, milho) rendem vários usos:
   o pacote aberto vira uma entrada própria na bolsa com os usos que restam. */
(function (root) {
  'use strict';
  const DEFS = root.ITEM_DEFS || (typeof require === 'function' ? require('./inventory.js').ITEM_DEFS : null);
  if (!DEFS) return;

  /* ================================================================ ícones
     16×16 por quadrado da bolsa, contorno K escuro de matiz e luz de cima à
     direita, como os itens que já existiam. */
  const ICONES = {
    pao_frances: {w: 1, h: 1, palette: {d: '#6e3514', o: '#a8561c', O: '#d48532', y: '#eab45a', W: '#fbe3a6', h: '#f6cf84', K: '#230521'},
      grid: [
        '................',
        '................',
        '...........KKK..',
        '.........KKyWyK.',
        '........KyyWWyhK',
        '.......KOyWWyOhK',
        '......KOyWWyOOyK',
        '.....KOyWWyOOOyK',
        '....KOyWWyOOOOK.',
        '...KOOWWyOOOOoK.',
        '..KoOyWyOOOOoK..',
        '.KoOOyyOOOooK...',
        '.KooOOOOOoodK...',
        'KddooOOoodKK....',
        '.KKddddddK......',
        '...KKKKKK.......']},
    pao_forma: {w: 1, h: 1, palette: {d: '#7a3c16', o: '#b0622a', O: '#cf8a42', y: '#eab46a', c: '#f7e4bc', C: '#dcbf8a', K: '#230521'},
      grid: [
        '................',
        '.......KKKKKKK..',
        '......KooooooOK.',
        '.....KoCCCCCCCOK',
        '.....KoCCCCCCCoK',
        '...KKKKKKKCCCoK.',
        '..KOOOOyyyKCCoK.',
        '.KOcccccccyKCoK.',
        '.KOcccccccOKCoK.',
        '..KOcCcccOKCCoK.',
        '..KOcccccOKooOK.',
        '..KOcccccOKKKK..',
        '..KOcccCcOK.....',
        '..KOcccccOK.....',
        '..KdOOOOOoK.....',
        '...KKKKKKK......']},
    pao_queijo: {w: 1, h: 1, palette: {d: '#8a5020', o: '#c2803a', O: '#e2ad5e', y: '#f3d28a', W: '#fff2c8', q: '#b06a28', K: '#230521'},
      grid: [
        '................',
        '................',
        '......KKKKK.....',
        '.....KOOOyWK....',
        '....KoOOOOyWK...',
        '....KoOqOOOyK...',
        '....KooOOOOyK...',
        '....KdooOOqOK...',
        '..KKKKddooOKKK..',
        '.KOOOyKKKKKOyWK.',
        'KoOOOOyKoOOOOyWK',
        'KoOqOOOKoOqOOOyK',
        'KooOOOOKooOOOOyK',
        'KdooOOqKdooOOqOK',
        '.KddooOKKddooOK.',
        '..KKKKK..KKKKK..']},
    coxinha: {w: 1, h: 1, palette: {d: '#7a3a10', o: '#b8641c', O: '#dc8f2c', y: '#f2b84c', W: '#ffe39a', q: '#9c5218', e: '#fbd070', K: '#230521'},
      grid: [
        '................',
        '........KK......',
        '.......KyWK.....',
        '.......KOyK.....',
        '......KOOyyK....',
        '......KoOOyK....',
        '.....KooOqyyK...',
        '....KdoOOOOyyK..',
        '...KdoqOOOeOyyK.',
        '..KddoOOOOOOOyK.',
        '..KdooOqOOeOOyK.',
        '..KdqoOOOOOqOOK.',
        '..KddooOeOOOOoK.',
        '...KddooOOqOoK..',
        '....KKddooooK...',
        '......KKKKKK....']},
    bolacha: {w: 1, h: 1, palette: {a: '#2f6fc0', A: '#5a9ae8', b: '#1d4a8e', w: '#fdf3d8', c: '#ecc680', C: '#c9974a', h: '#a8702e', r: '#d8403a', R: '#ff8a6a', K: '#230521'},
      grid: [
        '................',
        '................',
        '.K.K.K.K.K.K.K..',
        'KaKaKaKaKaKaKaK.',
        'KAAAAAAAAAAAAAAK',
        'KbaaaaaaaaaaaaAK',
        'KbaccCwccCarrRAK',
        'KbachCwchCarrrAK',
        'KbaccCwccCarrrAK',
        'KbachCwchCaaaaAK',
        'KbaccCwccCaAAAAK',
        'KbaaaaaaaaaaaaAK',
        'KbbbbbbbbbbbbbAK',
        '.KaKaKaKaKaKaKaK',
        '..K.K.K.K.K.K.K.',
        '................']},
    biscoito: {w: 1, h: 1, palette: {m: '#4a2614', M: '#6e3c20', h: '#8e5634', n: '#2e140a', w: '#f6ecdc', W: '#fffaf2', K: '#230521'},
      grid: [
        '................',
        '................',
        '....KKKKKKKK....',
        '..KKmMMMMMhhKK..',
        '.KmMMnMMnMMhhmK.',
        'KmMMMMMMMMMMhhmK',
        'KmMnMMnMMnMMMhmK',
        'KmmMMMMMMMMMMmmK',
        'KnmmmmmmmmmmmmnK',
        'KwwwwwwwwwwwwWWK',
        'KwwwwwwwwwwwwwWK',
        'KnmmmmmmmmmmmmnK',
        '.KnmmmmmmmmmmnK.',
        '..KKnnnnnnnnKK..',
        '....KKKKKKKK....',
        '................']},
    pacoca: {w: 1, h: 1, palette: {y: '#e6c488', O: '#cfa062', o: '#b88a48', d: '#8a5a22', q: '#9c6a2e', W: '#f8e4b4', r: '#c8302c', R: '#f0604a', w: '#fff2d8', s: '#8a1e22', K: '#230521'},
      grid: [
        '................',
        '................',
        '....KKKKKKK.....',
        '..KKyyyWyyyKK...',
        '.KyyOyyyyOyyyK..',
        '.KOyyyyOyyyyWK..',
        '.KoOyyOyyyyOyK..',
        '.KooOOOOOOOOyK..',
        '.KdooooqoooooK..',
        'KrrRRRRRRRRRRrK.',
        'KrwwrwwrwwrwwRK.',
        'KrrrrrrrrrrrrRK.',
        'KsrrrrrrrrrrrRK.',
        '.KssrrrrrrrrrK..',
        '..KKKKKKKKKKK...',
        '................']},
    banana: {w: 1, h: 1, palette: {Y: '#f6cf3a', W: '#fff09a', o: '#c8921e', b: '#5a3c18', K: '#230521'},
      grid: [
        '................',
        '................',
        '................',
        '.KK.............',
        'KWWK...........K',
        'KbbK..........Kb',
        'KoYWK........KbK',
        '.KYYWK......KWWK',
        '.KoYYWK....KWYoK',
        '.KoYYYWKKKKWYYoK',
        '..KoYYYWWWWYYoK.',
        '..KoYYYYYYYYYoK.',
        '...KoYYYYYYYoK..',
        '...KoooYYYoooK..',
        '....KoooooooK...',
        '.....KKoooKK....']},
    laranja: {w: 1, h: 1, palette: {d: '#a8400a', o: '#d86a12', O: '#f28a1c', y: '#ffb04a', W: '#ffd98a', b: '#5a3a14', L: '#4c9a3a', l: '#8ad060', K: '#230521'},
      grid: [
        '............KK..',
        '..........KKLLK.',
        '......KKKKLlllK.',
        '....KKOOLllLLK..',
        '...KoOOObyyyK...',
        '..KooOOOyyyyyK..',
        '.KddoOOOyyyyyyK.',
        '.KddoOOOOyyyyyK.',
        '.KddooOOOOyyyyK.',
        '.KdddoOOOOOOOOK.',
        '.KddddooOOOOOOK.',
        '.KdddddooOOOOOK.',
        '..KdddddoooooK..',
        '...KddddddddK...',
        '....KddddddK....',
        '.....KKKKKK.....']},
    goiaba: {w: 1, h: 1, palette: {d: '#4a7a22', o: '#7aa832', O: '#a6c84a', y: '#d6e27a', b: '#5a3a14', P: '#f06a82', p: '#ffa4b0', s: '#b83a52', S: '#fff0c8', K: '#230521'},
      grid: [
        '................',
        '................',
        '.....KKK........',
        '...KKObOK.......',
        '..KoOOOOyK......',
        '.KdoOOOOyyK.....',
        '.KdoOOOOOKKKK...',
        'KddoOOOKKOOOOKK.',
        'KdddoOKoOpPPpOOK',
        'KdddooKopPPPPpOK',
        '.KdddoKoPPsPsPOK',
        '.KddddKoPPPSsPOK',
        '..KdddKopPssPpOK',
        '...KKdKoopPPpoOK',
        '.....KKKKooooKK.',
        '.........KKKK...']},
    manga: {w: 1, h: 1, palette: {G: '#3c6a24', g: '#7aa83a', y: '#e8c23a', o: '#f08a2a', r: '#d8402e', W: '#ffd68a', b: '#5a3a14', L: '#4c9a3a', K: '#230521'},
      grid: [
        '..............KK',
        '...........KKKLK',
        '..........KbLLK.',
        '......KKKKbKKK..',
        '....KKyooorrK...',
        '...KyyooorrrrK..',
        '..KgyyyoorrrrrK.',
        '..KgyyyooorrWrK.',
        '.KggyyyooorrrrK.',
        '.KGggyyyoooorrK.',
        '.KGgggyyyoooorK.',
        '.KGGgggyyyoooK..',
        '..KGGggggyyyoK..',
        '...KGGGgggyyK...',
        '....KKGGGggK....',
        '......KKKKK.....']},
    ovo: {w: 1, h: 1, palette: {e: '#d2c0ae', w: '#f6efe4', W: '#fffaf2', m: '#a8683a', M: '#c88a52', n: '#e2ac72', N: '#f4cc98', K: '#230521'},
      grid: [
        '................',
        '................',
        '................',
        '....KKK.........',
        '...KwwWK........',
        '..KwwwwWKKKK....',
        '..KwwwwWKnnNK...',
        '.KewwwwKMnnnNK..',
        '.KewwwwKMnnnNK..',
        '.KewwwKmMnnnnNK.',
        '.KeewwKmMnnnnNK.',
        '..KeewKmMMnnnnK.',
        '...KKKKmmMMnnnK.',
        '.......KmmMMnK..',
        '........KKKKK...',
        '................']},
    manteiga: {w: 1, h: 1, palette: {y: '#f2cf5a', Y: '#ffe68a', w: '#f2ece0', W: '#fffbf2', e: '#c4b8a4', g: '#2e8a4a', G: '#52b86a', K: '#230521'},
      grid: [
        '................',
        '................',
        '................',
        '....KKKKKKKK....',
        '..KKwwwwwwwwKK..',
        '.KwyyyyyyyyyywK.',
        'KwyyYYYYyyyyyywK',
        'KwyYYyyYYYYYyywK',
        'KwwyyyyyyyyyywwK',
        'KewwwwwwwwwwwwWK',
        'KeggggggggggggGK',
        'KegYYggggggYYgGK',
        'KeggggggggggggGK',
        'KeewwwwwwwwwwwWK',
        '.KKeeeeeeeeeeKK.',
        '...KKKKKKKKKK...']},
    queijo: {w: 1, h: 1, palette: {Y: '#f2c230', W: '#ffe07a', L: '#fff3b8', y: '#d9a21e', o: '#b87816', h: '#c08a1c', K: '#230521'},
      grid: [
        '................',
        '................',
        '............K...',
        '..........KKWK..',
        '........KKWWLWK.',
        '......KKWWWWWLK.',
        '....KKWWWhWWWWK.',
        '..KKWWWWWWWWWWK.',
        '.KWWWWhWWWWWWWWK',
        'Kyyyyyyyyyyyyyyy',
        'KYYYhhYYYhhYYYYy',
        'KYYYhhYYYhhYYYYy',
        'KYYYYYYYYYYYhhYy',
        'Kooooooooooooooy',
        '.KKKKKKKKKKKKKKK',
        '................']},
    presunto: {w: 1, h: 1, palette: {f: '#fde2e0', p: '#e87a88', P: '#f6a8b0', q: '#c65a6a', K: '#230521'},
      grid: [
        '................',
        '................',
        '.......KKKKKKK..',
        '......KfppppPfK.',
        '.....KfppPPPPpfK',
        '....KKKKKKKPPpfK',
        '...KfppppPfKpqfK',
        '..KfppPPPPpfKfK.',
        '..KKKKKKKPpfKK..',
        '.KfppppPfKqfK...',
        'KfppPPPPpfKK....',
        'KfpPPPPPpfK.....',
        'KfppppppqfK.....',
        '.KfqqppqfK......',
        '..KKKKKKK.......',
        '................']},
    leite: {w: 1, h: 2, palette: {w: '#f2efe6', W: '#fff8ec', e: '#c9c8dc', b: '#2f68c0', B: '#5a94e6', y: '#f2c236', Y: '#ffe38a', K: '#230521'},
      grid: [
        '................',
        '.......KKK......',
        '......KeeeK.....',
        '.....KWeWWK.....',
        '....KeeWWWWK....',
        '...KeWWWWWWWK...',
        '..KewwwwwwwwWK..',
        '..KewwwwwwwwWK..',
        '..KewwwwwwwwWK..',
        '..KewwyyyywwWK..',
        '..KewyyyyYywWK..',
        '..KewyyyyyywWK..',
        '..KewwyyyywwWK..',
        '..KewwwwwwwwWK..',
        '..KebbwbbwbbWK..',
        '..KbBBbBBbBBbK..',
        '..KbbbbbbbbbBK..',
        '..KbbbbbbbbbBK..',
        '..KbbwbwbbwbBK..',
        '..KbbbwbbwbbBK..',
        '..KbbbbbbbbbBK..',
        '..KbbbbbbbbbBK..',
        '..KbbbbbbbbbBK..',
        '..KewwwwwwwwWK..',
        '..KewwwwwwwwWK..',
        '..KewwwwwwwwWK..',
        '..KeeeeeeeeeeK..',
        '..KeeeeeeeeeeK..',
        '..KeeeeeeeeeWK..',
        '...KKKKKKKKKK...',
        '................',
        '................']},
    miojo: {w: 1, h: 1, palette: {r: '#d8342c', R: '#ff6a4a', d: '#8a1818', y: '#f2c236', Y: '#ffe38a', o: '#c8781c', w: '#f6f0e2', W: '#ffd24a', K: '#230521'},
      grid: [
        '................',
        '.K.K.K.K.K.K.K..',
        'KrKrKrKrKrKrKrK.',
        'KRRRRRRRRRRRRRRK',
        'KdrrrrrrrrrrrrRK',
        'KdrWWWWWWWWWWWRK',
        'KdrrrrrrrrrrrrRK',
        'KdrrrYyYyYyYrYRK',
        'KdrrYyYyoyYyYrRK',
        'KdrywowwwwwowrRK',
        'KdrrwwwwwwwwwrRK',
        'KdrrwwwwwwwwwrRK',
        'KdrrrwwwwwwrrrRK',
        'KdddddddddddddRK',
        '.KrKrKrKrKrKrKrK',
        '..K.K.K.K.K.K.K.']},
    marmita: {w: 2, h: 1, palette: {a: '#b9bdd2', A: '#e4e8f4', d: '#7c7f9c', L: '#cfd3e4', W: '#eef2fc', f: '#e8d49a', F: '#f6e8bc', q: '#b89c5a', t: '#3a2a8a', K: '#230521'},
      grid: [
        '................................',
        '................................',
        '................................',
        '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
        '.KWWWWWWWWWWWWWWWWWWWWWWWWWWWLK.',
        '.KLLLLLLLLLLLLLLLLLLLLLLLLLLLLK.',
        'KddddddddddddddddddddddddddddddK',
        '.KaaaaaffffffffffffffffffaaaaAK.',
        '.KaaaaaFFFFFFFFFFFFFFFFFFaaaaAK.',
        '.KaaaaafftftttfttftttffffaaaaAK.',
        '.KaaaaaffffffffffffffffffaaaaAK.',
        '.KaaaaaqqqqqqqqqqqqqqqqqqaaaaAK.',
        '.KdaaaaaaaaaaaaaaaaaaaaaaaaaaAK.',
        '..KddddddddddddddddddddddddddK..',
        '...KKKKKKKKKKKKKKKKKKKKKKKKKK...',
        '................................']},
    milho_pipoca: {w: 1, h: 1, palette: {v: '#e0c070', V: '#f6e0a0', b: '#a88a3a', r: '#d8342c', R: '#ff6a4a', k: '#e8a01c', y: '#ffd23a', w: '#fff4d0', K: '#230521'},
      grid: [
        '...K.K.K.K.K....',
        '..KrKrKrKrKrKK..',
        '.KRRRRRRRRRRRRK.',
        '.KrrrrrrrrrrrRK.',
        '.KrrrrrrrrrrrrK.',
        '.KbvvvvvvvvvvVK.',
        '.KbyvvkvvykvyVK.',
        '.KbkvwvkyvvwvVK.',
        '.KbvkvvykvyvkVK.',
        '.KbyvkyvvwvvyVK.',
        '.KbvvykvyvkyvVK.',
        '.KbkyvvwvvykvVK.',
        '.KbykvyvkyvvkVK.',
        '.KbbbbbbbbbbbVK.',
        '..KKKKKKKKKKKK..',
        '................']},
    po_cafe: {w: 1, h: 1, palette: {r: '#8a2a1c', R: '#b8452e', h: '#c85a3a', d: '#5a1810', y: '#e8c060', w: '#fff0d8', c: '#6a3a1c', C: '#9a6034', k: '#4a2412', s: '#b0a0d8', K: '#230521'},
      grid: [
        '................',
        '................',
        '...KKKKKKKKKK...',
        '..KrRRRRRRRRhK..',
        '..KdddddddddrK..',
        '..KrrrrrrrrrhK..',
        '..KryyyyyyyyhK..',
        '..KrwwwswswwhK..',
        '..KrwwccccwwhK..',
        '..KrwwcCcckwhK..',
        '..KrwwwccwwwhK..',
        '..KryyyyyyyyhK..',
        '..KrrrrrrrrrhK..',
        '..KdddddddddrK..',
        '..KKKKKKKKKKKK..',
        '................']},
    acucar: {w: 1, h: 1, palette: {w: '#f4f1ea', W: '#fff8ec', e: '#c9c6dc', b: '#e0588a', B: '#ff8ab0', K: '#230521'},
      grid: [
        '....KKKKKKKK....',
        '...KWWWWWWWWK...',
        '...KWWWWWWWWK...',
        '..KewwwwwwwwWK..',
        '..KewewwwwwwWK..',
        '..KewwwwwewwWK..',
        '..KewwwwwwwwWK..',
        '..KBBBBBBBBBBK..',
        '..KbbbbwbwbbBK..',
        '..KbbbwbwbwbbK..',
        '..KbbbbbbbbbbK..',
        '..KewwwwwwwwWK..',
        '..KewwwwwwwwWK..',
        '..KeeeeeeeeeWK..',
        '...KKKKKKKKKK...',
        '................']},
    sal: {w: 1, h: 1, palette: {b: '#2a7ac8', B: '#5aa8f0', d: '#164a86', w: '#f4f1ea', W: '#fff8ec', m: '#c9c6dc', M: '#fff8ec', K: '#230521'},
      grid: [
        '.....KmMmmK.....',
        '....KKBBBBKK....',
        '...KBBBBBBBBK...',
        '...KbbbbbbbBK...',
        '...KdbbbbbbBK...',
        '...KdbbbbbbBK...',
        '...KdbbbbbbBK...',
        '...KWWWWWWWWK...',
        '...KwwwwbwwWK...',
        '...KwwbwwbwwK...',
        '...KwwwwwwwwK...',
        '...KdbbbbbbBK...',
        '...KdbbbbbbBK...',
        '...KdddddddBK...',
        '....KKKKKKKK....',
        '................']},
    oleo: {w: 1, h: 2, palette: {r: '#d8342c', R: '#ff6a4a', o: '#e8b020', O: '#ffd34a', W: '#fff0a0', d: '#a86a10', L: '#2e8a4a', l: '#52b86a', g: '#1c5a30', G: '#f2c236', y: '#fff0a0', K: '#230521'},
      grid: [
        '................',
        '......KKKK......',
        '.....KRRRRK.....',
        '.....KrrrrK.....',
        '.....KrrrrK.....',
        '.....KooooK.....',
        '.....KooooK.....',
        '.....KooooK.....',
        '....KooooooK....',
        '...KdoooooooK...',
        '..KodooooooooK..',
        '..KddoooooooOK..',
        '..KddooooooWOK..',
        '..KddooooooWOK..',
        '..KddooooooWOK..',
        '..KllllllllllK..',
        '..KLLLLLLLLLLK..',
        '..KLLGGGGLgLLK..',
        '..KLLGGGyLLLLK..',
        '..KLLGGGGLLLLK..',
        '..KLLLLLLLgLLK..',
        '..KLLLLLLLLLLK..',
        '..KggggggggggK..',
        '..KddooooooWOK..',
        '..KddooooooWOK..',
        '..KddooooooWOK..',
        '..KddooooooWOK..',
        '..KddooooooWOK..',
        '..KddoooooooOK..',
        '...KooooooooK...',
        '....KKKKKKKK....',
        '................']},
    boldo: {w: 1, h: 1, palette: {L: '#5a9e4a', l: '#8ccc6a', d: '#346a2a', v: '#b8e090', b: '#6a4a22', K: '#230521'},
      grid: [
        '................',
        '................',
        '.......KKKK.....',
        '......KllllK....',
        '.....KlLLvLlKKK.',
        '...KKKKdddLLlllK',
        '..KllllKKKLLvLlK',
        '.KlLLLLlKbddddlK',
        '.KdLLvLLbKKKKKK.',
        '..KLLLdLLllllK..',
        '..KLLlKLLLvLlK..',
        '.KlLLLbdddddlK..',
        '..KdLbKKKKKKK...',
        '...KbK..........',
        '..KbK...........',
        '...K............']},
    suco: {w: 1, h: 1, palette: {o: '#f07a1c', O: '#ffa84a', d: '#b44a0c', W: '#fff0d0', y: '#ffd23a', Y: '#fff08a', L: '#4c9a3a', s: '#e84a6a', S: '#ffd0dc', K: '#230521'},
      grid: [
        '...........KSK..',
        '..........KSK...',
        '.....KKKKKKsKK..',
        '....KWWWWWsWWyK.',
        '...KOOOOOOOOOyK.',
        '...KdoooooooOyK.',
        '...KdoooLLooOyK.',
        '...KdoyyyyooOyK.',
        '...KdyyYYWyoOyK.',
        '...KdyYYYYyoOyK.',
        '...KdyyYYyyoOyK.',
        '...KdoyyyyooOyK.',
        '...KdoooooooOyK.',
        '...KdoooooooOyK.',
        '...KddddddddOK..',
        '....KKKKKKKKK...']},
    agua_coco: {w: 1, h: 1, palette: {d: '#2c5a22', g: '#4c8a32', G: '#72b048', l: '#a6d46a', w: '#f3eed8', c: '#d4e4b0', s: '#e84a6a', S: '#ffd0dc', K: '#230521'},
      grid: [
        '...........KSK..',
        '..........KSK...',
        '..........KsK...',
        '.....KKKKKSK....',
        '....KwwcccswK...',
        '...KgwcccscwK...',
        '..KggGwwwwwllK..',
        '.KddgGGGGGGllGK.',
        '.KddggGGGGGGGGK.',
        '.KdddgGGGGGGGGK.',
        '.KdddggGGGGGGGK.',
        '.KddGdgggGGGGGK.',
        '..KdddddgggggK..',
        '...KddddddddK...',
        '....KddddddK....',
        '.....KKKKKK.....']},
    garrafa_vazia: {w: 1, h: 2, palette: {b: '#2f62bf', B: '#6a9ae8', v: '#cfe4f2', e: '#8aaccc', L: '#f4fbff', r: '#5aa0d8', R: '#8ccaf0', q: '#2a6aa6', w: '#f4fbff', a: '#5aa8e0', A: '#8ccaf0', t: '#b8a24a', T: '#d8c878', c: '#7a7a3a', C: '#a0a05a', K: '#230521'},
      grid: [
        '......KKKK......',
        '.....KBBBBK.....',
        '.....KbbbBK.....',
        '.....KbbbbK.....',
        '.....KvvvvK.....',
        '.....KvvvvK.....',
        '.....KvvvvK.....',
        '....KvvvvvvK....',
        '...KvvvvvvvLK...',
        '...KvvvvvvvLK...',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KeRRRRRRRRRK..',
        '..KerrrrrrrrrK..',
        '..KerrwrwrrrrK..',
        '..KerrrwrwrrrK..',
        '..KerrrrrrrrrK..',
        '..KeqqqqqqqqqK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvLvK..',
        '..KevvvvvvvvvK..',
        '...KvvvvvvvvK...',
        '....KKKKKKKK....',
        '................']},
    garrafa_agua: {w: 1, h: 2, palette: {b: '#2f62bf', B: '#6a9ae8', v: '#cfe4f2', e: '#8aaccc', L: '#f4fbff', r: '#5aa0d8', R: '#8ccaf0', q: '#2a6aa6', w: '#f4fbff', a: '#5aa8e0', A: '#8ccaf0', t: '#b8a24a', T: '#d8c878', c: '#7a7a3a', C: '#a0a05a', K: '#230521'},
      grid: [
        '......KKKK......',
        '.....KBBBBK.....',
        '.....KbbbBK.....',
        '.....KbbbbK.....',
        '.....KvvvvK.....',
        '.....KvvvvK.....',
        '.....KvvvvK.....',
        '....KvvvvvvK....',
        '...KvvvvvvvLK...',
        '...KvvvvvvvLK...',
        '..KevvvvvvvLvK..',
        '..KeAAAAAAAAaK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaLaK..',
        '..KeRRRRRRRRRK..',
        '..KerrrrrrrrrK..',
        '..KerrwrwrrrrK..',
        '..KerrrwrwrrrK..',
        '..KerrrrrrrrrK..',
        '..KeqqqqqqqqqK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaLaK..',
        '..KeaaaaaaaaaK..',
        '...KaaaaaaaaK...',
        '....KKKKKKKK....',
        '................'],
      variants: {
        potavel3: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KeAAAAAAAAaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KerrrwrwrrrK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaaaK..',
          '...KaaaaaaaaK...',
          '....KKKKKKKK....',
          '................'],
        duvidosa3: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KeTTTTTTTTtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KerrrwrwrrrK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttttK..',
          '...KttttttttK...',
          '....KKKKKKKK....',
          '................'],
        contaminada3: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KeCCCCCCCCcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KerrrwrwrrrK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccccK..',
          '...KccccccccK...',
          '....KKKKKKKK....',
          '................'],
        potavel2: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KeAAAAAAAArK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaaaK..',
          '...KaaaaaaaaK...',
          '....KKKKKKKK....',
          '................'],
        duvidosa2: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KeTTTTTTTTrK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttttK..',
          '...KttttttttK...',
          '....KKKKKKKK....',
          '................'],
        contaminada2: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KeCCCCCCCCrK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccccK..',
          '...KccccccccK...',
          '....KKKKKKKK....',
          '................'],
        potavel1: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KerrrwrwrrrK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeAAAAAAAAaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaLaK..',
          '..KeaaaaaaaaaK..',
          '...KaaaaaaaaK...',
          '....KKKKKKKK....',
          '................'],
        duvidosa1: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KerrrwrwrrrK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeTTTTTTTTtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttLtK..',
          '..KetttttttttK..',
          '...KttttttttK...',
          '....KKKKKKKK....',
          '................'],
        contaminada1: [
          '......KKKK......',
          '.....KBBBBK.....',
          '.....KbbbBK.....',
          '.....KbbbbK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '.....KvvvvK.....',
          '....KvvvvvvK....',
          '...KvvvvvvvLK...',
          '...KvvvvvvvLK...',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeRRRRRRRRRK..',
          '..KerrrrrrrrrK..',
          '..KerrwrwrrrrK..',
          '..KerrrwrwrrrK..',
          '..KerrrrrrrrrK..',
          '..KeqqqqqqqqqK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KevvvvvvvLvK..',
          '..KeCCCCCCCCcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccLcK..',
          '..KecccccccccK..',
          '...KccccccccK...',
          '....KKKKKKKK....',
          '................']}},
    cafe_coado: {w: 1, h: 1, palette: {v: '#cfe4ec', V: '#f4fbff', e: '#a4c0d0', L: '#f4fbff', c: '#5e3218', C: '#8e5a30', d: '#3a1c10', s: '#d9cdea', K: '#230521'},
      grid: [
        '................',
        '......K...K.....',
        '.....KsK.KsK....',
        '......KsK.KsK...',
        '.....KsK.KsK....',
        '...KKKKKKKKKK...',
        '..KVVVVVVVVVVK..',
        '..KvevvevvevLK..',
        '..KvCCCCCCCCLK..',
        '..KvdccdccdLLK..',
        '...KdccdccdLLK..',
        '...KdccdccdcLK..',
        '...KdccdccdcLK..',
        '...KdccdccdcLK..',
        '...KevvevvevLK..',
        '....KKKKKKKKK...']},
    cafe_leite: {w: 1, h: 1, palette: {m: '#e8e0d0', M: '#fffaf0', d: '#b8aa96', c: '#b8804a', C: '#dcae78', r: '#c8302c', R: '#f0604a', s: '#d9cdea', K: '#230521'},
      grid: [
        '.....K...K......',
        '....KsK.KsK.....',
        '.....KsKKKsK....',
        '..KKKscccsKK....',
        '.KccCCCCCCccK...',
        '.KccCCCCCCcMK...',
        '.KdmmccccmmMKKK.',
        '.KdmmmmmmmmMmmmK',
        '.KdmmmmmmmmMKKMK',
        '.KdRRRRRRRRMKKmK',
        '.KdrrrrrrrrMKKmK',
        '.KdrrrrrrrrMmmmK',
        '.KdmmmmmmmmMKKK.',
        '.KdmmmmmmmmMK...',
        '.KdddddddddMK...',
        '..KKKKKKKKKK....']},
    ovo_frito: {w: 1, h: 1, palette: {p: '#cfd6ea', P: '#f2f5fc', q: '#9aa2c0', w: '#fffaf0', g: '#e8b85a', o: '#e0861a', y: '#ffb52e', Y: '#ffd66b', W: '#fff3c8', K: '#230521'},
      grid: [
        '................',
        '................',
        '................',
        '................',
        '......KKKK......',
        '...KKKppppKKK...',
        '..KppwwwwwPppK..',
        '.KpwwwwyYYwwPpK.',
        'KpPwwwoyyWYwPPpK',
        'KpPgwwoooywwwPpK',
        'KpPwwwwwwwwwPPpK',
        'KppPwwwwwwwPPppK',
        '.KppPPPPPPPPppK.',
        '..KppppppppppK..',
        '..KqqqqqqqqqqqK.',
        '...KKKKKKKKKKK..']},
    misto_quente: {w: 1, h: 1, palette: {O: '#dc9a48', o: '#b86a26', y: '#f4c874', h: '#f8dc9c', d: '#8a4a1a', Q: '#ffd23a', q: '#f0a820', H: '#e87a88', c: '#f6e0b0', K: '#230521'},
      grid: [
        '................',
        '................',
        '..KKKKKKKKKKKK..',
        '.KOyyyyyyyyyyhK.',
        '.KOOoOOOoOOOyhK.',
        '.KOOOoOOOoOOOhK.',
        '.KOoOOoOOOoOOhK.',
        '.KOOoOOoOOOoOhK.',
        '.KOOOoOOoOOOohK.',
        '.KdOOOoOOoOOOOK.',
        '.KddddddddddddK.',
        'KQqQQHHQQqQQQQQK',
        '.KccccccccccccK.',
        '.KddddddddddddK.',
        '..KKKKKKKKKKKK..',
        '................']},
    pao_chapa: {w: 1, h: 1, palette: {o: '#b8641c', d: '#7a3a12', b: '#d08a3a', c: '#f6d68a', W: '#fff3b0', h: '#e8a04a', K: '#230521'},
      grid: [
        '................',
        '................',
        '................',
        '......KKKKKKKK..',
        '.....KobbccbbhK.',
        '....KobccWWccbhK',
        '....KobbccccbbhK',
        '.....KddooooodK.',
        '..KKKKKKKKKKKK..',
        '.KobbccbbhK.....',
        'KobccWWccbhK....',
        'KobbccccbbhK....',
        '.KddooooodK.....',
        '..KKKKKKKK......',
        '................',
        '................']},
    miojo_pronto: {w: 1, h: 1, palette: {r: '#2e8ac8', R: '#6ab8f0', d: '#1a5488', y: '#e8b83a', Y: '#ffe38a', o: '#e0582a', g: '#5ab04a', f: '#c8b070', F: '#f0e0a0', s: '#d9cdea', K: '#230521'},
      grid: [
        '............KK..',
        '.......K...KfFK.',
        '....K.KsK..KfFK.',
        '...KsK.KsKKfFK..',
        '....KsKsKKKfFK..',
        '..KKsKrrrrKfFK..',
        '.KrrryyyyyfFrrK.',
        'KryyYyYyYyfFYyrK',
        'KryYyoyYyYgYyyRK',
        '.KRRRRRRRRRRRRRK',
        '.KrrrrrrrrrrrrK.',
        '..KdrrrrrrrrrK..',
        '..KrrrrrrrrrrK..',
        '...KdddddddddK..',
        '....KKKKKKKKK...',
        '................']},
    marmita_quente: {w: 2, h: 1, palette: {a: '#b9bdd2', A: '#e4e8f4', d: '#7c7f9c', L: '#cfd3e4', W: '#eef2fc', f: '#e8d49a', F: '#f6e8bc', q: '#b89c5a', t: '#3a2a8a', c: '#fbf6ea', C: '#e0d6c0', j: '#6a3a22', J: '#8f5634', m: '#a8502a', M: '#d27a44', s: '#e6e2f4', K: '#230521'},
      grid: [
        '....KsK........KsK......KsK.....',
        '...KsK........KsK........KsK....',
        '....K..........K..........K.....',
        '......KKKKKK.KKKKKKKKKKKKK......',
        '..KKKKccccccKMMMMMMjjjjjjjKKKK..',
        '.KAccccccCcccmmmmmmjjjjJjjjjcAK.',
        '.KdcccCccccccmmmmmmJjjjjjjjjjAK.',
        '.KdccccCccccCcccjjjjjJjjjJjjcAK.',
        '.KdaaaccccccaaaaaajjjjjjjjaaaAK.',
        '.KdaaaaaaaaaaaaaaaaaaaaaaaaaaAK.',
        '.KdaaaaaaaaaaaaaaaaaaaaaaaaaaAK.',
        '.KdaaaaaaaaaaaaaaaaaaaaaaaaaaAK.',
        '.KdaaaaaaaaaaaaaaaaaaaaaaaaaaAK.',
        '.KdddddddddddddddddddddddddddAK.',
        '..KaaaaaaaaaaaaaaaaaaaaaaaaaaK..',
        '...KKKKKKKKKKKKKKKKKKKKKKKKKK...']},
    pipoca: {w: 1, h: 1, palette: {w: '#fbf2e2', r: '#d8342c', R: '#ff6a4a', p: '#fff2c8', P: '#e8c878', W: '#fff8ea', y: '#ffd23a', K: '#230521'},
      grid: [
        '.......KPK......',
        '.....KKPppK.....',
        '...KKPppppWKK...',
        '..KPKPWppppppK..',
        '..KPppppWpppppK.',
        '..KPpppppppWpK..',
        '..KPppPPPyppPK..',
        '..KwPywwrrPPrK..',
        '..KwrrwwrrwwRK..',
        '..KwrrwwrrwwRK..',
        '..KwrrwwrrwwRK..',
        '...KrrwwrrwwRK..',
        '...KrrwwrrwwRK..',
        '...KrrwwrrwwRK..',
        '...KrrwwrrwwRK..',
        '....KKKKKKKKK...']},
    cha_boldo: {w: 1, h: 1, palette: {x: '#f2ece0', X: '#fffbf2', d: '#bdb09c', p: '#e8e2d4', q: '#a89c8a', c: '#8aa83a', C: '#b8d060', L: '#4c9a3a', l: '#8ad060', s: '#d9cdea', K: '#230521'},
      grid: [
        '................',
        '................',
        '.....K...K......',
        '....KsK.KsK.....',
        '.....KsK.KsK....',
        '..KKKsKxKsKKK...',
        '.KxxcccccccxxK..',
        '.KxxcCcccCcxxKK.',
        '.KdxxxxxxxxxXxxK',
        '.KdxxxxxxlxxXKxK',
        '..KxxxxxLxxxXxxK',
        '...KxxxxxxxxXKK.',
        '.KKKxddddddKKKK.',
        'KppppppppppppppK',
        'KpqqqqqqqqqqqqpK',
        '.KKKKKKppKKKKKK.']},
    soro: {w: 1, h: 1, palette: {v: '#d6eaf2', V: '#f4fbff', e: '#a4c4d4', L: '#f4fbff', a: '#b8e0f0', A: '#e6f6ff', b: '#8ab8d0', m: '#b0acd0', M: '#f0eefc', w: '#fffaf0', K: '#230521'},
      grid: [
        '............KK..',
        '...........KMK..',
        '..........KMmK..',
        '.........KMmK...',
        '........KMmK....',
        '...KKKKKMmKKK...',
        '..KVVVVVmVVVVK..',
        '..KveaaMmaaeLK..',
        '..KvAAAmAAAALK..',
        '..KvaabmbabLLK..',
        '...KaabmbabLLK..',
        '...KbaaaabaaLK..',
        '...KbawabawaLK..',
        '...KbwwawwbaLK..',
        '...KevvevvevLK..',
        '....KKKKKKKKK...']},
    gororoba: {w: 1, h: 1, palette: {t: '#8a6a4a', T: '#b89070', d: '#5a4230', m: '#7a7a3a', M: '#a0a05a', b: '#c8c060', B: '#f0e8a0', v: '#5a4a2a', f: '#3a2a3a', F: '#b8c8f0', s: '#a8b890', K: '#230521'},
      grid: [
        '...........K....',
        '..........KFKK..',
        '...K.......KfFK.',
        '..KsK.......KK..',
        '...KsKK..KK.....',
        '..KsKmmKKbBKK...',
        '.KKtmmMmmbbttKK.',
        'KtmmmmmMmmmmMmtK',
        'KtmmMvmmmvMmmmtK',
        '.KTTTTTTTTTTTTTK',
        '.KttttttttttttK.',
        '.KtdttttttttttK.',
        '..KttttttttttK..',
        '...KttttttttK...',
        '...KdddddddddK..',
        '....KKKKKKKKK...']},
  };

  /* ================================================================ itens
     `usos` = quantas vezes um pacote de despensa rende (o pacote aberto vira
     uma entrada própria na bolsa com os usos que sobraram).
     `genero` ajuda a escrever “caprichado/caprichada” no nome do prato. */
  const ITENS = {
    pao_frances: {label: 'Pão francês', desc: 'Casca que estala, miolo macio. Ainda morno.', stack: 4, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'sanduiche', forma: 'pao_frances', mordidas: 3, cor: '#d48532', cor2: '#f7e4bc',
        fome: -15, sede: 3, mensagem: 'Pão fresco resolve muita coisa.'}},
    pao_forma: {label: 'Pão de forma', desc: 'Duas fatias macias, boas para um misto.', stack: 4, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'sanduiche', forma: 'pao_forma', mordidas: 3, cor: '#cf8a42', cor2: '#f7e4bc',
        fome: -12, sede: 3, mensagem: 'Pão puro, sem graça, mas enche.'}},
    pao_queijo: {label: 'Pão de queijo', desc: 'Três bolinhas douradas, ocas por dentro.', stack: 5, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'salgado', forma: 'pao_de_queijo', mordidas: 2, cor: '#e2ad5e', cor2: '#fff2c8',
        fome: -15, sede: 5, mensagem: 'Quentinho, puxa o queijo.'}},
    coxinha: {label: 'Coxinha', desc: 'Massa crocante, recheio cremoso de frango.', stack: 3, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'salgado', forma: 'coxinha', mordidas: 3, cor: '#dc8f2c', cor2: '#ffe39a',
        fome: -25, sede: 8, mensagem: 'Gorda do jeito certo.'}},
    bolacha: {label: 'Bolacha água e sal', desc: 'Um pacote de bolachas secas. Dá sede.', stack: 3, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'pacote', mordidas: 3, cor: '#ecc680', cor2: '#2f6fc0',
        fome: -15, sede: 10, mensagem: 'Seca feito papel.'}},
    biscoito: {label: 'Biscoito recheado', desc: 'Chocolate por fora, creme por dentro.', stack: 3, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'pacote', mordidas: 3, cor: '#4a2614', cor2: '#f6ecdc',
        fome: -25, sede: 8, mensagem: 'Açúcar puro. Some rápido.'}},
    pacoca: {label: 'Paçoca', desc: 'Amendoim moído com açúcar. Esfarela toda.', stack: 6, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'barra', mordidas: 2, cor: '#e6c488', cor2: '#c8302c',
        fome: -12, sede: 12, mensagem: 'Esfarelou na mão inteira.'}},
    banana: {label: 'Banana', desc: 'Madura, com pintinhas. Energia rápida.', stack: 3, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'fruta', forma: 'banana', mordidas: 2, cor: '#f6cf3a', cor2: '#fff09a',
        fome: -12, sede: -3, mensagem: 'Doce e macia.'}},
    laranja: {label: 'Laranja', desc: 'Pesada de tanto suco.', stack: 4, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'fruta', forma: 'laranja', mordidas: 3, cor: '#f28a1c', cor2: '#ffd98a',
        fome: -10, sede: -12, mensagem: 'Escorreu pelo queixo.'}},
    goiaba: {label: 'Goiaba', desc: 'Vermelha por dentro, cheia de sementinhas.', stack: 4, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'fruta', forma: 'goiaba', mordidas: 2, cor: '#a6c84a', cor2: '#f06a82',
        fome: -12, sede: -6, mensagem: 'Doce, com cheiro de quintal.'}},
    manga: {label: 'Manga', desc: 'Doce e fibrosa. Vai escorrer pelo braço.', stack: 3, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'fruta', forma: 'manga', mordidas: 3, cor: '#f08a2a', cor2: '#e8c23a',
        fome: -14, sede: -10, mensagem: 'Melou tudo, mas valeu.'}},
    ovo: {label: 'Ovo', desc: 'Cru. Melhor fritar antes.', stack: 6, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'salgado', mordidas: 1, cor: '#f4cc98', cor2: '#ffb52e',
        fome: -8, sede: 0, efeitos: [{id: 'intoxicacao', chance: .15}], mensagem: 'Cru. Desceu com dificuldade.'}},
    manteiga: {label: 'Manteiga', desc: 'Pote de manteiga com sal, para o pão e a frigideira.', stack: 2, kind: 'ingredient', usos: 4, genero: 'f'},
    queijo: {label: 'Queijo', desc: 'Um pedaço de queijo prato. Melhor derretido.', stack: 3, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'salgado', mordidas: 2, cor: '#f2c230', cor2: '#ffe07a',
        fome: -10, sede: 4, mensagem: 'Salgadinho, bom assim mesmo.'}},
    presunto: {label: 'Presunto', desc: 'Fatias finas, ainda geladas.', stack: 3, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'salgado', mordidas: 2, cor: '#e87a88', cor2: '#fde2e0',
        fome: -8, sede: 5, mensagem: 'Comeu em pé, na frente da geladeira.'}},
    leite: {label: 'Leite de caixinha', desc: 'Um litro de leite integral.', stack: 2, kind: 'food', genero: 'm',
      consumo: {tipo: 'beber', verbo: 'Beber', estilo: 'caixinha', goles: 3, cor: '#f2efe6', cor2: '#2f68c0',
        fome: -10, sede: -12, mensagem: 'Leite gelado no estômago vazio.'}},
    miojo: {label: 'Macarrão instantâneo', desc: 'Bloco de macarrão e um saquinho de tempero.', stack: 3, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'pacote', mordidas: 3, cor: '#f2c236', cor2: '#d8342c',
        fome: -15, sede: 18, mensagem: 'Cru e salgado. Enganou a fome.'}},
    marmita: {label: 'Marmita', desc: 'Arroz, feijão e bife de ontem. Fria.', stack: 2, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'prato', mordidas: 4, cor: '#b9bdd2', cor2: '#8f5634',
        fome: -40, sede: 0, mensagem: 'Fria, mas é comida de verdade.'}},
    milho_pipoca: {label: 'Milho de pipoca', desc: 'Saquinho de milho. Precisa de óleo e fogo.', stack: 2, kind: 'ingredient', usos: 2, genero: 'm'},
    po_cafe: {label: 'Pó de café', desc: 'Torrado e moído, bem forte.', stack: 2, kind: 'ingredient', usos: 4, genero: 'm'},
    acucar: {label: 'Açúcar', desc: 'Pacote de açúcar refinado.', stack: 2, kind: 'ingredient', usos: 6, genero: 'm'},
    sal: {label: 'Sal', desc: 'Sal de cozinha. Uma pitada basta.', stack: 2, kind: 'ingredient', usos: 8, genero: 'm'},
    oleo: {label: 'Óleo', desc: 'Garrafa de óleo de soja.', stack: 1, kind: 'ingredient', usos: 6, genero: 'm'},
    boldo: {label: 'Folhas de boldo', desc: 'Amargo como remédio. Assenta o estômago.', stack: 4, kind: 'ingredient', genero: 'f'},
    suco: {label: 'Suco de caixinha', desc: 'Suco de laranja com canudinho.', stack: 3, kind: 'food', genero: 'm',
      consumo: {tipo: 'beber', verbo: 'Beber', estilo: 'caixinha', goles: 2, cor: '#f07a1c', cor2: '#ffd23a',
        fome: -6, sede: -25, mensagem: 'Doce demais, mas desce.'}},
    agua_coco: {label: 'Água de coco', desc: 'Coco verde gelado, com canudo.', stack: 2, kind: 'food', genero: 'f',
      consumo: {tipo: 'beber', verbo: 'Beber', estilo: 'coco', goles: 3, cor: '#72b048', cor2: '#f3eed8',
        fome: -4, sede: -35, mensagem: 'Gelada. O corpo agradece.'}},
    garrafa_vazia: {label: 'Garrafa PET vazia', desc: 'Meio litro. Dá para encher numa torneira ou numa bica.', stack: 2, kind: 'container', genero: 'f'},
    garrafa_agua: {label: 'Garrafa com água', desc: 'Meio litro: três goles.', stack: 1, kind: 'food', genero: 'f',
      consumo: {tipo: 'beber', verbo: 'Beber', estilo: 'garrafa', goles: 1, rotulo: 'Bebendo água da garrafa', cor: '#5aa8e0', cor2: '#2f62bf',
        fome: 0, sede: -18, mensagem: 'Um gole. Ainda sobrou.'}},
    cafe_coado: {label: 'Café coado', desc: 'Coado na hora, num copo americano.', stack: 2, kind: 'food', genero: 'm',
      consumo: {tipo: 'beber', verbo: 'Tomar', estilo: 'copo', goles: 3, cor: '#5e3218', cor2: '#cfe4ec',
        fome: -2, sede: -8, efeitos: [{id: 'cafeina', minutos: 20}], mensagem: 'Café forte, do jeito da casa.'}},
    cafe_leite: {label: 'Café com leite', desc: 'Meio a meio, numa caneca.', stack: 2, kind: 'food', genero: 'm',
      consumo: {tipo: 'beber', verbo: 'Tomar', estilo: 'xicara', goles: 3, cor: '#b8804a', cor2: '#e8e0d0',
        fome: -8, sede: -10, efeitos: [{id: 'cafeina', minutos: 20}], mensagem: 'Quente, doce, de casa.'}},
    ovo_frito: {label: 'Ovo frito', desc: 'Gema mole, borda crocante.', stack: 1, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'prato', mordidas: 3, cor: '#fffaf0', cor2: '#ffb52e',
        fome: -20, sede: 2, mensagem: 'A gema estourou no ponto.'}},
    misto_quente: {label: 'Misto quente', desc: 'Presunto e queijo derretidos no pão tostado.', stack: 2, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'sanduiche', forma: 'misto', mordidas: 3, cor: '#dc9a48', cor2: '#ffd23a',
        fome: -30, sede: 5, mensagem: 'O queijo puxou até o queixo.'}},
    pao_chapa: {label: 'Pão na chapa', desc: 'Pão francês tostado na manteiga.', stack: 2, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'sanduiche', forma: 'pao_frances', mordidas: 3, cor: '#d08a3a', cor2: '#fff3b0',
        fome: -22, sede: 4, mensagem: 'Manteiga escorrendo pelos dedos.'}},
    miojo_pronto: {label: 'Macarrão pronto', desc: 'Macarrão instantâneo fumegando, com o tempero do saquinho.', stack: 1, kind: 'food', genero: 'm',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'tigela', mordidas: 4, cor: '#e8b83a', cor2: '#2e8ac8',
        fome: -35, sede: -10, mensagem: 'Caldo salgado, macarrão mole. Perfeito.'}},
    marmita_quente: {label: 'Marmita quente', desc: 'Arroz, feijão e bife fumegando.', stack: 1, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'prato', mordidas: 4, cor: '#fbf6ea', cor2: '#6a3a22',
        fome: -60, sede: -5, efeitos: [{id: 'moleza', minutos: 5}], mensagem: 'Comida quente. Deu até sono.'}},
    pipoca: {label: 'Pipoca', desc: 'Saquinho de pipoca quentinha.', stack: 2, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'pipoca', mordidas: 3, cor: '#fff2c8', cor2: '#d8342c',
        fome: -15, sede: 12, mensagem: 'Um punhado atrás do outro.'}},
    cha_boldo: {label: 'Chá de boldo', desc: 'Amargo, mas acalma a barriga.', stack: 2, kind: 'food', genero: 'm',
      consumo: {tipo: 'beber', verbo: 'Tomar', estilo: 'xicara', goles: 3, cor: '#8aa83a', cor2: '#f2ece0',
        fome: 0, sede: -15, cura: ['dor_de_barriga', 'enjoo'], mensagem: 'Amargo. A barriga agradece.'}},
    soro: {label: 'Soro caseiro', desc: 'Água, sal e açúcar: repõe o que a barriga levou.', stack: 2, kind: 'food', genero: 'm',
      consumo: {tipo: 'beber', verbo: 'Beber', estilo: 'copo', goles: 3, cor: '#b8e0f0', cor2: '#e6f6ff',
        fome: 0, sede: -30, efeitos: [{id: 'infeccao_intestinal', reduzir: .5}], mensagem: 'Salgadinho e doce ao mesmo tempo.'}},
    gororoba: {label: 'Gororoba', desc: 'Ninguém sabe o que era. Comestível… provavelmente.', stack: 2, kind: 'food', genero: 'f',
      consumo: {tipo: 'comer', verbo: 'Comer', estilo: 'tigela', mordidas: 3, cor: '#8a6a4a', cor2: '#7a7a3a',
        fome: -10, sede: 0, efeitos: [{id: 'dor_de_barriga', chance: .3}], mensagem: 'Desceu. Foi o que deu para fazer.'}}
  };

  /* Os cinco que já existiam também matam a fome e a sede. */
  const CONSUMO_ANTIGO = {
    refrigerante: {tipo: 'beber', verbo: 'Beber', estilo: 'lata', goles: 3, cor: '#d5343f', cor2: '#ece5f4',
      fome: -8, sede: -30, mensagem: 'Gelado, doce, estalando.'},
    agua: {tipo: 'beber', verbo: 'Beber', estilo: 'garrafa', goles: 2, cor: '#79a8ec', cor2: '#2f62bf',
      fome: 0, sede: -45, mensagem: 'Água. Simples assim.'},
    salgadinho: {tipo: 'comer', verbo: 'Comer', estilo: 'pacote', mordidas: 3, cor: '#e0484f', cor2: '#f6b73c',
      fome: -12, sede: 15, mensagem: 'Só sal e ar. Deu sede.'},
    chocolate: {tipo: 'comer', verbo: 'Comer', estilo: 'barra', mordidas: 2, cor: '#5a2e1a', cor2: '#a95cc2',
      fome: -15, sede: 6, mensagem: 'Derreteu nos dedos.'},
    cafe: {tipo: 'beber', verbo: 'Tomar', estilo: 'copo', goles: 2, cor: '#8e5a34', cor2: '#efe3d3',
      fome: -2, sede: -8, efeitos: [{id: 'cafeina', minutos: 20}], mensagem: 'Café de máquina, mas é café.'}
  };

  const NOVOS = Object.keys(ITENS);
  for (const [id, meta] of Object.entries(ITENS)) {
    const arte = ICONES[id];
    if (!arte || DEFS[id]) continue;
    DEFS[id] = {label: meta.label, desc: meta.desc, w: arte.w, h: arte.h, stack: meta.stack, kind: meta.kind,
      consumed: meta.consumo ? `Você ${meta.consumo.verbo === 'Comer' ? 'comeu' : meta.consumo.verbo === 'Tomar' ? 'tomou' : 'bebeu'} ${meta.genero === 'f' ? 'a' : 'o'} ${meta.label.toLowerCase()}.` : undefined,
      palette: arte.palette, grid: arte.grid, genero: meta.genero, usos: meta.usos, consumo: meta.consumo};
    if (arte.variants) DEFS[id].variants = arte.variants;
    if (!meta.consumo) delete DEFS[id].consumed;
  }
  for (const [id, consumo] of Object.entries(CONSUMO_ANTIGO)) if (DEFS[id] && !DEFS[id].consumo) DEFS[id].consumo = consumo;
  DEFS.refrigerante.genero = 'm'; DEFS.agua.genero = 'f'; DEFS.salgadinho.genero = 'm'; DEFS.chocolate.genero = 'm'; DEFS.cafe.genero = 'm';

  /* ================================================================ regras */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PASSADO = {Comer: 'COMEU', Beber: 'BEBEU', Tomar: 'TOMOU'};
  const GERUNDIO = {Comer: 'Comendo', Beber: 'Bebendo', Tomar: 'Tomando'};
  const def = id => DEFS[id] || null;
  const consumoDe = id => DEFS[id]?.consumo || null;
  const verbo = id => DEFS[id]?.consumo?.verbo || null;
  const rotuloDe = id => DEFS[id]?.label || String(id || '');
  const artigo = id => (DEFS[id]?.genero === 'f' ? 'a' : 'o');

  /* Relógio em minutos: o do jogo, se alguém der um; senão o do mundo real. */
  function minutos(ctx) {
    if (typeof ctx?.minutos === 'function') { const m = Number(ctx.minutos()); if (Number.isFinite(m)) return m; }
    if (Number.isFinite(ctx?.necessidades?.minutos)) return Number(ctx.necessidades.minutos);
    if (Number.isFinite(ctx?.exploracao?.relogio)) return Number(ctx.exploracao.relogio) / 60;
    return Date.now() / 60000;
  }

  /* ---- água: o que um gole faz, por qualidade ---- */
  const QUALIDADES_AGUA = ['potavel', 'fervida', 'duvidosa', 'contaminada'];
  const ORDEM_AGUA = {potavel: 0, fervida: 0, duvidosa: 1, contaminada: 2};
  const piorAgua = (a, b) => (ORDEM_AGUA[b] ?? 0) > (ORDEM_AGUA[a] ?? 0) ? b : a;
  function efeitoDaAgua(qualidade, {garrafa = false} = {}) {
    const q = QUALIDADES_AGUA.includes(qualidade) ? qualidade : 'potavel';
    const base = garrafa ? -18 : -25;
    if (q === 'duvidosa') return {sede: base, efeitos: [{id: 'dor_de_barriga', chance: .2}], mensagem: 'Gosto de cano. Melhor não pensar.'};
    if (q === 'contaminada') return {sede: garrafa ? -14 : -20, efeitos: [{id: 'infeccao_intestinal', chance: .25}], mensagem: 'Água parada. Desceu com gosto de terra.'};
    return {sede: base, efeitos: [], mensagem: q === 'fervida' ? 'Água fervida, ainda com gostinho de fumaça.' : 'Água fresca. Que alívio.'};
  }
  /* Beber da privada: enjoo na certa e infecção que piora se repetir logo. */
  function efeitoDaPrivada(mem = {}, agora = 0) {
    const repetiu = Number.isFinite(mem.privadaEm) && agora - mem.privadaEm <= 10;
    const risco = repetiu ? Math.min(.6, (mem.privadaRisco || .15) + .1) : .15;
    return {sede: -15, risco, efeitos: [{id: 'enjoo', minutos: 2}, {id: 'infeccao_intestinal', chance: risco}],
      mensagem: 'Água da privada. A garganta ainda protesta.'};
  }

  /* ---- qualidade do prato ---- */
  const qualidadeDe = dados => clamp(Math.round(Number(dados?.qualidade) || 2), 1, 3);
  const ESTRELAS = {1: 'passável', 2: 'bom', 3: 'caprichado'};
  function fatorQualidade(dados) {
    if (!dados) return 1;
    if (dados.estragada) return .75;
    return {1: .5, 2: 1, 3: 1.25}[qualidadeDe(dados)];
  }
  const alivio = (v, f) => (v < 0 ? -Math.round(-v * f) : v);

  /* Tudo o que um item faz ao ser consumido, já com a qualidade aplicada. */
  function efeitosDoConsumo(defId, dados = null) {
    const c = consumoDe(defId);
    if (!c) return null;
    let fome = c.fome || 0, sede = c.sede || 0, mensagem = c.mensagem || '';
    const efeitos = (c.efeitos || []).map(e => ({...e})), cura = [...(c.cura || [])];
    if (defId === 'garrafa_agua') {
      const a = efeitoDaAgua(dados?.qualidade, {garrafa: true});
      sede = a.sede; efeitos.push(...a.efeitos.map(e => ({...e}))); mensagem = a.mensagem;
    }
    const f = fatorQualidade(dados);
    fome = alivio(fome, f); sede = alivio(sede, f);
    if (dados?.estragada) efeitos.push({id: 'intoxicacao', chance: .3});
    if (!dados?.estragada && qualidadeDe(dados) === 3 && (c.fome || 0) <= -15 && dados) efeitos.push({id: 'bem_alimentada', minutos: 30});
    return {fome, sede, efeitos, cura, mensagem};
  }

  /* Três cafés em meia hora deixam a mão tremendo. */
  const CAFEINADOS = new Set(['cafe', 'cafe_coado', 'cafe_leite']);
  const historicoCafe = new WeakMap();
  function contarCafe(chave, agora) {
    const lista = (historicoCafe.get(chave) || []).filter(t => agora - t <= 30);
    lista.push(agora); historicoCafe.set(chave, lista);
    return lista.length;
  }

  /* Aplica em `necessidades` o que o item faz. Devolve o que foi aplicado. */
  function aplicarConsumo(ctx, defId, dados = null, origem = null) {
    const e = efeitosDoConsumo(defId, dados);
    if (!e) return null;
    const efeitos = e.efeitos.map(x => ({...x}));
    if (CAFEINADOS.has(defId) && contarCafe(ctx?.necessidades || ctx || DEFS, minutos(ctx)) >= 3) efeitos.push({id: 'tremedeira', minutos: 15});
    try { ctx?.necessidades?.aplicar?.({fome: e.fome, sede: e.sede, efeitos, origem: origem || rotuloDe(defId)}); } catch (erro) { console.error('necessidades.aplicar falhou:', erro); }
    for (const id of e.cura) { try { ctx?.necessidades?.curar?.(id); } catch (erro) { console.error(erro); } }
    return {...e, efeitos};
  }

  /* ---- garrafas ---- */
  const golesDa = entry => clamp(Math.round(Number(entry?.data?.goles ?? 3)), 0, 3);
  function dadosGarrafa(goles, qualidade) {
    const q = QUALIDADES_AGUA.includes(qualidade) ? qualidade : 'potavel';
    const n = clamp(Math.round(goles), 1, 3), v = q === 'fervida' ? 'potavel' : q;
    return {goles: n, qualidade: q, variant: `${v}${n}`, name: `Garrafa com água (${n} ${n === 1 ? 'gole' : 'goles'})`,
      desc: `${q === 'contaminada' ? 'Água suja de cocho ou de poça.' : q === 'duvidosa' ? 'Água de procedência duvidosa; ferver resolve.' : q === 'fervida' ? 'Água fervida, já fria.' : 'Água boa.'} ${n === 1 ? 'Resta um gole' : `Restam ${n} goles`}.`};
  }
  /* Enche uma garrafa da bolsa com a água de uma fonte. Devolve o que houve. */
  function encherGarrafa(itens, qualidade, {entryId = null} = {}) {
    if (!itens?.entradas) return {ok: true, previa: true, qualidade};
    const lista = itens.entradas();
    const alvo = entryId ? lista.find(e => e.id === entryId)
      : lista.filter(e => e.def === 'garrafa_agua' && golesDa(e) < 3).sort((a, b) => golesDa(a) - golesDa(b))[0] || lista.find(e => e.def === 'garrafa_vazia');
    if (!alvo) return {ok: false, motivo: 'Não há garrafa vazia na bolsa.'};
    if (alvo.def === 'garrafa_agua') {
      const q = piorAgua(alvo.data?.qualidade || 'potavel', qualidade);
      itens.alterar(alvo.id, dadosGarrafa(3, q));
      return {ok: true, qualidade: q, completou: true};
    }
    const dados = dadosGarrafa(3, qualidade);
    if ((alvo.qty || 1) > 1) { itens.remover(alvo.id, 1); itens.dar('garrafa_agua', 1, dados); }
    else if (typeof itens.trocar === 'function') itens.trocar(alvo.id, 'garrafa_agua', dados);
    else { itens.remover(alvo.id, 1); itens.dar('garrafa_agua', 1, dados); }
    return {ok: true, qualidade};
  }
  /* Tem garrafa para encher? (vazia ou pela metade) */
  function temGarrafaParaEncher(itens) {
    if (!itens?.entradas) return true;
    return itens.entradas().some(e => e.def === 'garrafa_vazia' || (e.def === 'garrafa_agua' && golesDa(e) < 3));
  }

  /* ---- despensa: pacotes com vários usos ---- */
  function usosDe(itens, id) {
    const d = def(id);
    if (!itens?.entradas) return Infinity;
    const lista = itens.entradas().filter(e => e.def === id);
    if (!d?.usos) return lista.reduce((n, e) => n + (e.qty || 1), 0);
    return lista.reduce((n, e) => n + (Number.isFinite(e.data?.usos) ? e.data.usos : d.usos * (e.qty || 1)), 0);
  }
  function usarIngrediente(itens, id, n = 1) {
    const d = def(id);
    if (!itens?.entradas) return true;
    if (!d?.usos) return !!itens.gastar?.(id, n);
    const lista = itens.entradas().filter(e => e.def === id);
    const aberta = lista.filter(e => Number.isFinite(e.data?.usos)).sort((a, b) => a.data.usos - b.data.usos)[0];
    const dadosAberto = resto => ({usos: resto, name: `${d.label} (aberto)`, desc: `${d.desc} ${resto === 1 ? 'Dá para mais um uso' : `Dá para mais ${resto} usos`}.`});
    if (aberta) {
      const resto = aberta.data.usos - n;
      if (resto > 0) { itens.alterar(aberta.id, dadosAberto(resto)); return true; }
      return !!itens.remover(aberta.id, 1);
    }
    const fechada = lista.find(e => !Number.isFinite(e.data?.usos));
    if (!fechada) return false;
    const resto = d.usos - n;
    if (resto <= 0) return !!itens.remover(fechada.id, 1);
    if ((fechada.qty || 1) > 1) { itens.remover(fechada.id, 1); itens.dar(id, 1, dadosAberto(resto)); return true; }
    itens.alterar(fechada.id, dadosAberto(resto));
    return true;
  }

  /* ================================================================ consumir */
  /* Monta o “pedido de consumo” do contrato para um item. */
  function pedidoDe(defId, dados, ctx = {}, extra = {}) {
    const d = def(defId), c = consumoDe(defId);
    if (!c) return null;
    const rotulo = extra.rotulo || c.rotulo || `${GERUNDIO[c.verbo] || 'Comendo'} ${d.label.toLowerCase()}`;
    const pedido = {tipo: c.tipo, estilo: c.estilo, rotulo, cor: c.cor, cor2: c.cor2, item: defId};
    if (c.forma) pedido.forma = c.forma;
    if (c.mordidas) pedido.mordidas = c.mordidas;
    if (c.goles) pedido.goles = c.goles;
    if (Number.isFinite(extra.alvoX)) pedido.alvoX = extra.alvoX;
    const e = efeitosDoConsumo(defId, dados);
    pedido.aoConfirmar = extra.aoConfirmar || (() => true);
    pedido.aoTerminar = extra.aoTerminar || (resultado => {
      if (resultado === 'cancelado') return;
      try { ctx.toast?.(PASSADO[c.verbo] || 'COMEU', e?.mensagem || d.label, c.tipo === 'beber' ? 'agua' : 'comida'); } catch (erro) { console.error(erro); }
    });
    pedido.aoCancelar = extra.aoCancelar || (() => {});
    return pedido;
  }
  /* Dispara o pedido: com `consumo.js` ele vira animação; sem ele (prévia,
     testes), confirma e termina na hora. Devolve true ou o motivo. */
  function iniciarPedido(pedido, ctx = {}) {
    if (!pedido) return 'Isso não se come.';
    const c = ctx.consumo;
    if (c && typeof c.iniciar === 'function') {
      let r;
      try { r = c.iniciar(pedido); } catch (erro) { console.error('consumo.iniciar falhou:', erro); r = 'Não deu para fazer isso agora.'; }
      return r === true ? true : (typeof r === 'string' && r) || 'Não deu para fazer isso agora.';
    }
    if (pedido.aoConfirmar() === false) return 'Não deu.';
    pedido.aoTerminar('completo');
    return true;
  }
  /* Consome um item que está na bolsa. `entry` é uma entrada de `itens.entradas()`. */
  function consumirDaBolsa(entry, ctx = {}) {
    const d = def(entry?.def), c = consumoDe(entry?.def);
    if (!c) return d ? `${d.label} não se come assim.` : 'Isso não se come.';
    if (entry.def === 'garrafa_agua' && golesDa(entry) <= 0) return 'A garrafa está vazia.';
    const pode = c.tipo === 'beber' ? ctx.necessidades?.podeBeber?.() : ctx.necessidades?.podeComer?.();
    if (pode && pode.ok === false) return pode.motivo || 'Agora não dá.';
    const pedido = pedidoDe(entry.def, entry.data, ctx, {
      alvoX: ctx.alvoX,
      aoConfirmar: () => {
        const itens = ctx.itens;
        let atual = entry;
        if (itens?.entradas) {
          atual = itens.entradas().find(e => e.id === entry.id);
          if (!atual) return false;
        }
        if (itens) {
          if (atual.def === 'garrafa_agua') {
            const goles = golesDa(atual) - 1;
            if (goles > 0) itens.alterar(atual.id, dadosGarrafa(goles, atual.data?.qualidade));
            else if ((atual.qty || 1) > 1) { itens.remover(atual.id, 1); itens.dar('garrafa_vazia', 1); }
            else if (typeof itens.trocar === 'function') itens.trocar(atual.id, 'garrafa_vazia', null);
            else itens.remover(atual.id, 1);
          } else if (atual.def === 'agua') {
            if ((atual.qty || 1) > 1) { itens.remover(atual.id, 1); itens.dar('garrafa_vazia', 1); }
            else if (typeof itens.trocar === 'function') itens.trocar(atual.id, 'garrafa_vazia', null);
            else itens.remover(atual.id, 1);
          } else if (!itens.remover(atual.id, 1)) return false;
        }
        aplicarConsumo(ctx, atual.def, atual.data);
        return true;
      }
    });
    return iniciarPedido(pedido, ctx);
  }
  /* Consome algo que ainda não está na bolsa (o prato que acabou de sair da
     panela, o copo servido da térmica). Não gasta nada da bolsa. */
  function consumirPronto(defId, dados = null, ctx = {}, extra = {}) {
    const c = consumoDe(defId);
    if (!c) return 'Isso não se come.';
    const pode = c.tipo === 'beber' ? ctx.necessidades?.podeBeber?.() : ctx.necessidades?.podeComer?.();
    if (pode && pode.ok === false) return pode.motivo || 'Agora não dá.';
    const pedido = pedidoDe(defId, dados, ctx, {...extra, aoConfirmar: () => { aplicarConsumo(ctx, defId, dados); extra.aoConfirmar?.(); return true; }});
    return iniciarPedido(pedido, ctx);
  }
  /* Um gole de uma fonte (bebedouro, torneira, bica, privada…). O tipo
     `fonte_agua` cuida da animação; aqui ficam os efeitos. */
  function beberDaFonte(qualidade, ctx = {}, {privada = false, mem = null} = {}) {
    const agora = minutos(ctx);
    const e = privada ? efeitoDaPrivada(mem || {}, agora) : efeitoDaAgua(qualidade);
    if (privada && mem) { mem.privadaEm = agora; mem.privadaRisco = e.risco; }
    try { ctx.necessidades?.aplicar?.({fome: 0, sede: e.sede, efeitos: e.efeitos.map(x => ({...x})), origem: privada ? 'Privada' : 'Água'}); } catch (erro) { console.error(erro); }
    return e;
  }

  /* ================================================================ cozinha
     Estações e receitas. Cada receita tem um “modo” por família de estação
     (fogo, elétrica…), com 2 a 4 passos curtos: ações (COLOCAR ÁGUA, QUEBRAR O
     OVO), acender o fogo e passos de cozimento com a barra de ponto. */
  const ESTACOES = {
    fogao: {nome: 'Fogão', fogo: 'gas', niveis: true, agua: true, eletrica: false},
    fogareiro: {nome: 'Fogareiro', fogo: 'gas', niveis: true, agua: true, eletrica: false},
    chapa: {nome: 'Chapa', fogo: 'gas', niveis: true, agua: true, eletrica: false, verbos: {DESLIGAR: 'TIRAR DA CHAPA'}},
    fogueira: {nome: 'Fogueira', fogo: 'lenha', niveis: true, agua: false, eletrica: false,
      verbos: {ACENDER: 'ACENDER O FOGO', DESLIGAR: 'TIRAR DO FOGO'}, rotulosNivel: {baixo: 'BRASA', medio: 'FOGO', alto: 'LABAREDA'}},
    cafeteira: {nome: 'Cafeteira', fogo: 'eletrico', niveis: false, agua: true, eletrica: true, verbos: {ACENDER: 'LIGAR'}},
    micro_ondas: {nome: 'Micro-ondas', fogo: 'eletrico', niveis: false, agua: true, eletrica: true, verbos: {ACENDER: 'LIGAR', DESLIGAR: 'PARAR'}},
    sanduicheira: {nome: 'Sanduicheira', fogo: 'eletrico', niveis: false, agua: true, eletrica: true, verbos: {ACENDER: 'LIGAR'}},
    chaleira: {nome: 'Chaleira', fogo: 'eletrico', niveis: false, agua: true, eletrica: true, verbos: {ACENDER: 'LIGAR'}},
    bancada: {nome: 'Bancada', fogo: null, niveis: false, agua: true, eletrica: false}
  };
  const NIVEIS = ['baixo', 'medio', 'alto'];
  const VELOCIDADE = {baixo: .7, medio: 1, alto: 1.35};
  const A = (verbo, anim, dur = .9, extra = {}) => ({tipo: 'acao', verbo, anim, dur, ...extra});
  const F = (extra = {}) => ({tipo: 'fogo', verbo: 'ACENDER', anim: 'fogo', dur: .6, ideal: 'medio', ...extra});
  const C = (rotulo, verbo, conteudo, dur, janela, extra = {}) =>
    ({tipo: 'cozinhar', rotulo, verbo, conteudo, dur, janela, queima: true, apaga: true, falha: 'nota1', ...extra});

  const RECEITAS = {
    cafe_coado: {nome: 'Café coado', item: 'cafe_coado', rende: 2,
      modos: {
        fogo: {estacoes: ['fogao', 'fogareiro', 'fogueira'], vasilha: 'leiteira', ingredientes: [{id: 'po_cafe', usos: 1}, {agua: 1}],
          passos: [A('COLOCAR ÁGUA', 'agua'), F({ideal: 'medio'}),
            C('ESQUENTANDO A ÁGUA', 'DESLIGAR', 'agua', 6, [.42, .77], {bons: ['medio', 'alto'], textos: {cru: 'Água morna: café fraco.', queimando: 'Ferveu demais: café amargo.'}}),
            A('PASSAR O CAFÉ', 'coar', 1.8)]},
        cafeteira: {estacoes: ['cafeteira'], vasilha: 'jarra', ingredientes: [{id: 'po_cafe', usos: 1}, {agua: 1}],
          passos: [A('COLOCAR ÁGUA', 'agua'), A('COLOCAR O PÓ', 'po'), F({eletrico: true}),
            C('PASSANDO', 'DESLIGAR', 'cafe', 6.5, [.45, .8], {textos: {cru: 'Passou pouco: café ralo.', queimando: 'Ficou na chapa: amargo.'}})]},
        chaleira: {estacoes: ['chaleira'], vasilha: 'chaleira', ingredientes: [{id: 'po_cafe', usos: 1}, {agua: 1}],
          passos: [A('COLOCAR ÁGUA', 'agua'), F({eletrico: true}),
            C('FERVENDO', 'DESLIGAR', 'agua', 5.5, [.42, .8], {}), A('PASSAR O CAFÉ', 'coar', 1.8)]}
      }},
    cafe_leite: {nome: 'Café com leite', item: 'cafe_leite', rende: 2,
      modos: {
        fogo: {estacoes: ['fogao', 'fogareiro'], vasilha: 'leiteira', ingredientes: [{id: 'cafe_coado', n: 1}, {id: 'leite', n: 1}],
          passos: [A('COLOCAR O LEITE', 'leite'), F({ideal: 'baixo'}),
            C('ESQUENTANDO O LEITE', 'DESLIGAR', 'leite', 6, [.4, .75], {bons: ['baixo', 'medio'], textos: {queimado: 'O leite subiu e derramou no fogão.'}}),
            A('MISTURAR O CAFÉ', 'misturar', 1)]},
        micro: {estacoes: ['micro_ondas'], vasilha: 'caneca', ingredientes: [{id: 'cafe_coado', n: 1}, {id: 'leite', n: 1}],
          passos: [A('COLOCAR O LEITE', 'leite'), F({eletrico: true}),
            C('ESQUENTANDO', 'DESLIGAR', 'leite', 5.5, [.4, .75], {textos: {queimado: 'O leite ferveu e sujou o micro-ondas.'}}),
            A('MISTURAR O CAFÉ', 'misturar', 1)]}
      }},
    ovo_frito: {nome: 'Ovo frito', item: 'ovo_frito', rende: 1,
      modos: {
        fogo: {estacoes: ['fogao', 'fogareiro', 'fogueira', 'chapa'], vasilha: 'frigideira', ingredientes: [{id: 'ovo', n: 1}, {um: ['oleo', 'manteiga'], usos: 1}],
          passos: [A('UNTAR A FRIGIDEIRA', 'oleo'), F({ideal: 'medio'}), A('QUEBRAR O OVO', 'ovo', 1),
            C('FRITANDO', 'DESLIGAR', 'ovo', 6, [.42, .77], {bons: ['baixo', 'medio'], falha: 'gororoba', textos: {cru: 'Clara mole, quase crua.', ponto: 'Borda crocante, gema mole.'}})]}
      }},
    pao_chapa: {nome: 'Pão na chapa', item: 'pao_chapa', rende: 1,
      modos: {
        fogo: {estacoes: ['fogao', 'fogareiro', 'chapa'], vasilha: 'frigideira', ingredientes: [{id: 'pao_frances', n: 1}, {id: 'manteiga', usos: 1}],
          passos: [A('PASSAR MANTEIGA', 'manteiga', 1), F({ideal: 'medio'}),
            C('TOSTANDO', 'VIRAR', 'pao', 6, [.4, .78], {apaga: false, bons: ['baixo', 'medio']}),
            C('TOSTANDO O OUTRO LADO', 'DESLIGAR', 'pao2', 5.5, [.4, .78], {bons: ['baixo', 'medio']})]},
        sanduicheira: {estacoes: ['sanduicheira'], vasilha: 'sanduicheira', ingredientes: [{id: 'pao_frances', n: 1}, {id: 'manteiga', usos: 1}],
          passos: [A('PASSAR MANTEIGA', 'manteiga', 1), F({eletrico: true}), A('FECHAR', 'fechar', .7),
            C('TOSTANDO', 'ABRIR', 'pao', 6, [.42, .77], {})]}
      }},
    misto_quente: {nome: 'Misto quente', item: 'misto_quente', rende: 1,
      modos: {
        sanduicheira: {estacoes: ['sanduicheira'], vasilha: 'sanduicheira', ingredientes: [{id: 'pao_forma', n: 1}, {id: 'queijo', n: 1}, {id: 'presunto', n: 1}],
          passos: [A('MONTAR', 'montar', 1.2), F({eletrico: true}), A('FECHAR', 'fechar', .7),
            C('TOSTANDO', 'ABRIR', 'misto', 6, [.42, .77], {textos: {ponto: 'Queijo derretido, pão tostado.'}})]},
        fogo: {estacoes: ['fogao', 'fogareiro', 'chapa'], vasilha: 'frigideira', ingredientes: [{id: 'pao_forma', n: 1}, {id: 'queijo', n: 1}, {id: 'presunto', n: 1}],
          passos: [A('MONTAR', 'montar', 1.2), F({ideal: 'baixo'}),
            C('TOSTANDO', 'VIRAR', 'misto', 6, [.4, .78], {apaga: false, bons: ['baixo', 'medio']}),
            C('DERRETENDO O QUEIJO', 'DESLIGAR', 'misto2', 5.5, [.4, .78], {bons: ['baixo', 'medio']})]}
      }},
    miojo_pronto: {nome: 'Macarrão instantâneo', item: 'miojo_pronto', rende: 1,
      modos: {
        fogo: {estacoes: ['fogao', 'fogareiro', 'fogueira'], vasilha: 'panela', ingredientes: [{id: 'miojo', n: 1}, {agua: 1}],
          passos: [A('COLOCAR ÁGUA', 'agua'), F({ideal: 'alto'}),
            C('FERVENDO A ÁGUA', 'COLOCAR O MACARRÃO', 'agua', 4, [.4, 1], {apaga: false, queima: false, bons: ['medio', 'alto'], textos: {cru: 'A água nem ferveu direito.'}}),
            C('COZINHANDO', 'DESLIGAR', 'miojo', 6, [.42, .77], {falha: 'gororoba', textos: {cru: 'Macarrão duro.', queimando: 'Empapou e grudou no fundo.'}})]},
        chaleira: {estacoes: ['chaleira'], vasilha: 'chaleira', ingredientes: [{id: 'miojo', n: 1}, {agua: 1}],
          passos: [A('COLOCAR ÁGUA', 'agua'), F({eletrico: true}),
            C('FERVENDO', 'DESPEJAR NO POTE', 'agua', 5, [.42, .85], {}),
            C('TAMPADO, AMOLECENDO', 'DESTAMPAR', 'miojo_copo', 5, [.42, .8], {semFogo: true, queima: false, textos: {cru: 'Ainda meio duro.', queimando: 'Empapou.'}})]}
      }},
    marmita_quente: {nome: 'Marmita quente', item: 'marmita_quente', rende: 1,
      modos: {
        micro: {estacoes: ['micro_ondas'], vasilha: 'prato', ingredientes: [{id: 'marmita', n: 1}],
          passos: [A('TIRAR A TAMPA', 'tampa', .8), F({eletrico: true}),
            C('ESQUENTANDO', 'DESLIGAR', 'marmita', 7, [.42, .77], {falha: 'estoura', textos: {cru: 'Ainda gelada no meio.', queimado: 'POF! A marmita estourou dentro do micro-ondas.'}})]}
      }},
    pipoca: {nome: 'Pipoca', item: 'pipoca', rende: 1,
      modos: {
        fogo: {estacoes: ['fogao', 'fogareiro', 'fogueira'], vasilha: 'panela', ingredientes: [{id: 'milho_pipoca', usos: 1}, {id: 'oleo', usos: 1}],
          passos: [A('ÓLEO E MILHO NA PANELA', 'milho', 1.1), F({ideal: 'alto'}), A('TAMPAR', 'tampar', .7),
            C('ESTOURANDO', 'DESLIGAR', 'pipoca', 7, [.45, .78], {bons: ['medio', 'alto'], falha: 'gororoba', textos: {cru: 'Metade não estourou.', queimando: 'Cheiro de queimado na cozinha inteira.'}})]},
        micro: {estacoes: ['micro_ondas'], vasilha: 'saco', ingredientes: [{id: 'milho_pipoca', usos: 1}],
          passos: [A('COLOCAR O SACO', 'saco', .8), F({eletrico: true}),
            C('ESTOURANDO', 'DESLIGAR', 'pipoca', 7, [.45, .78], {falha: 'gororoba'})]}
      }},
    cha_boldo: {nome: 'Chá de boldo', item: 'cha_boldo', rende: 1,
      modos: {
        fogo: {estacoes: ['fogao', 'fogareiro', 'fogueira'], vasilha: 'leiteira', ingredientes: [{id: 'boldo', n: 1}, {agua: 1}],
          passos: [A('COLOCAR ÁGUA', 'agua'), F({ideal: 'medio'}),
            C('FERVENDO', 'DESLIGAR', 'agua', 6, [.42, .82], {}),
            C('ABAFANDO AS FOLHAS', 'SERVIR', 'cha', 5, [.4, .78], {semFogo: true, queima: false, textos: {cru: 'Chá fraco, quase água.', queimando: 'Ficou amargo demais.'}})]},
        chaleira: {estacoes: ['chaleira'], vasilha: 'chaleira', ingredientes: [{id: 'boldo', n: 1}, {agua: 1}],
          passos: [A('COLOCAR ÁGUA', 'agua'), F({eletrico: true}),
            C('FERVENDO', 'DESLIGAR', 'agua', 5, [.42, .8], {}),
            C('ABAFANDO AS FOLHAS', 'SERVIR', 'cha', 5, [.4, .78], {semFogo: true, queima: false})]}
      }},
    agua_fervida: {nome: 'Ferver a água', item: null, efeito: 'ferver', rende: 1,
      modos: {
        fogo: {estacoes: ['fogao', 'fogareiro', 'fogueira'], vasilha: 'panela', ingredientes: [{garrafa: ['duvidosa', 'contaminada']}],
          passos: [A('DESPEJAR A ÁGUA', 'despejar', 1), F({ideal: 'alto'}),
            C('FERVENDO', 'DESLIGAR', 'agua', 6, [.45, .85], {bons: ['medio', 'alto'], falha: 'secou', textos: {cru: 'Não chegou a ferver.', ponto: 'Fervura grossa: essa água serve.'}}),
            A('ESFRIAR E ENGARRAFAR', 'engarrafar', 1.4)]},
        chaleira: {estacoes: ['chaleira'], vasilha: 'chaleira', ingredientes: [{garrafa: ['duvidosa', 'contaminada']}],
          passos: [A('DESPEJAR A ÁGUA', 'despejar', 1), F({eletrico: true}),
            C('FERVENDO', 'DESLIGAR', 'agua', 5, [.45, .85], {falha: 'secou'}), A('ESFRIAR E ENGARRAFAR', 'engarrafar', 1.4)]}
      }},
    soro: {nome: 'Soro caseiro', item: 'soro', rende: 1,
      modos: {
        bancada: {estacoes: ['bancada', 'fogao', 'fogareiro', 'chapa', 'cafeteira', 'micro_ondas', 'sanduicheira', 'chaleira', 'fogueira'], vasilha: 'copo',
          ingredientes: [{agua: 1, limpa: true}, {id: 'sal', usos: 1}, {id: 'acucar', usos: 1}],
          passos: [A('ÁGUA NO COPO', 'copo', .9), A('UMA PITADA DE SAL', 'sal', .7), A('DUAS COLHERES DE AÇÚCAR', 'acucar', 1),
            C('MEXENDO', 'SERVIR', 'soro', 3.5, [.5, 1], {semFogo: true, queima: false, textos: {cru: 'Ainda tem grão no fundo.', ponto: 'Dissolveu tudo.'}})]}
      }}
  };

  /* ---- consultas ---- */
  const estacaoDe = id => ESTACOES[id] || null;
  function modoDa(receitaId, estacao) {
    const R = RECEITAS[receitaId];
    if (!R) return null;
    for (const [id, m] of Object.entries(R.modos)) if (m.estacoes.includes(estacao)) return {...m, id, receita: receitaId};
    return null;
  }
  const receitasDa = estacao => Object.keys(RECEITAS).filter(id => !!modoDa(id, estacao));
  /* A lista do mestre (`receitas` do campo) filtra o caderno. */
  function receitasDoCampo(estacao, texto) {
    const todas = receitasDa(estacao);
    const pedidas = String(texto || '').split(/[,;\n]/).map(s => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')).filter(Boolean);
    if (!pedidas.length) return todas;
    const escolhidas = todas.filter(id => pedidas.includes(id) || pedidas.includes(RECEITAS[id].nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')));
    return escolhidas.length ? escolhidas : todas;
  }
  const verboDoPasso = (passo, estacao) => estacaoDe(estacao)?.verbos?.[passo.verbo] || passo.verbo;
  /* Uma garrafa da bolsa que serve para uma receita (água ou água para ferver). */
  function garrafaDisponivel(itens, quais = null) {
    if (!itens?.entradas) return null;
    return itens.entradas().filter(e => e.def === 'garrafa_agua' && golesDa(e) > 0 && (!quais || quais.includes(e.data?.qualidade || 'potavel')))
      .sort((a, b) => golesDa(b) - golesDa(a))[0] || null;
  }
  /* O que falta para fazer a receita nesta estação. [] = dá para fazer. */
  function faltando(receitaId, estacao, itens, {energia = true} = {}) {
    const m = modoDa(receitaId, estacao);
    if (!m) return [{texto: 'Não dá para fazer aqui'}];
    const E = estacaoDe(estacao);
    const out = [];
    if (E?.eletrica && !energia) out.push({texto: 'Sem energia'});
    for (const ing of m.ingredientes) {
      if (ing.agua) {
        if (E?.agua) continue;
        const g = garrafaDisponivel(itens, ing.limpa ? ['potavel', 'fervida'] : null);
        if (!g && itens?.entradas) out.push({texto: ing.limpa ? 'Garrafa com água limpa' : 'Garrafa com água', id: 'garrafa_agua'});
        continue;
      }
      if (ing.garrafa) {
        const g = garrafaDisponivel(itens, ing.garrafa);
        if (!g && itens?.entradas) out.push({texto: 'Garrafa com água suspeita', id: 'garrafa_agua'});
        continue;
      }
      if (ing.um) {
        if (ing.um.some(id => usosDe(itens, id) >= (ing.usos || ing.n || 1))) continue;
        out.push({texto: ing.um.map(rotuloDe).join(' ou '), id: ing.um[0]});
        continue;
      }
      if (usosDe(itens, ing.id) < (ing.usos || ing.n || 1)) out.push({texto: rotuloDe(ing.id), id: ing.id});
    }
    return out;
  }
  /* Gasta os ingredientes (chamado quando o preparo começa). */
  function gastarIngredientes(receitaId, estacao, itens) {
    const m = modoDa(receitaId, estacao), E = estacaoDe(estacao);
    if (!m) return {ok: false};
    const usado = {ingredientes: [], garrafa: null, qualidadeAgua: 'potavel'};
    for (const ing of m.ingredientes) {
      if (ing.agua) {
        if (E?.agua) { usado.qualidadeAgua = 'potavel'; continue; }
        const g = garrafaDisponivel(itens, ing.limpa ? ['potavel', 'fervida'] : null);
        if (!g) { if (itens?.entradas) return {ok: false, motivo: 'Falta água.'}; continue; }
        usado.qualidadeAgua = g.data?.qualidade || 'potavel';
        const goles = golesDa(g) - 1;
        if (goles > 0) itens.alterar(g.id, dadosGarrafa(goles, g.data?.qualidade));
        else if (typeof itens.trocar === 'function') itens.trocar(g.id, 'garrafa_vazia', null);
        else itens.remover(g.id, 1);
        continue;
      }
      if (ing.garrafa) {
        const g = garrafaDisponivel(itens, ing.garrafa);
        if (!g) { if (itens?.entradas) return {ok: false, motivo: 'Falta a garrafa.'}; continue; }
        usado.garrafa = {id: g.id, goles: golesDa(g), qualidade: g.data?.qualidade || 'duvidosa'};
        continue;
      }
      const alvo = ing.um ? ing.um.find(id => usosDe(itens, id) >= (ing.usos || 1)) || ing.um[0] : ing.id;
      const n = ing.usos || ing.n || 1;
      const ok = ing.usos ? usarIngrediente(itens, alvo, n) : (itens?.gastar ? !!itens.gastar(alvo, n) : true);
      if (!ok) return {ok: false, motivo: `Falta ${rotuloDe(alvo).toLowerCase()}.`};
      usado.ingredientes.push({id: alvo, n});
    }
    return {ok: true, ...usado};
  }

  /* ---- a máquina do preparo (pura, determinística) ----
     st.fase: 'espera' (esperando o verbo), 'animando' (ação acontecendo),
     'cozinhando' (barra andando) ou 'fim'. `passo(st, dt)` devolve os eventos
     que a interface transforma em som e efeito: pim, fumaca, alerta, queimou. */
  const ZONAS = ['cru', 'quase', 'ponto', 'passou', 'queimando', 'queimado'];
  const TEXTOS_ZONA = {cru: 'Ficou cru.', quase: 'Quase no ponto.', ponto: 'No ponto!', passou: 'Passou um pouquinho.', queimando: 'Passou do ponto.', queimado: 'Queimou!'};
  function zonaDe(passo, p) {
    const [a, b] = passo.janela;
    if (p >= 1 && passo.queima !== false) return 'queimado';
    if (p < a - .15) return 'cru';
    if (p < a) return 'quase';
    if (p <= b) return 'ponto';
    if (p <= b + .1) return 'passou';
    return 'queimando';
  }
  const NOTA_ZONA = {cru: 1, quase: 2, ponto: 3, passou: 2, queimando: 1, queimado: 0};
  /* Estágio visual do que está na panela (0 cru … 5 carvão). */
  const estagioDe = (passo, p) => ZONAS.indexOf(zonaDe(passo, p));

  function novoPreparo(receitaId, estacao, {tranquilo = false, ingredientes = null} = {}) {
    const m = modoDa(receitaId, estacao), R = RECEITAS[receitaId], E = estacaoDe(estacao);
    if (!m || !R) return null;
    const passos = m.passos.map(p => ({...p, verbo: verboDoPasso(p, estacao)}));
    const primeiroFogo = passos.find(p => p.tipo === 'fogo');
    const st = {receita: receitaId, estacao, modo: m.id, vasilha: m.vasilha, passos, i: 0, fase: passos[0].tipo === 'cozinhar' ? 'cozinhando' : 'espera',
      t: 0, p: 0, T: 0, nivel: E?.niveis ? (primeiroFogo?.ideal || 'medio') : null, aceso: !E?.fogo, tranquilo: !!tranquilo,
      notas: [], falha: null, fim: false, marcas: {}, ingredientes: ingredientes || null, garrafa: ingredientes?.garrafa || null,
      qualidadeAgua: ingredientes?.qualidadeAgua || 'potavel'};
    return st;
  }
  const passoAtual = st => (st && !st.fim ? st.passos[st.i] : null);
  function proximoPasso(st) {
    const passo = st.passos[st.i];
    if (passo?.tipo === 'cozinhar' && passo.apaga !== false) st.aceso = false;
    st.i++;
    st.t = 0; st.p = 0; st.marcas = {};
    if (st.i >= st.passos.length) { st.fim = true; st.fase = 'fim'; return true; }
    st.fase = st.passos[st.i].tipo === 'cozinhar' ? 'cozinhando' : 'espera';
    return false;
  }
  /* O jogador apertou o verbo grande (ou trocou o fogo). */
  function agirPreparo(st, acao, valor = null) {
    if (!st || st.fim) return null;
    if (acao === 'nivel') {
      if (!ESTACOES[st.estacao]?.niveis || !NIVEIS.includes(valor)) return null;
      st.nivel = valor;
      return {tipo: 'nivel', nivel: valor};
    }
    const passo = st.passos[st.i];
    if (acao !== 'verbo' || !passo) return null;
    if (passo.tipo === 'acao') {
      if (st.fase !== 'espera') return null;
      st.fase = 'animando'; st.t = 0;
      return {tipo: 'acao', anim: passo.anim, passo: st.i};
    }
    if (passo.tipo === 'fogo') {
      if (st.fase !== 'espera') return null;
      st.aceso = true; st.fase = 'animando'; st.t = 0;
      return {tipo: 'acendeu', eletrico: !!passo.eletrico, nivel: st.nivel, passo: st.i};
    }
    // cozinhar: fecha o passo com a nota do momento
    const zona = zonaDe(passo, st.p);
    let nota = NOTA_ZONA[zona];
    let motivo = null;
    if (nota === 3 && passo.bons && st.nivel && !passo.bons.includes(st.nivel)) { nota = 2; motivo = st.nivel === 'alto' ? 'Fogo alto demais.' : 'Fogo fraco demais.'; }
    st.notas.push({passo: st.i, zona, nota, p: +st.p.toFixed(3), texto: motivo || passo.textos?.[zona] || TEXTOS_ZONA[zona]});
    const evento = {tipo: 'pronto', zona, nota, passo: st.i};
    proximoPasso(st);
    return evento;
  }
  /* Um quadro de tempo. `energia` desliga as estações elétricas. */
  function passoPreparo(st, dt, {energia = true} = {}) {
    const eventos = [];
    if (!st || st.fim || !(dt > 0)) return eventos;
    st.T += dt;
    const passo = st.passos[st.i];
    if (st.fase === 'animando') {
      st.t += dt;
      if (st.t >= passo.dur) { const antes = st.i; if (!proximoPasso(st)) eventos.push({tipo: 'passo', passo: st.i, de: antes}); else eventos.push({tipo: 'fim'}); }
      return eventos;
    }
    if (st.fase !== 'cozinhando') return eventos;
    const E = estacaoDe(st.estacao);
    if (E?.eletrica && !energia) { eventos.push({tipo: 'semEnergia'}); return eventos; }
    if (!passo.semFogo && E?.fogo && !st.aceso) return eventos;
    const vel = passo.semFogo || !E?.niveis ? 1 : (VELOCIDADE[st.nivel] || 1);
    const antes = st.p;
    st.p = st.p + dt / passo.dur * vel;
    const [a, b] = passo.janela;
    const limite = st.tranquilo ? b - .02 : (passo.queima === false ? 1 : 1);
    if (st.p > limite) st.p = limite;
    if (antes < a && st.p >= a && !st.marcas.pim) { st.marcas.pim = true; eventos.push({tipo: 'pim', passo: st.i}); }
    if (antes <= b + .05 && st.p > b + .05 && !st.marcas.fumaca && passo.queima !== false) { st.marcas.fumaca = true; eventos.push({tipo: 'fumaca', passo: st.i}); }
    if (antes <= .9 && st.p > .9 && !st.marcas.alerta && passo.queima !== false) { st.marcas.alerta = true; eventos.push({tipo: 'alerta', passo: st.i}); }
    if (st.p >= 1 && passo.queima !== false) {
      const falha = passo.falha || 'nota1';
      st.notas.push({passo: st.i, zona: 'queimado', nota: falha === 'nota1' ? 1 : 0, p: 1, texto: passo.textos?.queimado || TEXTOS_ZONA.queimado});
      eventos.push({tipo: 'queimou', falha, passo: st.i});
      if (falha === 'nota1') { proximoPasso(st); if (st.fim) eventos.push({tipo: 'fim'}); }
      else { st.falha = falha; st.fim = true; st.fase = 'fim'; eventos.push({tipo: 'fim'}); }
    }
    return eventos;
  }
  /* O que saiu da panela. */
  function resultadoPreparo(st) {
    if (!st) return null;
    const R = RECEITAS[st.receita];
    const notas = st.notas.map(n => n.nota);
    const pior = notas.length ? Math.min(...notas) : 2;
    const ruim = st.notas.filter(n => n.nota === Math.min(...notas)).pop() || st.notas[st.notas.length - 1] || null;
    if (st.falha === 'gororoba' || st.falha === 'estoura' || pior === 0) {
      return {item: 'gororoba', qualidade: 1, rende: 1, gororoba: true, estourou: st.falha === 'estoura',
        texto: ruim?.texto || TEXTOS_ZONA.queimado, titulo: 'Deu errado'};
    }
    if (R.efeito === 'ferver') {
      const fervida = pior >= 2;
      return {efeito: 'ferver', item: null, qualidade: pior, rende: 1, garrafa: st.garrafa, fervida,
        perdeuGole: st.notas.some(n => n.zona === 'passou' || n.zona === 'queimando'), seca: st.falha === 'secou',
        texto: st.falha === 'secou' ? 'A água secou na panela.' : fervida ? 'Fervida. Agora dá para beber.' : (ruim?.texto || 'Não ferveu direito.'),
        titulo: st.falha === 'secou' ? 'Secou' : fervida ? 'Água fervida' : 'Quase'};
    }
    return {item: R.item, qualidade: pior, rende: R.rende || 1, texto: ruim?.texto || TEXTOS_ZONA.ponto,
      titulo: pior === 3 ? 'No ponto!' : pior === 2 ? 'Ficou bom' : 'Deu para o gasto'};
  }
  /* Dados que acompanham o prato guardado na bolsa (só quando foge do normal). */
  function dadosDoPrato(item, qualidade) {
    const q = clamp(Math.round(qualidade), 1, 3);
    if (q === 2 || !DEFS[item]) return null;
    const d = DEFS[item], fem = d.genero === 'f';
    return {qualidade: q, name: `${d.label} ${q === 3 ? '★★★' : '★'}`,
      desc: `${d.desc} ${q === 3 ? (fem ? 'Saiu caprichada.' : 'Saiu caprichado.') : (fem ? 'Saiu mal feita.' : 'Saiu mal feito.')}`};
  }
  /* Guarda o resultado na bolsa. Devolve quantos couberam. */
  function guardarResultado(resultado, ctx = {}) {
    const itens = ctx.itens;
    if (!resultado?.item) return 0;
    const dados = dadosDoPrato(resultado.item, resultado.qualidade);
    if (!itens?.dar) return resultado.rende;
    let n = 0;
    for (let i = 0; i < resultado.rende; i++) if (itens.dar(resultado.item, 1, dados)) n++;
    return n;
  }
  /* Aplica o resultado de “ferver” na garrafa que entrou na panela. */
  function aplicarFervura(resultado, ctx = {}) {
    const itens = ctx.itens, g = resultado?.garrafa;
    if (!itens?.entradas || !g) return false;
    const entrada = itens.entradas().find(e => e.id === g.id);
    if (!entrada) return false;
    if (resultado.seca) { if (typeof itens.trocar === 'function') itens.trocar(entrada.id, 'garrafa_vazia', null); else itens.remover(entrada.id, 1); return true; }
    const goles = Math.max(1, golesDa(entrada) - (resultado.perdeuGole ? 1 : 0));
    const q = !resultado.fervida ? (entrada.data?.qualidade || 'duvidosa')
      : (entrada.data?.qualidade === 'contaminada' ? 'duvidosa' : 'fervida');
    itens.alterar(entrada.id, dadosGarrafa(goles, q));
    return true;
  }

  /* ================================================================ api */
  const Comida = {
    ITENS: NOVOS, ICONES, ESTACOES, RECEITAS, NIVEIS, VELOCIDADE, ZONAS, TEXTOS_ZONA, QUALIDADES_AGUA, ESTRELAS,
    def, consumoDe, verbo, rotuloDe, artigo, minutos, piorAgua,
    efeitoDaAgua, efeitoDaPrivada, efeitosDoConsumo, aplicarConsumo, fatorQualidade, qualidadeDe,
    golesDa, dadosGarrafa, encherGarrafa, temGarrafaParaEncher, garrafaDisponivel, usosDe, usarIngrediente,
    pedidoDe, iniciarPedido, consumirDaBolsa, consumirPronto, beberDaFonte,
    estacaoDe, modoDa, receitasDa, receitasDoCampo, verboDoPasso, faltando, gastarIngredientes,
    novoPreparo, passoAtual, agirPreparo, passoPreparo, resultadoPreparo, zonaDe, estagioDe, dadosDoPrato, guardarResultado, aplicarFervura
  };
  root.Comida = Comida;
  if (typeof module !== 'undefined' && module.exports) module.exports = Comida;
})(typeof window !== 'undefined' ? window : globalThis);
