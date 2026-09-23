/* Bag inventory. Rectangular footprints, bounded stacks and atomic packing.
   Logic only: the UI previews operations, this model validates every commit. */
(function(scope){
  'use strict';
  const CELL=16;            // sprite pixels per grid square; the HUD draws at 2x
  const ITEM_DEFS={
    bandage:{label:'Bandagem',desc:'Estanca sangramento e cobre o corte.',w:2,h:1,stack:3,effect:'bandage',
      palette:{K:'#230521',D:'#6f5c3c',d:'#8a7757',s:'#cbab82',w:'#e6d9c0',W:'#fffaef',y:'#b39a72'},
      grid:[
        '......KKKKK.....................',
        '....KKKWWWKKKKKKKKKK............',
        '...KKWWsswWdWWWWWWWKK...........',
        '..KKWWwwwwwwdWWsWWWsK...........',
        '..KWWwsssssswdwswwwsK...........',
        '.KKWssswwwwswdwswwwsK...........',
        '.KWswswDDwwsswdswWwsK...........',
        '.KdswswDDwswswdswwwsK...........',
        '.KdswsswwsswswdswwwsKKKK........',
        '.KKdswsssswssdwswswsWWWKKKK.....',
        '..KdsswwwwsswdwswwwsWwwWWWKKKK..',
        '..KKdsssssswdssssssswsswWwsWWKK.',
        '...KKddwwwdddddddddwwwwwwwwwwyK.',
        '....KKKdddKKKKKKKKKKdddwwwwwydK.',
        '......KKKKK........KKKKdddddKKK.',
        '......................KKKKKKK...']},
    splint:{label:'Tala',desc:'Imobiliza o osso quebrado para ele soldar.',w:3,h:1,stack:2,effect:'splint',
      palette:{K:'#230521',o:'#6b4a2e',n:'#946a40',l:'#b5865a',c:'#e1d6b2',C:'#f4ecd2',s:'#b3a684'},
      grid:[
        '..........KKKKKK................KKKKKK..........',
        '..KKKKKKKKKsCcsKKKKKKKKKKKKKKKKKKsCcsKKKKKKKKK..',
        '.KKllllllllsCcsllllllllllllllllllsCcsllllllllKK.',
        '.KnnnnnnnlnsCcsnnnnnnnooooooooooosCcsnnnnnnnnnK.',
        '.KnnnnooooosCcsooonnnnnnnnnnnnnnnsCcslnnnnnnnnK.',
        '.KnnnnnnnnnsCcsnnnnnnnnnnlnnooooosCcsoooonnnnnK.',
        '.KKoooooooosCcsoooooooooooooooooosCcsooooooooKK.',
        '..KKKKKKKKKsCssKKKKKKKKKKKKKKKKKKsCssKKKKKKKKK..',
        '..KKKKKKKKKssCsKKKKKKKKKKKKKKKKKKssCsKKKKKKKKK..',
        '.KKllllllllsCcsllllllllllllllllllsCcsllllllllKK.',
        '.KnnnnnnnnnsCcsnnnnnnnnnnnnnnnnlnsCcsooooooonnK.',
        '.KnnnoooooosCcsnnnnnnnnnnnnnnnnnnsCcsnnnnnnnnnK.',
        '.KnnnnnnnnnsCcsnnnnoooooooooooonnsCcsnnnnlnnnnK.',
        '.KKoooooooosCcsoooooooooooooooooosCcsooooooooKK.',
        '..KKKKKKKKKsCcsKKKKKKKKKKKKKKKKKKsCcsKKKKKKKKK..',
        '..........KKKKKK................KKKKKK..........']},
    antibiotic:{label:'Antibiótico',desc:'Interrompe a infecção antes da necrose.',w:1,h:2,stack:4,effect:'antibiotic',
      palette:{K:'#230521',b:'#7a4a12',a:'#a26209',A:'#df9d42',g:'#f0c877',G:'#fff0c6',d:'#5c3a06',p:'#d8ccb0',P:'#f6eedb',q:'#9d9280',m:'#8c2f3f',M:'#c04a5a',z:'#8d949c',Z:'#cfd6dd',x:'#5a6068'},
      grid:[
        '....KKKKKKKK....',
        '....KZZZZZxK....',
        '....KZzzxzxK....',
        '....KZZzzzxK....',
        '....KZzzzxxK....',
        '....KZzzzzxK....',
        '....KxxxxxxK....',
        '....KaaaaaaK....',
        '...KKagaaaaKK...',
        '...KaaaaaaaaK...',
        '...KagaaaaaaK...',
        '..KKaaaaaaaaKK..',
        '..KagGAAAAAAaK..',
        '..KaGAAAAAAdaK..',
        '..KaGAAAAAAdaK..',
        '..KagdddddddaK..',
        '..KagbbbbbbdaK..',
        '..KaggbbbbbdaK..',
        '..KPPPPPPPPPPK..',
        '..KpPPPPPPPPqK..',
        '..KpppppppppqK..',
        '..KpmmmmmmmmqK..',
        '..KpMMMMMMMMqK..',
        '..KpmmmmmmmmqK..',
        '..KpppppppppqK..',
        '..KppqqqqqqpqK..',
        '..KppqqqqqppqK..',
        '..KqqqqqqqqqqK..',
        '..KagbbbbbbdaK..',
        '..KagbbbbbbbaK..',
        '..KKddddddddKK..',
        '...KKKKKKKKKK...']},
    /* The bat: the first weapon. Wielded, it rests on her shoulder and swings
       with a key; thrown, it is the heaviest thing in the bag. */
    taco:{label:'Taco de beisebol',desc:'Madeira maciça. Empunhe para golpear com E; arremessado, machuca de verdade.',w:1,h:3,stack:1,kind:'weapon',
      palette:{K:'#230521',L:'#e2c48f',w:'#c9a066',d:'#8f6a3a',t:'#3a2a24',T:'#4a3830',g:'#6b4a34'},
      grid:[
        '................',
        '......KKKK......',
        '.....KLwwdK.....',
        '.....KLwwdK.....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '....KLwwwwdK....',
        '.....KLwwwdK....',
        '.....KLwwwdK....',
        '.....KLwwdK.....',
        '.....KLwwdK.....',
        '......KLwdK.....',
        '......KLwdK.....',
        '......KLdK......',
        '......KttK......',
        '......KTTK......',
        '......KttK......',
        '......KTTK......',
        '......KttK......',
        '......KTTK......',
        '......KttK......',
        '......KTTK......',
        '.....KggggK.....',
        '.....KKKKKK.....',
        '................']},
    /* The clothes she has on, as one bundle: two by two, one per outfit. The
       entry's data carries the outfit itself (which pieces, which dyes) and
       whether it is being worn. */
    roupa:{label:'Roupa',desc:'Um conjunto de roupas dobrado. Vestido, é o que o personagem tem no corpo.',w:2,h:2,stack:1,kind:'outfit',
      palette:{K:'#230521',b:'#2f4f8a',B:'#3b62a8',c:'#5a84c8',d:'#8c3a5e',D:'#a94a74',e:'#c96a90',w:'#efe6d8',W:'#fffaef',s:'#c9b27a',g:'#6b4a34'},
      grid:[
        '................................',
        '..........KKKKKKKKKKK...........',
        '........KKdddddddddddKK.........',
        '.......KddDDDDDDDDDDDddK........',
        '......KdDDDDeDDDDDDDDDDdK.......',
        '......KdDDDeeDDDDDDDDDDdK.......',
        '......KdDDDDDDDDDDDDDDDdK.......',
        '......KKdDDDDDDDDDDDDDdKK.......',
        '.......KKddddddddddddKK.........',
        '.....KKKKKKKKKKKKKKKKKKKKK......',
        '....KbbbbbbbbbbbbbbbbbbbbbK.....',
        '...KbBBBBBBBBBBBBBBBBBBBBbbK....',
        '...KbBBcBBBBBBBBBBBBBBBBBbbK....',
        '...KbBccBBBBBBBBBBBBBBBBBbbK....',
        '...KbBBBBBBBBBBBBBBBBBBBBbbK....',
        '...KbBBBBBBBBBBBBBBBBBBBBbbK....',
        '...KbbBBBBBBBBBBBBBBBBBBbbbK....',
        '...KKbbbbbbbbbbbbbbbbbbbbbKK....',
        '....KKKKKKKKKKKKKKKKKKKKKKK.....',
        '....KwwwwwwwwwwwwwwwwwwwwwwK....',
        '...KwWWWWWWWWWWWWWWWWWWWWwwK....',
        '...KwWWWWWWWWWWWWWWWWWWWWwwK....',
        '...KwWWWWWWWWWWWWWWWWWWWWwwK....',
        '...KwwwwwwwwwwwwwwwwwwwwwwwK....',
        '....KKKKKKKKKKKKKKKKKKKKKKK.....',
        '......KggggggggggggggggggK......',
        '......KgssssssssssssssssgK......',
        '......KgssssssssssssssssgK......',
        '......KggggggggggggggggggK......',
        '.......KKKKKKKKKKKKKKKKKK.......',
        '................................',
        '................................']},
    /* A clue picked up in the scene: a paper, a note, a sealed letter, a photo
       or a small object. One square; the entry's data says which clue it is,
       and `variants` draw it as the kind of thing it is. */
    pista:{label:'Pista',desc:'Algo encontrado no cenário. Examine para ver de perto.',w:1,h:1,stack:1,kind:'clue',
      palette:{K:'#230521',w:'#e8e0cc',W:'#fbf6ea',g:'#8a8070',l:'#5a5060',y:'#e9d36a',Y:'#f6ea9c',o:'#b8925a',c:'#efe4d4',r:'#b5473a',b:'#4a5b88',p:'#6f5c3c',P:'#8a7757'},
      grid:[
        '................',
        '...KKKKKKKKK....',
        '...KWWWWWWWwK...',
        '...KWWWWWWWwK...',
        '...KWllllWWwK...',
        '...KWWWWWWWwK...',
        '...KWlllllWwK...',
        '...KWWWWWWWwK...',
        '...KWllllWWwK...',
        '...KWWWWWWWwK...',
        '...KWlllllWwK...',
        '...KWWWWWWWwK...',
        '...KwwwwwwwwK...',
        '...KKKKKKKKKK...',
        '................',
        '................'],
      variants:{
        bilhete:[
          '................',
          '..KKKKKKKKKKK...',
          '..KYYYYYYYYyK...',
          '..KYyyyyyyyyK...',
          '..KYYYYYYYYyK...',
          '..KYllllYYYyK...',
          '..KYYYYYYYYyK...',
          '..KYlllllYYyK...',
          '..KYYYYYYYYyK...',
          '..KYllllYYYyK...',
          '..KYYYYYYYYyK...',
          '..KyyyyyyyyyK...',
          '..KKKKKKKKKKK...',
          '................',
          '................',
          '................'],
        carta:[
          '................',
          '................',
          '.KKKKKKKKKKKKK..',
          '.KccccccccccccK.',
          '.KcWcccccccccWK.',
          '.KccWcccccccWcK.',
          '.KcccWcccccWccK.',
          '.KccccWcccWcccK.',
          '.KcccccWrWccccK.',
          '.KccccccrccccK..',
          '.KccccccccccccK.',
          '.KccccccccccccK.',
          '.KKKKKKKKKKKKK..',
          '................',
          '................',
          '................'],
        foto:[
          '................',
          '..KKKKKKKKKKK...',
          '..KWWWWWWWWWK...',
          '..KWbbbbbbbWK...',
          '..KWbbbYbbbWK...',
          '..KWbbbbbbbWK...',
          '..KWbggggbbWK...',
          '..KWggggggbWK...',
          '..KWggggggbWK...',
          '..KWggggggbWK...',
          '..KWWWWWWWWWK...',
          '..KWWWWWWWWWK...',
          '..KKKKKKKKKKK...',
          '................',
          '................',
          '................'],
        objeto:[
          '................',
          '................',
          '....KKKKKKKK....',
          '...KooooooooK...',
          '..KoPPPPPPPPoK..',
          '..KoPppppppPoK..',
          '..KoPpppppppoK..',
          '..KKKKKKKKKKKK..',
          '..KopppppppppK..',
          '..KopppKKppppK..',
          '..KopppKKppppK..',
          '..KoppppppppoK..',
          '..KoooooooooOK..',
          '...KKKKKKKKKK...',
          '................',
          '................'].map(r=>r.replace('O','o'))}},
    /* What the exploration runs on. Money for the machines, the payphone and
       the arcade: gold and silver coins, fifty to a square. */
    moedas:{label:'Moedas',desc:'Trocados para máquinas, orelhões e fliperamas.',w:1,h:1,stack:50,kind:'money',
      palette:{K:'#230521',o:'#7c3b12',O:'#b8691a',y:'#e39a2e',Y:'#f7c64a',W:'#fff4b8',S:'#8579a6',i:'#bdb3d8',I:'#e4ddf3',L:'#fbf3ff'},
      grid:[
        '........KKKKK...',
        '......KKSIIILKK.',
        '......KSIIIIILK.',
        '.....KSIIiiiIILK',
        '.....KSIiIIIiILK',
        '..KKKKKKKILIiIIK',
        '.KYYYYYYWKIIiIIK',
        'KyYYYYYYWWKiIISK',
        'KOyyyyyyYOKIISK.',
        'KoOOOOOYWWKSSKK.',
        'KooooooOOOKKK...',
        'KoOOOOOYWWK.....',
        'KooooooOOOK.....',
        'KoOOOOOYWWK.....',
        '.KooooOOOK......',
        '..KKKKKKK.......']},
    /* A key opens the lock with its name: every key is its own entry, and its
       data carries the name (data.nome) and, optionally, a variant - an access
       card is a key too. */
    chave:{label:'Chave',desc:'Abre a fechadura que tem o mesmo nome.',w:1,h:1,stack:1,kind:'key',
      variantLabels:{cartao:'Cartão de acesso'},
      palette:{K:'#230521',o:'#5f3410',O:'#9c611c',y:'#cf9434',Y:'#ecc15a',W:'#fdf0b4',k:'#9a8fb8',c:'#ddd6ea',C:'#f6f2fc',b:'#244a93',B:'#4379cf'},
      grid:[
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '..KKKK..........',
        '.KYYYWK.........',
        'KyYyyYWKKKKKKKK.',
        'KoYKKOYWYYYYYYWK',
        'KoYKKOyyOOOOOyYK',
        'KoyYYOOOKOOoOyOK',
        '.KooOOKKKoOKoOOK',
        '..KKKK..KoOKKoOK',
        '.........KK..KK.',
        '................'],
      variants:{
        cartao:[
          '................',
          '................',
          '................',
          '................',
          '.....KKK........',
          '.KKKKkkkKKKKKKK.',
          'KcCCCCCCCCCCCCCK',
          'KcBBBBBBBBBBBBCK',
          'KcbbbbbbbbbbbbCK',
          'KccccccccccccCCK',
          'KcYYWckkkkkkcCCK',
          'KcOyycccccccccCK',
          'KccccckkkkkkccCK',
          'KkkkkkkkkkkkkkcK',
          '.KKKKKKKKKKKKKK.',
          '................']}},
    /* A spare part: glass cartridge, brass caps, the wire still whole. */
    kit_reparo:{label:'Kit de reparo',desc:'Caixa de ferramentas com chaves, fita e uma lata de massa. Dá para tirar o pior de um carro batido — um kit por conserto.',w:2,h:2,stack:2,kind:'part',
      consumed:'Você gastou o kit de reparo no carro.',
      palette:{K:'#1a0d07',h:'#7a6a58',m:'#5a2a20',M:'#8a8496',n:'#c0bcc8',r:'#a8342c',R:'#c4483a',t:'#d8b45a',w:'#f0d88c',g:'#4a3018'},
      grid:[
        '................................',
        '................................',
        '................................',
        '..........KKKKKKKKKKKK..........',
        '.........KhhhhhhhhhhhhK.........',
        '........KhhKKKKKKKKKKhhK........',
        '........KhhK........KhhK........',
        '........KhhK........KhhK........',
        '........KhhK........KhhK........',
        '........KhhK........KhhK........',
        '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
        '..KnnnnnnnnnnnnnnnnnnnnnnnnnnK..',
        '..KMMMMMMMMMMMMMMMMMMMMMMMMMMK..',
        '..KMMMMMMMMMMMMMMMMMMMMMMMMMMK..',
        '..KmmmmmmmmmmmtttttmmmmmmmmmmK..',
        '..KrrrrrrrrrrrtwwwtrrrrrrrrrrK..',
        '..KRRRRRRRRRRRtwwwtRRRRRRRRRRK..',
        '..KRRRRRRRRRRRtttttRRRRRRRRRRK..',
        '..KrrrrrrrrrrrrrrrrrrrrrrrrrrK..',
        '..KrrrrKKKKrrrrrrrrrKKKKrrrrrK..',
        '..KrrrKMMMMKrrrrrrrKMMMMKrrrrK..',
        '..KrrrKMnnMKrrrrrrrKMnnMKrrrrK..',
        '..KrrrKMMMMKrrrrrrrKMMMMKrrrrK..',
        '..KrrrrKKKKrrrrrrrrrKKKKrrrrrK..',
        '..KrrrrrrrrrrrrrrrrrrrrrrrrrrK..',
        '..KggrrrrrrrrrrrrrrrrrrrrrggrK..',
        '..KmmmmmmmmmmmmmmmmmmmmmmmmmmK..',
        '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
        '................................',
        '................................',
        '................................',
        '................................']},
    fusivel:{label:'Fusível',desc:'Fusível de reposição para a caixa de força.',w:1,h:1,stack:3,kind:'part',
      palette:{K:'#230521',o:'#5f3410',O:'#9c611c',y:'#cf9434',Y:'#ecc15a',W:'#fdf0b4',g:'#3f6c95',G:'#79acd0',L:'#bfe5f7',E:'#f2fcff',w:'#8a2f3c'},
      grid:[
        '...........KKK..',
        '..........KYYWK.',
        '.........KYYYWWK',
        '........KYyyYWWK',
        '.......KyyyyOYyK',
        '......KoOOOooOK.',
        '.....KLEEwGgoK..',
        '....KLEEwGggK...',
        '...KLEEwGggK....',
        '..KoLEwGggK.....',
        '.KOoooOooK......',
        'KYyyyOooK.......',
        'KYyyOooK........',
        'KyyOooK.........',
        '.KKKKK..........',
        '................']},
    /* Food and drink, from the machines and the fridge. `consumed` is what the
       bag says when one is eaten or drunk. */
    refrigerante:{label:'Refrigerante',desc:'Lata gelada de refrigerante, ainda fechada.',w:1,h:2,stack:3,kind:'food',consumed:'Você bebeu o refrigerante.',
      palette:{K:'#230521',m:'#62101f',M:'#a01d31',R:'#d5343f',H:'#ff8b7e',v:'#b7a8c8',w:'#ece5f4',W:'#fff3fa',s:'#51486b',S:'#8f86ad',i:'#cbc3de',I:'#f4f0fb'},
      grid:[
        '................',
        '................',
        '.....KKKKKK.....',
        '....KSiiiISK....',
        '...KSsssiIISK...',
        '..KSsssSisIISK..',
        '..KsSiiiiiIISK..',
        '..KssSSSSiIISK..',
        '.KmMMRRRRRRHRMK.',
        '.KmMMRRRRRRHRMK.',
        '.KmMMRRRRRRHRMK.',
        '.KmMMRRRRRRHRMK.',
        '.KmMMRRRRRRHRMK.',
        '.KmMMRRRRRRHRMK.',
        '.KmMwwwRRRRHRMK.',
        '.KmvwwwwRRRHRvK.',
        '.KvvwwwwwRRHwvK.',
        '.KvMMRRwwwwWwMK.',
        '.KmMMRRRwwwWRMK.',
        '.KmvwwwRRwwWRMK.',
        '.KvMMRRwRRRHRvK.',
        '.KmMMRRRwRRHwMK.',
        '.KmMMRRRRwwWRMK.',
        '.KmMMRRRRRRHRMK.',
        '.KmMMRRRRRRHRMK.',
        '.KmMMRRRRRRHRMK.',
        '.KmMMRRRRRRHRMK.',
        '..KssSSSSiIISK..',
        '...KsSSSSiISK...',
        '....KKKKKKKK....',
        '................',
        '................']},
    agua:{label:'Água',desc:'Garrafinha de água mineral.',w:1,h:2,stack:3,kind:'food',consumed:'Você bebeu a água.',
      palette:{K:'#230521',b:'#1b3a7a',B:'#2f62bf',c:'#79a8ec',p:'#86aecb',P:'#c4e2f2',L:'#f1fbff',a:'#2a6aa6',A:'#4b93cf',q:'#8acbee',u:'#2a58a8',U:'#5b8fe0',w:'#eef0fb',v:'#b7c0dc'},
      grid:[
        '......KKKK......',
        '.....KBBBcK.....',
        '....KbBBBcBK....',
        '....KbBbBcBK....',
        '....KbBbBcBK....',
        '....KbbbBBbK....',
        '...KpPPPPLLpK...',
        '....KpPPLPpK....',
        '....KpPPLPpK....',
        '...KpPPPPLPpK...',
        '..KppPPPPPLPpK..',
        '..KaAAAqqqLqAK..',
        '..KaAAAqqqLqAK..',
        '..KaaAAAqqqAaK..',
        '..KaAAAqqqLqAK..',
        '..KuuuuuuuUUuK..',
        '..KvwwwwwwLwvK..',
        '..KvwwwuwwLwvK..',
        '..KvwwuUuwLwvK..',
        '..KvwwuuuwLwvK..',
        '..KvwwwwwwLwvK..',
        '..KuuuuuuuUUuK..',
        '..KaAAAqqqLqAK..',
        '..KaAAAqqqLqAK..',
        '..KaaAAAqqqAaK..',
        '..KaAAAqqqLqAK..',
        '..KaaAAAqqqAaK..',
        '..KaAAAqqqLqAK..',
        '...KaAAqqLqaK...',
        '....KaaAqqaK....',
        '.....KKKKKK.....',
        '................']},
    salgadinho:{label:'Salgadinho',desc:'Pacote de salgadinho de queijo.',w:1,h:1,stack:4,kind:'food',consumed:'Você comeu o salgadinho.',
      palette:{K:'#230521',r:'#6e1426',R:'#b8263a',P:'#e0484f',H:'#ff9c80',Y:'#f6b73c',W:'#ffe79a',c:'#c98a2c',C:'#f7d36e'},
      grid:[
        '.....KK..K......',
        '....KCWKKCK.....',
        '...KCWCcKWCK....',
        '..KrcCcCcCcHK...',
        '.KrRRRRRRPPHHK..',
        '.KrRPPPPPYYWHK..',
        '.KrRPPPPYYWPHK..',
        '.KrRPPPYYWPPPK..',
        '.KrRPPYYWPPPPK..',
        '.KrRPYYWPPPPPK..',
        '.KrRYYWPPPPPPK..',
        '.KrRPPPPPPPPPK..',
        '.KrrRRRRRRRRRK..',
        '..KrPRPRPRPRK...',
        '..KRKRKPKPKPK...',
        '...K.K.K.K.K....']},
    chocolate:{label:'Chocolate',desc:'Barra de chocolate ao leite.',w:1,h:1,stack:5,kind:'food',consumed:'Você comeu o chocolate.',
      palette:{K:'#230521',d:'#2e140c',c:'#5a2e1a',C:'#86492a',h:'#b06a3c',H:'#d9965e',p:'#4a1a5e',q:'#7a3494',Q:'#a95cc2',U:'#d99ae6',Y:'#e8b24a',W:'#ffe7a0',f:'#9c93b8',F:'#eee9f8'},
      grid:[
        '................',
        '................',
        '................',
        '.KKKKKKKKKKKKKK.',
        'KhHchHFfqQQQQUUK',
        'KChcChFfqQUQQQUK',
        'KccdccFfqQQQQQUK',
        'KhHchHFfqYYYYWQK',
        'KChcChFfqQQQQQUK',
        'KCCdCCffpqqqqqqK',
        'KccdccffpppppppK',
        '.KKKKKKKKKKKKKK.',
        '................',
        '................',
        '................',
        '................']},
    cafe:{label:'Café',desc:'Copo de café quente, com tampa.',w:1,h:1,stack:2,kind:'food',consumed:'Você tomou o café.',
      palette:{K:'#230521',d:'#8c7160',v:'#c9b39f',w:'#efe3d3',W:'#fffaf1',n:'#8f84a8',l:'#d6cde6',L:'#f7f3fd',b:'#5e3520',B:'#8e5a34',t:'#c08650',s:'#d9cdea'},
      grid:[
        '......s....s....',
        '.....s....s.....',
        '......s....s....',
        '....KKKKKKKKK...',
        '..KKnlllllnLLK..',
        '.KnnlllllllLLLK.',
        '.KnnnnnnnnnlllK.',
        '..KdvwwwwwwWwwK.',
        '..KdvwwwwwwwWwK.',
        '..KbBBBBttttBtK.',
        '..KbBBBBBtttBtK.',
        '..KbbBBBBBtBBtK.',
        '...KdvwwwwwWwK..',
        '...KdvwwwwwWwK..',
        '....KddvvvvvK...',
        '.....KKKKKKK....']}
  };
  const ITEM_ORDER=['bandage','splint','antibiotic'];
  // Which treatment each item unlocks, so the HUD can ask the case for one.
  const EFFECT_ITEM={bandage:'bandage',splint:'splint',antibiotic:'antibiotic'};
  const validDef=id=>typeof id==='string'&&Object.hasOwn(ITEM_DEFS,id);
  const positive=n=>Number.isSafeInteger(n)&&n>0;
  const orientation=rot=>rot===0||rot===1;

  const footprint=(defId,rot)=>{const d=ITEM_DEFS[defId];
    return rot?{w:d.h,h:d.w}:{w:d.w,h:d.h};};

  class Inventory {
    constructor(cols=10,rows=6){
      if(!positive(cols)||!positive(rows)||!Number.isSafeInteger(cols*rows))
        throw new RangeError('As dimensões da bolsa devem ser inteiros positivos.');
      this.cols=cols;this.rows=rows;this.entries=[];this.serial=0;this.revision=0;
    }
    get capacity(){return this.cols*this.rows;}
    get used(){return this.entries.reduce((n,e)=>{const f=footprint(e.def,e.rot);return n+f.w*f.h;},0);}
    get(id){return this.entries.find(e=>e.id===id)||null;}

    /* Occupancy map: entry id per square, null where free. Rebuilt on demand -
       the case is 60 squares, so there is nothing to gain from caching it. */
    occupancy(skipId){
      const map=new Array(this.cols*this.rows).fill(null);
      for(const e of this.entries){
        if(e.id===skipId)continue;
        const f=footprint(e.def,e.rot);
        for(let y=e.y;y<e.y+f.h;y++)for(let x=e.x;x<e.x+f.w;x++)map[y*this.cols+x]=e.id;
      }
      return map;
    }
    at(x,y){
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.cols||y>=this.rows)return null;
      return this.get(this.occupancy()[y*this.cols+x]);
    }
    /* A placement is legal when it stays inside the case and every square it
       wants is free. skipId lets an item test a move against everything but
       itself. */
    fits(defId,x,y,rot=0,skipId){
      if(!validDef(defId)||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!orientation(rot))return false;
      const f=footprint(defId,rot);
      if(x<0||y<0||x+f.w>this.cols||y+f.h>this.rows)return false;
      const map=this.occupancy(skipId);
      for(let yy=y;yy<y+f.h;yy++)for(let xx=x;xx<x+f.w;xx++)if(map[yy*this.cols+xx])return false;
      return true;
    }
    /* First free slot scanning row by row, trying the item's own orientation
       before turning it - the same order a player's eye takes. */
    findSlot(defId,rot=0){
      if(!validDef(defId)||!orientation(rot))return null;
      for(const r of [rot,rot?0:1])
        for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++)
          if(this.fits(defId,x,y,r))return {x,y,rot:r};
      return null;
    }
    place(defId,x,y,rot=0,qty=1,data=null){
      if(!validDef(defId)||!positive(qty)||qty>ITEM_DEFS[defId].stack)return null;
      if(!this.fits(defId,x,y,rot))return null;
      const entry={id:++this.serial,def:defId,x,y,rot,qty};
      if(data&&typeof data==='object')entry.data=JSON.parse(JSON.stringify(data));
      this.entries.push(entry);this.revision++;return entry;
    }
    /* One item that carries its own data (a clue, an outfit): never merged
       into a stack, placed in the first free slot. Returns the entry, or null
       when the bag has no room. */
    addEntry(defId,data=null,qty=1){
      if(!validDef(defId))return null;
      const slot=this.findSlot(defId);
      return slot?this.place(defId,slot.x,slot.y,slot.rot,qty,data):null;
    }
    /* Adding tops up an existing stack first, exactly as ammo merges in RE4,
       and only then looks for floor space. Returns what could not be taken. */
    add(defId,qty=1){
      if(!validDef(defId)||!positive(qty))return qty;
      const def=ITEM_DEFS[defId];
      let left=qty;
      for(const e of this.entries){
        if(left<=0)break;
        if(e.def!==defId||e.qty>=def.stack||e.data)continue;
        const room=def.stack-e.qty,take=Math.min(room,left);
        e.qty+=take;left-=take;this.revision++;
      }
      while(left>0){
        const slot=this.findSlot(defId);
        if(!slot)break;
        const take=Math.min(def.stack,left);
        this.place(defId,slot.x,slot.y,slot.rot,take);left-=take;
      }
      return left;                       // 0 means everything went in
    }
    move(id,x,y,rot){
      const e=this.get(id);if(!e)return false;
      if(rot===undefined)rot=e.rot;
      if(!this.fits(e.def,x,y,rot,id))return false;
      e.x=x;e.y=y;e.rot=rot;this.revision++;return true;
    }
    /* Turning in place. When the footprint no longer fits where it sits, nudge
       it back inside the case and let overlap decide - a silent failure here
       would feel broken, so the caller gets false and the item does not move. */
    rotate(id){
      const e=this.get(id);if(!e)return false;
      const rot=e.rot?0:1,f=footprint(e.def,rot);
      const x=Math.min(e.x,this.cols-f.w),y=Math.min(e.y,this.rows-f.h);
      return this.move(id,x,y,rot);
    }
    remove(id){
      const i=this.entries.findIndex(e=>e.id===id);
      if(i<0)return null;
      this.revision++;return this.entries.splice(i,1)[0];
    }
    count(defId){return this.entries.reduce((n,e)=>n+(e.def===defId?e.qty:0),0);}
    has(defId,n=1){return validDef(defId)&&positive(n)&&this.count(defId)>=n;}
    /* Spending a supply drains the smallest stack first, so partial stacks get
       cleared out instead of littering the case. */
    consume(defId,n=1){
      if(!this.has(defId,n))return false;
      const stacks=this.entries.filter(e=>e.def===defId).sort((a,b)=>a.qty-b.qty);
      let left=n;
      for(const e of stacks){
        if(left<=0)break;
        const take=Math.min(e.qty,left);e.qty-=take;left-=take;
        if(e.qty===0)this.remove(e.id);
      }
      this.revision++;return true;
    }
    consumeFor(effect,n=1){
      const defId=EFFECT_ITEM[effect];
      return defId?this.consume(defId,n):false;
    }
    consumeEntry(id,n=1){
      const e=this.get(id);if(!e||!positive(n)||e.qty<n)return false;
      e.qty-=n;if(!e.qty)this.remove(id);else this.revision++;
      return true;
    }
    hasFor(effect,n=1){
      const defId=EFFECT_ITEM[effect];
      return defId?this.has(defId,n):false;
    }
    // Transfer as much as fits. The remainder keeps its position and identity.
    merge(sourceId,targetId){
      const source=this.get(sourceId),target=this.get(targetId);
      if(!source||!target||source===target||source.def!==target.def||source.data||target.data)return 0;
      const take=Math.min(source.qty,ITEM_DEFS[target.def].stack-target.qty);
      if(take<=0)return 0;
      source.qty-=take;target.qty+=take;
      if(!source.qty)this.remove(source.id);
      this.revision++;return take;
    }
    // Reserve space before spending anything from the source stack.
    split(id,qty){
      const source=this.get(id);
      if(!source||!positive(qty)||qty>=source.qty)return null;
      const slot=this.findSlot(source.def,source.rot);
      if(!slot)return null;
      const entry=this.place(source.def,slot.x,slot.y,slot.rot,qty);
      if(!entry)return null;
      source.qty-=qty;return entry;
    }
    /* Pack a candidate in isolation. Greedy packing is not guaranteed to find
       every possible arrangement; failure must preserve the original exactly. */
    autoSort(){
      const held=this.entries.slice().sort((a,b)=>{
        const A=ITEM_DEFS[a.def],B=ITEM_DEFS[b.def];
        return (B.w*B.h)-(A.w*A.h) || Math.max(B.w,B.h)-Math.max(A.w,A.h)
            || a.def.localeCompare(b.def) || a.id-b.id;
      });
      const candidate=new Inventory(this.cols,this.rows);
      for(const e of held){
        const wide=ITEM_DEFS[e.def].w>=ITEM_DEFS[e.def].h?0:1;
        const slot=candidate.findSlot(e.def,wide);
        if(!slot)return false;
        candidate.entries.push({...e,...slot});
      }
      for(const next of candidate.entries){
        const e=this.get(next.id);e.x=next.x;e.y=next.y;e.rot=next.rot;
      }
      this.revision++;
      return true;
    }
    restore(data){
      if(!data||!Array.isArray(data.entries))return false;
      const next=new Inventory(data.cols||this.cols,data.rows||this.rows),ids=new Set();
      for(const e of data.entries){if(!positive(e.id)||ids.has(e.id))return false;const item=next.place(e.def,e.x,e.y,e.rot,e.qty,e.data);if(!item)return false;item.id=e.id;ids.add(e.id);}
      this.cols=next.cols;this.rows=next.rows;this.entries=next.entries;this.serial=Math.max(0,...ids);this.revision++;return true;
    }
    snapshot(){
      return {cols:this.cols,rows:this.rows,used:this.used,capacity:this.capacity,
        revision:this.revision,
        entries:this.entries.map(e=>{const f=footprint(e.def,e.rot);
          return {...e,data:e.data?JSON.parse(JSON.stringify(e.data)):undefined,w:f.w,h:f.h,label:entryLabel(e)};})};
    }
  }

  /* Sprite to SVG. Runs of one colour collapse into a single rect, and a turned
     item rotates about its own centre so the pixel grid stays square. */
  function itemPixels(defId,rot=0,variant=null){
    const def=ITEM_DEFS[defId];if(!def)return '';
    let out='';
    const grid=(variant&&def.variants?.[variant])||def.grid;
    grid.forEach((row,y)=>{
      let x=0;
      while(x<row.length){
        const ch=row[x];
        if(ch==='.'){x++;continue;}
        let run=1;while(row[x+run]===ch)run++;
        out+=`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${def.palette[ch]}"/>`;
        x+=run;
      }
    });
    if(!rot)return out;
    // Turning clockwise: (x,y) -> (spriteH - y, x), so the art lands inside the
    // swapped viewBox with every pixel still on a whole coordinate.
    return `<g transform="translate(${def.h*CELL} 0) rotate(90)">${out}</g>`;
  }
  function itemIcon(defId,rot=0,cls='item-icon',variant=null){
    const def=ITEM_DEFS[defId];if(!def)return '';
    const f=footprint(defId,rot);
    return `<svg viewBox="0 0 ${f.w*CELL} ${f.h*CELL}" class="${cls}" shape-rendering="crispEdges" role="img" aria-label="${def.label}">${itemPixels(defId,rot,variant)}</svg>`;
  }
  // The variant an entry draws with: a clue is drawn as the kind of thing it is.
  const entryVariant=e=>e?.data?.variant||null;
  /* The name a key answers to: data.nome, or data.name for a key made the old way. */
  const keyName=e=>String(e?.data?.nome??e?.data?.name??'').trim();
  /* What an entry is called in the bag. A key says what it is and which lock
     it opens ("Chave · Porão"); anything else is its own name or its label. */
  const entryLabel=e=>{
    const def=ITEM_DEFS[e?.def];if(!def)return '';
    if(def.kind==='key'){
      const base=def.variantLabels?.[entryVariant(e)]||def.label,nome=keyName(e);
      return nome?`${base} · ${nome}`:base;
    }
    return e.data?.name||def.label;
  };
  /* The short tag written on the square: a clue's name, a key's lock. */
  const entryTag=e=>{
    const kind=ITEM_DEFS[e?.def]?.kind;
    return kind==='key'?keyName(e):kind==='clue'?String(e.data?.name||''):'';
  };

  Object.assign(scope,{ITEM_DEFS,ITEM_ORDER,EFFECT_ITEM,INVENTORY_CELL:CELL,
    Inventory,itemFootprint:footprint,itemPixels,itemIcon,entryVariant,entryLabel,entryTag,keyName});
  if(typeof module!=='undefined')module.exports={ITEM_DEFS,ITEM_ORDER,EFFECT_ITEM,CELL,
    Inventory,footprint,itemPixels,itemIcon,entryVariant,entryLabel,entryTag,keyName};
})(globalThis);
