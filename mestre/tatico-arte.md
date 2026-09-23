# Direção de arte do combate

O HUD é desenhado em `tatico-hud.js`, no mesmo canvas de 480×270 da cena. Não depende de imagens remotas ou de fontes do sistema. Os 14 ícones de ataques e ações são desenhos originais de `tatico-icons.js`, armazenados em cache a 64×64 com fundo transparente. A tipografia usa as fontes bitmap existentes do PixelKit.

`TacticalIcons.export(id,256)` exporta PNG ampliado quatro vezes com nearest-neighbor. A rasterização de polígonos preenche pixels inteiros, sem antialiasing; a transparência dos pixels é sempre 0 ou 255. A barra usa versões reduzidas sem suavização e o tooltip mostra a arte nativa. Os PNGs de 64×64 e 256×256 e uma prancha estão em `pixel_art/generated/tatico/`.

## Referências consultadas

- Jason Perry, [Using and Choosing Colors](https://finalbossblues.com/using-and-choosing-colors/): paleta compartilhada, contraste, agrupamento dos pixels em áreas legíveis e mudança de matiz entre luz e sombra. Aplicação: fundos azulados, sombras violetas, cobre nas superfícies e dourado nos destaques. Evitar pixels decorativos soltos que confundam a silhueta dos golpes.
- Jon Shafer, [Building a Solid UI](https://www.gamedeveloper.com/design/building-a-solid-ui): hierarquia visual, prioridade das informações e clareza funcional. Aplicação: iniciativa no alto, personagem ativo e recursos à esquerda, golpes no centro e confirmação à direita. Ícones ganham nome, custo e repetição ao passar o cursor; a mira só ocupa a cena quando solicitada.

## Construção

- Bordas em degraus, rebites de dois pixels e luz superior marcam painéis. Silhuetas diferentes distinguem punho, chute, cotovelo, joelho, unhas, dentes, cabelo, terra, empurrão e rasteira.
- Recursos permanecem separados por personagem. A moldura dourada da fila indica o turno e a seleção marca o alvo; o retrato e os recursos grandes na base pertencem ao atacante. Rótulos complementam as cores.
- A mira reutiliza `HEALTH_ANATOMY`, as formas e ossos exportados pelo Health, e as partes do corpo da entidade selecionada. Membros ausentes não são selecionáveis. Exibe CD e sua composição; olhos têm botões separados. O cartão de reação interrompe a seleção do cenário, mas preserva acesso à pausa do mestre.
- Sem suavização ao compor sprites, ícones, letras e painéis. A janela dos jogadores conserva a opção de ampliação inteira; a escala responsiva do mestre segue o tamanho da janela.
- O compositor sobe a imagem da cena em 32 pixels durante o modo tático, deixando os pés acima da barra. As coordenadas lógicas não mudam. Os cliques no cenário compensam esse deslocamento; cliques em painéis são consumidos antes de consultar o terreno.
- O cenário é composto após efeitos de iluminação. Cada janela desenha seu HUD e o mesmo estado visual do dado; não há uma nova rolagem no cliente. A posição do dado deriva do raster posado e projetado do personagem, acima de todos os pixels do corpo e da roupa. Documentos e cortina do mestre continuam por cima.
- O editor avançado **MESTRE > AJUSTAR MESA** conserva campos HTML para edição de fichas, terreno, números e opções. Os controles usados durante a luta estão no canvas.

## Verificação visual e funcional

`tests/browser-tatico-hud.test.js` produz capturas nativas de preparação, batalha, mira, jogadores e oportunidade em `pixel_art/generated/tatico/hud-*.png`. `browser-tatico-integracao.test.js` exporta a arte e verifica CD configurável, anatomia, inventários individuais, uso de itens pelas duas janelas, PA, desfazer, entrada tardia, arrastar iniciativa, turno ativo, dados acima do sprite, salvamento e postura. Os testes de câmera, recursos, direção, dado e sessão cobrem as integrações preservadas.
