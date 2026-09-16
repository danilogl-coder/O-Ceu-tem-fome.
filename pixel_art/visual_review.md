# Revisão visual

## Análise da referência

Imagem indexada nativa de 26×56, 16 cores opacas e transparência. Proporções esbeltas, pernas longas, cabeça expressiva, rosto voltado à direita, torso discretamente aberto como na pose lateral de um side-scroller. Cabelo violeta em grandes massas onduladas; camiseta curta dourada; short azul-escuro com barra lilás; botas marrons. Sombras quentes de pele e contornos locais vinho, roxo e marrom. Luz predominante superior esquerda/frontal. Clusters pequenos de 1–4 pixels descrevem planos; sem dithering.

## Iterações e mudança de direção

1. Quatro silhuetas A–D foram desenhadas em 64×96 e inspecionadas. B foi a escolha inicial.
2. V1: base, sombra, iluminação e detalhes em etapas separadas. Problemas: nariz exagerado, cabeça e tronco pouco fiéis à referência.
3. V2: ajustes locais em decote, olho, boca e short. A semelhança ainda ficou insuficiente.
4. V3: ajustes localizados no cabelo e cotovelo. Preservadas as demais áreas.
5. V4: nariz mais curto, cabelo mais volumoso, joelho e botas revistos. **Rejeitada pelo usuário**; as mudanças de desenho continuavam incompatíveis com o pedido.
6. V5: após “Faça idêntico”, a fonte passou a conter os próprios pixels da referência. Nenhum pixel visível foi redesenhado. O espaço restante da tela 64×96 é transparente. Peças e sobreposições ocultas foram verificadas para reconstruir exatamente essa pose.
7. V6, orientação final: preservar **silhueta e cabelo**, com roupas modulares. A pintura das regiões de roupas passou à rampa de pele. A silhueta alfa, o rosto e o cabelo continuam exatos. As roupas originais estão em overlays opcionais. Frente e trás do cabelo foram separados da cabeça. Esta é a base ativa.

`refinements.png` e `before_after_v2.png` até `before_after_v5.png` documentam as versões. `reference_comparison.png` mostra a arte original e a montagem final na mesma escala inteira de 8×. PNGs foram abertos para inspeção visual, inclusive a folha de caminhada e um quadro ampliado.

## Avaliação final subjetiva, em 1× e nearest neighbor

| Critério | Nota | Observação |
| --- | --- | --- |
| Silhueta | 9/10 | A mesma da referência, sem mudanças na pose original |
| Anatomia | 8/10 | Proporções originais preservadas; articulações dentro dos volumes |
| Clusters | 9/10 | Grupos originais, sem textura adicionada |
| Paleta | 10/10 | Mesmas 16 cores |
| Iluminação | 8/10 | Shading original preservado |
| Materiais | 9/10 | Pele, cabelo, tecido e couro mantêm sua separação |
| Leitura 1× | 9/10 | Igual à fonte, com área transparente adicional |
| Jaggies | 8/10 | Escalonamento original mantido sem filtros |
| Banding | 8/10 | Sem linhas adicionais na arte visível |
| Geral | 9/10 | Fidelidade exata no repouso; animação por peças rígidas |

Igualdade pixel a pixel é verificação objetiva, não nota estética. Na V6 essa igualdade se aplica à silhueta alfa, ao rosto e ao cabelo; as cores do corpo mudaram para remover roupas. A intenção final tem prioridade sobre redesenhar os clusters originais para tentar aumentar essas notas.

## Limites explícitos

A arte ocupa 26×56 dentro da tela 64×96: não foi esticada para preencher a tela. A referência possui ligeira abertura do tronco; ela foi mantida, com deslocamento lateral no jogo. Animação esquelética rígida reorganiza os pixels e pode mudar os degraus de uma diagonal; não equivale a uma animação redesenhada quadro a quadro. Silhueta, rosto e cabelo permanecem exatos na pose base; roupas não integram a pintura final do corpo.

## Atualização: anatomia e pose natural

A solicitação seguinte autoriza alterar o corpo para corrigir anatomia. A igualdade de silhueta descrita na V6 pertence ao histórico. A versão ativa tem 19 peças e 20 ossos, com mãos, pescoço e abdômen independentes. Ver `anatomy_research.md` e `generated/anatomy_comparison.png`.

V1: volumes corrigidos, mas junções muito marcadas (clusters 7/10). V2: mão deslocada e junções alinhadas. V3: contornos internos suavizados, pés separados e dedos compactos. Avaliação visual final: silhueta 8/10; anatomia 8/10; clusters 8/10; paleta 9/10; iluminação 8/10; leitura dos volumes 8/10; leitura 1x 8/10; jaggies 8/10; banding 8/10. São notas subjetivas; a validade técnica é verificada por scripts.

## Refinamento orientado pela imagem Pixel Art.png

Revisão 4: recuperadas inclinação do braço, distribuição das pernas e transição de cintura/quadril; mão distante recuada sob o corpo. Revisão 5: aplicados clusters de pele da referência às pernas, com limpeza localizada nos cotovelos, punhos, joelho e abdômen. A linha de sombra do short não foi copiada para a base. A comparação ampliada foi aberta e inspecionada, assim como a caminhada.

Mantidos 64×96 RGBA, paleta original, escala do desenho, ausência de interpolação e 19 peças/20 ossos. A fidelidade de corpo é interpretativa, pois a referência está vestida; rosto e cabelo preservam os arquivos anteriores. A base continua sem roupas.


## Pele contínua — revisão 6

Preservadas todas as máscaras e todos os pivôs da versão aprovada. Removidas faixas transversais no abdômen, quadril, cotovelos, punhos e joelhos. A primeira passagem ainda deixava contraste na junção quadril/coxa; a segunda estendeu o mesmo cluster de luz pelas duas peças. Um tom intermediário (#cf8e82) conecta sombra e luz da referência. Sem blur, antialiasing, gradientes ou transparência parcial.

Revisão visual em PNG ampliado por nearest-neighbor e folha de caminhada: silhueta 9/10; anatomia 8/10; clusters 8/10; paleta 9/10; iluminação 8/10; material 8/10; leitura 1x 8/10; jaggies 8/10; banding 8/10; geral 8/10. Avaliação artística subjetiva: os testes verificam integridade dos pixels e das junções, não realismo. Sombras de sobreposição entre membros permanecem para dar profundidade.


## Revisão 7 — cabelo

**Desenho.** A silhueta da referência foi mantida linha a linha na coroa (y20–y32) e alargada na massa (y33–y48), onde o original tinha pixels soltos. São 225 pixels de cabelo contra 177 da referência.

**Cheio, não trançado.** A primeira versão desta revisão errou: contorno escuro dos dois lados da massa mais um brilho contínuo descendo pelo meio. Largura igual à da referência, leitura completamente diferente — virou uma chiquinha. A correção foi tirar o contorno da borda interna (a referência não tem: ela escurece a face virada para o corpo, o que é sombra, não contorno), quebrar o brilho em poucos pixels e alargar a massa até encostar na silhueta do corpo em cada linha.

**Rampa.** Três tons não davam conta de separar mechas sem usar o contorno como linha interna. Com `#3a1236` entre o contorno e a sombra, a separação deixa de ser um vinco preto; com `#7e3a85` acima do tom médio, o brilho tem um núcleo em vez de um platô.

**Pixels piscando.** A segunda versão desta revisão dividia o cabelo em seis peças — coroa, três elos da massa, franja e uma mecha sobre o braço. Peças que se encostam abrem fresta assim que se movem quantidades diferentes, e era isso que piscava. Medido: 3.304 rasters com buraco cercado em 24.000. Três causas, todas eliminadas:

1. *Peças encostadas.* `hair_front` girava 0,3× do que `hair_back` girava, e a fronteira entre as duas, no contorno do cabelo sobre a testa, abria um pixel. Hoje são duas camadas com sobreposição total: `hair_back` é o cabelo inteiro e `hair_front` repete por cima só o que precisa cobrir o rosto.
2. *Mecha fina e solta.* A mecha de um a dois pixels que caía sobre o braço se partia em pontinhos quando linhas vizinhas deslizavam. Foi incorporada à massa.
3. *Rotação do bitmap.* Mesmo com uma peça só, girar a imagem e arredondar para o pixel mais próximo tira um pixel da ponta de uma linha e não da vizinha. Uma linha recuada em relação às duas vizinhas vira buraco cercado. Duas correções: o contorno foi redesenhado sem reentrâncias nem degraus de dois pixels, e as camadas de cabelo passaram a ser amostradas sem rotação — a inclinação da cabeça (no máximo 2,5°) entra como cisalhamento por linha, que é a mesma imagem e não pode perder pixel.

Resultado medido depois: 0 buracos cercados em 24.000 rasters, nos cinco modos e nos dois sentidos, e o cabelo nunca passa de duas peças conectadas.

**Física.** A primeira tentativa usava relaxamento angular por passo, que depende da taxa de quadros: o deslocamento de equilíbrio saía `a·dt/k`. Foi trocada por mola de segunda ordem sobre a posição desenhada, cujo equilíbrio é `a/k` e não depende do passo. A mecha verlet continua, mas o resultado dela virou deslocamento por linha em vez de ângulo de osso.


### Correções depois do teste em movimento

Três defeitos que só apareciam jogando, não na arte parada.

**Pele aparecendo sob a franja no salto.** As camadas de cabelo eram amostradas sem rotação e a cabeça com rotação, então no salto as duas se afastavam até um terço de pixel e a franja abria. Corrigido fazendo `head`, `hair_back` e `hair_front` compartilharem `anchor`: as três amostram pela mesma transformação e pelo mesmo pivô, e escorregar uma contra a outra deixou de ser possível.

**Cabeça pulando um pixel para trás ao andar.** A pose resolve a cabeça em x 32,4973–32,5033 — variação de três milésimos de pixel, mas parada em cima da fronteira de arredondamento. Arredondar não resolve, só muda onde fica a fronteira. Resolvido com histerese: o pino só troca de pixel quando a posição real sai do pixel segurado com folga de 0,75. De 144 mudanças em 900 quadros para 0.

**Mecha da bochecha pontilhada.** Com a rotação de volta, uma mecha diagonal de dois pixels perde um pixel numa linha e não na seguinte, virando uma diagonal de um pixel — que lê como pontinhos. Corrigido ignorando inclinação abaixo de 0,12 rad na unidade: a animação nunca passa de 0,043 rad, então na prática a unidade é transladada, não girada, e nenhum pixel se perde.

**Olhos tampados.** A franja tinha avançado até x32 nas linhas 27–29 e a mecha da bochecha até x36, comendo o branco de um olho e a íris do outro. A referência recua a entrada do cabelo até x30 e põe a mecha em x37 — foi para lá. O limite virou asserção em `hair.py` e em `validate_sprite.py`.


## Camada de vida

**Respiração visível custou a rotação do tronco.** A primeira versão aprofundava a respiração aumentando o ângulo do tronco com o esforço (±0,07 rad correndo). Medido: isso varre a cabeça 1,29 px na horizontal, contra 0,20 px sem. Como a cabeça é presa em pixel inteiro com histerese de 0,75, ela passava a trocar de pixel 19 vezes em 15 s de caminhada — o tique que já tinha sido corrigido, de volta por outra porta. O ângulo voltou para 0,012 rad fixo e a profundidade passou a ser expressa só em pixels de elevação do peito. Resultado: 0 trocas em velocidade constante.

**Ombros num canal próprio quebravam o ombro.** Levantar os braços um pixel além do tronco põe um degrau móvel na junta, e os dois canais cruzando o limiar de arredondamento com um quadro de diferença é uma piscada visível. Virou ângulo, que não tem costura.

**Molas de inércia subamortecidas tremiam.** Com ζ≈0,8 elas oscilavam em cima do limiar do pixel: 507 piscadas de um quadro em 898, correndo. Passaram a levemente superamortecidas (ζ≈1,05) e o movimento ficou monótono — sai e volta sem ricochetear. 

**O gesto de olhar girava a cabeça além do limiar.** `glance` somava 0,085 + 0,05 rad, passando de 0,12 e ligando a rotação do bitmap, que partia a mecha da bochecha em diagonal. Os ângulos caíram e o limiar subiu para 0,18, com margem para nada da animação cruzar por acidente. Numa cabeça de nove pixels quem vira é o olho, não o sprite.

**A curva do cabelo era indexada pela linha da tela.** Assim que o corpo passou a subir e descer de verdade, a curva escorregava ao longo da massa. Passou a ser indexada pela linha da arte que está sendo amostrada.

Medições finais, 898 quadros por modo, piscadas de um quadro na faixa da cabeça e do cabelo: parado 1, repouso 1, andar 16, pular 0, correr 38. Buracos no cabelo: 0 em 24.000 rasters. Cabeça em velocidade constante: 0 trocas laterais.
