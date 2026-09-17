# O Céu tem Fome — RPG de mesa

Abra **index.html** diretamente no navegador. Não há instalação, dependências JavaScript, build ou conexão externa. É a mesa digital do RPG: o mestre monta os cenários com luz, clima e som, esconde pistas na própria cena e cuida da personagem (saúde, bolsa e roupas), e os jogadores acompanham numa tela só deles (`jogadores.html`).

A página abre com o nome do RPG, a cena e um cartão **Na mesa** com os atalhos da personagem e do mestre. A personagem nasceu como protótipo de anatomia e movimento; as ferramentas daquela fase (inspeção do rig, ficha do sprite, links do cabelo) saíram da página, e o histórico continua abaixo.

A base atual refina **a anatomia, a pose e o cabelo**, preservando os arquivos do rosto. O cabelo foi redesenhado a partir da referência e é simulado em tempo real. Roupa e botas foram removidas da pintura do corpo e exportadas como camadas opcionais. O PNG original tem 26×56 pixels; o arquivo entregue tem uma tela transparente de 64×96, com o desenho em `(19,20)`. Não houve ampliação, redução ou interpolação da fonte. Os previews usam apenas nearest neighbor. As primeiras interpretações estão guardadas somente como histórico.

## Usar

- **Base**: corpo sem roupas, com contorno e cabelo da referência.
- **Roupas opcionais**: faixas, camiseta, short, botas e **manto com capuz** como camadas sobrepostas, desativadas inicialmente. Dois slots são especiais: o **manto** fica por cima de qualquer outra roupa e tem física própria; as **faixas** ficam por baixo de todas elas.
- **Respirar**, **Andar**, **Correr**, **Cair**, **Pular**: demonstrações de animação esquelética. Correr e cair têm **15 quadros cada**, um por desenho das folhas `png/Run (1..15)` e `png/Dead (1..15)`.
- **Vida**, **Física do cabelo** e **Brisa**: ligam a camada de vida, a simulação do cabelo e o vento ambiente.
- Passe o mouse pela cena: os olhos acompanham o ponteiro.
- **Guarda-roupa** (**G** ou o botão ROUPAS na cena): cabelos, chapéus, blusas, casacos, calças, saias, calçados, acessórios, tons de pele e cor dos olhos, tudo desenhado por código sobre os mesmos ossos do corpo, com cor própria, conjuntos prontos e física nas peças soltas. Detalhes em [Guarda-roupa](#guarda-roupa).
- **Ragdoll**: segure o botão esquerdo sobre o personagem e arraste. O ponto segurado acompanha o mouse; o corpo gira com gravidade e inércia e colide com o chão. Ao soltar, ele mantém o impulso. A recuperação parte da postura física atual: de bruços, busca apoio; de costas, senta e recolhe as pernas; invertido, primeiro se desvira; agachado, firma os pés e sobe. Se já estiver em pé, faz só um ajuste de equilíbrio. Os pés ficam plantados durante a subida, e a posição da queda é preservada. Enquanto estiver no ar ou segurado, continua em ragdoll. É possível pegá-lo novamente durante a recuperação. Funciona nas duas direções e com zoom da página.
- **Mapa do mestre** (**M**): o cenário é uma cena que o mestre troca ao vivo para os jogadores, com prévia, transições, luz, clima, objetos, efeitos, documentos e uma janela limpa para TV, projetor ou Discord. O cenário inicial é o **Escritório**, em três camadas. Detalhes em [Mapa do mestre](#mapa-do-mestre).
- **Escritório do Jorge**: terceira cena do mapa do mestre (**Shift+3**), inspirada em *Five Nights at Freddy's* sem animatrônicos — mural da investigação, edições do livro, computador, câmeras que reagem à investigação e uma impressora que liga sozinha. Detalhes em [O Escritório do Jorge](#o-escritório-do-jorge).
- **Jogar**: A/D ou setas movem, Espaço pula, **Shift** corre e **F** derruba a personagem. A corrida entra acima de 96 px/s. Após a queda, ela se levanta onde caiu com o clipe **levantar**: apoia as mãos, sobe o peito, põe um pé à frente, agacha e fica de pé. Virar de lado inclina o corpo na direção nova por alguns quadros.
- **Esqueleto**: mostra articulações e hierarquia.
- **Cores**: uma fileira de amostras — cabelo, cada olho, faixas, camiseta, short, botas e manto. Cada amostra já é a cor que ela define, então a fileira também é a leitura do que ela está vestindo; escolher a cor de uma roupa veste a roupa.
- No inspetor, escolha um osso, ajuste o ângulo e oculte peças. **Restaurar aparência** desfaz ajustes visuais, sem mudar a posição ou interromper a física.
- A linha do tempo permite pausar e percorrer o ciclo. Há controles de toque em telas pequenas.

## Bolsa de suprimentos

O inventário é uma bolsa de couro marrom aberta em pixel art, com grade **10 × 6** integrada ao forro. A moldura, os controles roxos, as luas e a cruz seguem o HUD de saúde. O jogo e os ferimentos continuam evoluindo enquanto ela está aberta. A bolsa e o painel de saúde podem ficar abertos ao mesmo tempo; em telas estreitas, os dois painéis ficam empilhados com rolagem independente.

- **I** ou o botão da bolsa abre/fecha. Arraste o cabeçalho para reposicionar; com foco nele, use as setas.
- Clique ou use **Tab** para selecionar um item e consultar descrição, tamanho e quantidade. **R** ou **Girar** alterna a orientação.
- Arraste para mover; a prévia indica posição livre, bloqueada ou junção de pilhas. Soltar em posição inválida mantém a origem.
- Pelo teclado, **Enter** pega o item, setas escolhem a posição, **R** gira e **Enter** confirma. **Esc** cancela o movimento primeiro; sem movimento, fecha a bolsa.
- **Dividir** separa a quantidade escolhida para o primeiro espaço disponível. **Juntar** transfere para outras pilhas do mesmo item em ordem de ID. Também é possível juntar arrastando sobre uma pilha compatível; o excedente permanece na origem.
- **Organizar** rearranja os itens somente se todos couberem. Quando a tentativa falha, posições e quantidades permanecem intactas.
- Para tratar, abra a bolsa (**I**) e a saúde (**H**) e arraste o item sobre a região ferida do mapa ou sobre o quadro de ferimentos da região selecionada. O destino indica se o item é compatível.
- O uso leva **3 s para bandagem**, **5 s para tala** e **4 s para antibiótico**. Há progresso no item e no painel de saúde, acompanhado de uma animação de enfaixar, ajustar a tala ou tomar o remédio. O item só é consumido ao concluir, diretamente da pilha arrastada.
- **Esc** ou **Cancelar uso** interrompe sem gastar. Movimento voluntário, novo dano, perda do membro alvo, incapacidade, falta do item ou saída da janela também interrompem. A pausa da animação congela o tempo de uso. Uma ação por vez; a pilha em uso fica reservada. É necessário ter pelo menos um braço e uma mão presentes.
- A bandagem aceita cortes sem curativo; a tala aceita fraturas não imobilizadas; o antibiótico aceita regiões ainda não tratadas com infecção ou risco de infecção. O remédio preserva a regra existente de interromper a necrose sem regenerar tecido perdido. Os antigos botões de tratamento, legenda e instruções estáticas foram removidos.
- **Repor suprimentos · demonstração** mantém os controles de reposição da cena. Não há peso, fabricação ou salvamento entre sessões.
- **Botão direito** num item abre as opções dele: *Examinar* (pistas), *Vestir / Tirar a roupa* (a roupa), *Empunhar / Guardar* (o taco), *Separar 1*, *Largar no chão* e *Descartar*. A **lixeira** no canto da bolsa descarta o item selecionado com um segundo clique de confirmação, ou o que for solto sobre ela.
- **Itens no cenário** (`itens-cena.js`): arrastar um item para fora da bolsa sobre a cena, ou *Largar no chão*, coloca-o no mundo com física própria — cai, quica, desliza, para nas paredes da sala e fica onde caiu quando você muda de cena e volta. Um clique sobre ele perto do personagem o guarda de novo (longe demais, ele avisa); segurar e mover carrega, e soltar com a mão rápida **arremessa**. Um item que voa e acerta o personagem machuca a região da altura em que bateu — hematoma, corte, fratura conforme a força e o peso (um taco pesa quatro vezes uma bandagem) — e um golpe forte o derruba. Os jogadores veem tudo isso na tela deles.
- **A roupa é um item.** O que o personagem veste aparece na bolsa como um pacote de roupas de 2 × 2, contornado em dourado e marcado *VESTIDA*. Ele guarda o conjunto inteiro do guarda-roupa (peças e cores; cabelo, barba, corpo e pele não são roupa e ficam na pessoa). Mexer no guarda-roupa atualiza o pacote; *Tirar a roupa* deixa o personagem sem roupa e o pacote na bolsa; *Vestir* põe de volta; largar ou descartar o pacote também despe na hora, e o pacote no chão pode ser pego e vestido de novo.
- **As pistas pequenas vão para a bolsa primeiro.** Documento, bilhete, carta, foto e objeto clicados na cena (pelo mestre ou pelos jogadores) não abrem: viram um item de uma casa na bolsa, com a arte do tipo, e somem do cenário. *Examinar* abre a interface da pista para todos; largar ou descartar deixa o item no chão ou fora do jogo, e *Zerar progresso* no painel do mestre devolve tudo ao cenário. Mesa, computador, cofre e mapa continuam abrindo onde estão.
- **O taco de beisebol** é a primeira arma: um item de 1 × 3 na bolsa. *Empunhar* o coloca no ombro do personagem (a mão é desenhada por cima do cabo para ler como pegada); **E** golpeia — um arco de braço e tronco que manda voando qualquer item solto ao alcance; *Guardar* devolve à bolsa. Se um braço falta, o outro segura. Arremessado como qualquer item, é o que mais machuca. **Ele não começa na bolsa: quem entrega é o mestre**, na seção **Itens** do mapa do mestre (**M**) — *Na bolsa*, *No chão* (cai na frente do personagem) ou *Na mão* (já empunhado). Na demonstração, *Repor suprimentos* também tem **+ Taco**.

Regras de estoque em `inventory.js` (entradas com `data` — pista, roupa — nunca se juntam em pilha), interação em `inventory-ui.js`, itens no mundo em `itens-cena.js`, o taco em `armas.js`, tratamentos temporizados em `treatment.js` e animações em `treatment-motion.js`. `Inventory.merge(sourceId, targetId)` retorna a quantidade transferida; `Inventory.split(id, qty)` retorna a nova entrada ou `null`; `consumeEntry(id, qty)` consome uma pilha específica. Operações recusadas não alteram o estoque; `autoSort()` retorna `false` sem alterar a disposição se não conseguir acomodar tudo. `TreatmentAction` valida início, avanço, interrupção e conclusão sem depender do DOM. `TreatmentMotion` altera somente o esqueleto visual, mantendo as articulações e a física intactas.

Validação: `node tests/inventory.test.js`, `node tests/treatment.test.js`, `node tests/itens-cena.test.js` (física dos itens, clique/carregar/arremessar, o golpe que acerta a região certa uma vez só, o taco no ombro e o golpe dentro dos limites articulares, pistas na bolsa e de volta ao cenário), `node tests/browser-itens.test.js` (Chrome: pacote de roupa vestido, largado, pego e vestido de novo; taco empunhado, golpe que manda a bandagem voando, arremesso que machuca, arrastar para o cenário, lixeira), `node tests/browser-treatment.test.js`, `node tests/browser-inventory.test.js`, `node tests/browser-bag.test.js` e `node tests/browser-health.test.js`. Os testes de navegador usam Playwright e Chrome; `PLAYWRIGHT_MODULE` pode apontar para a instalação local de Playwright. Capturas em `pixel_art/generated/bag/` e `pixel_art/generated/treatment/`.

## Mapa do mestre

O cenário deixou de ser um fundo fixo: é uma **cena**, e o mestre troca a cena dos jogadores durante a partida. Tudo continua sem instalação, sem servidor e sem arquivos de imagem ou som: abra `index.html` e aperte **M**.

### O painel: seções em coluna

O mapa do mestre crescia como uma aba comprida, e cada recurso novo empurrava o resto para baixo. Agora ele tem **uma coluna de seções à esquerda, com ícone em pixel art e nome em palavras simples**, como a [navigation rail do Material Design](https://m3.material.io/components/navigation-rail/guidelines), e só a seção aberta rola. A janela mantém o mesmo tamanho ao trocar de seção, então nada pula de lugar.

- **Ao vivo, sempre à vista**: a miniatura do que os jogadores veem, a cena, a luz e a hora, e os três botões de urgência — **Abrir tela dos jogadores**, **Cortina** e **↶ Anterior**.
- **Avisos clicáveis** logo abaixo: *Pedido: Porta 101* (quando alguém tenta uma passagem sem destino), *Pistas 3/11*, *Som desligado*, *Som ligado* ou a música que está tocando, *Jogadores clicam* ou *não clicam* e, quando for o caso, **Cortina fechada ×** e **Documento na tela ×**. Um clique no aviso leva à seção certa; os avisos com **×** abrem a cortina ou recolhem o documento na hora.
- **Blocos que recolhem**: cada título (▾) fecha o seu bloco, vários podem ficar abertos, e o painel lembra quais estavam recolhidos e qual seção estava aberta, mesmo depois de recarregar. *Como a personagem usa* e *Atalhos* começam recolhidos.
- **Filtro de pistas**: digitar em *Filtrar pistas* mostra só as que têm aquilo no nome, no tipo ou na nota (sem ligar para acentos). As notas do mestre aparecem em duas linhas; um clique mostra a nota inteira.
- **Teclado**: com o foco na coluna, **↑ ↓** trocam de seção. Em tela muito baixa (celular deitado), a janela inteira rola e a coluna fica presa no topo.

| Seção | O que tem |
| --- | --- |
| **Cenas** | Biblioteca, prévia só do mestre, luz, clima, entrada, transição, letreiro e **Enviar aos jogadores** |
| **Montar** | Biblioteca de cenas genéricas e conjuntos prontos, cenas montadas da sessão e o editor: prancheta de arrastar, objetos, inspetor, peças e sala |
| **Luz e clima** | Iluminação e relógio, clima, objetos da cena, efeitos (tremor, relâmpago, escuridão…) e a personagem (teleporte, parede) |
| **Som** | Som ambiente com os canais e as músicas |
| **Pistas** | Pistas da cena (criar, abrir, editar, filtro), conclusões, o que já foi encontrado e anotações da cena |
| **Exploração** | Pedidos de improviso, passagens de qualquer cena (destino, chegada, tranca, elevador), mapa de conexões, eventos e preferências |
| **Itens** | Entregar itens, o que está no chão desta cena e como a personagem usa cada um |
| **Jogadores** | Tela dos jogadores, cliques deles nas pistas, cortina e documento |
| **Sessão** | Exportar, importar, recomeçar e a lista de atalhos |

### A mesa em duas janelas

- **Abrir tela dos jogadores** abre `jogadores.html`, uma janela sem nenhum controle: só a cena, a cortina e os documentos. Leve-a para a TV, o projetor ou o segundo monitor e aperte **F** nela; no Discord ou no OBS, compartilhe só essa janela. **Abrir no segundo monitor** usa a Window Management API do Chrome quando há mais de uma tela.
- A imagem é a mesma do jogo do mestre, quadro a quadro, sem os marcadores do mestre, a linha de arrasto nem os painéis. Ela vai por `postMessage` com o buffer de pixels transferido, o que funciona até por `file://`, onde as duas páginas nem têm a mesma origem. Se `jogadores.html` for aberta à mão, um `BroadcastChannel` é tentado. A escala é inteira quando cabe (4× em 1920×1080) e **E** alterna para ajustar à tela; o cursor e a barra somem sozinhos.
- O indicador mostra se a tela está conectada, a taxa de quadros e o tamanho da janela. Se o jogo do mestre recarregar, a tela reconecta sozinha em menos de um segundo. O navegador pode pausar janelas totalmente cobertas: deixe as duas visíveis.

### Preparar em silêncio, enviar quando quiser

Como no modo estúdio do OBS e na diferença entre “ver” e “ativar” cena do Foundry, a seção **Cenas** tem uma **prévia que só o mestre vê**: escolha a cena na biblioteca (miniaturas; **1–9**), a luz, o clima, os objetos e o ponto de entrada, e mova a câmera da prévia. **Enviar aos jogadores** (**Ctrl+Enter**) aplica tudo com a transição escolhida: esmaecer, dissolver, íris em volta da personagem, persiana ou corte seco, com duração e **letreiro** opcional (nome e subtítulo em fonte de pixel). **Shift+número** envia uma cena na hora. **↶ Anterior** desfaz a última mudança ao vivo.

### Ambiente ao vivo

Em **Luz e clima**, tudo muda para os jogadores sem recarregar nada, com uma dissolução pontilhada:

- **Iluminação**: Manhã, Tarde, Pôr do sol, Noite e Luzes apagadas. Cada uma pinta de novo as camadas pela luz, não por filtro, e também escurece ou esfria a personagem.
- **Relógio da cena**: o relógio de parede mostra a hora escolhida e continua andando.
- **Clima**: céu limpo ou chuva (céu fechado, chuva na janela, sem sol no chão).
- **Objetos**: aparecem e somem (luminária, monitor, café, envelope lacrado, molho de chaves, papéis no chão, bilhete na porta, arquivo entreaberto, retrato torto, pegadas e poça de sangue).
- **Efeitos**: tremor (**T**), relâmpago com trovão (**L**), luzes piscando, escuridão com raio em volta da personagem e pulso de tensão com batimento.
- **Som ambiente**: sintetizado no navegador. Ruído de sala, relógio, chuva, grilos à noite, vento em cena externa, trovão e batimento. Liga num botão, porque o navegador só permite som depois de um clique. **Cada som tem a própria chave** — tom da sala, chuva, vento, relógio, grilos e pingos, batimento, trovão e os passos do personagem — e o que foi escolhido fica salvo na sessão.
- **Passos**: a camada de movimento avisa quando um calcanhar pousa (dois por passada, alternando os pés, mais fortes correndo, um ao aterrissar de um salto) e o som toca conforme o piso — madeira no escritório (batida surda com um estalo em cima), grama na cena de campo (um esmagado de ruído).
- **Música**: cinco trilhas curtas escritas em notas e tocadas pelo navegador, em loop, uma de cada vez, com volume próprio e lembradas na sessão (voltam a tocar quando o som é ligado): *Investigação* (baixo andante em ré menor, piano abafado, colchão de cordas), *Tensão* (bordão grave, quintas desafinadas, um sopro), *Chuva calma* (arpejos de triângulo sobre maj7), *Perseguição* (baixo quadrado, caixa de ruído, arpejo), *Lamento* (melodia triste em lá menor). Ficam em `MUSIC` no `som-ambiente.js`: cada voz é uma onda, um ganho, um envelope e as notas como `[tempo, altura MIDI, duração]`.
- **Personagem**: leva a personagem para qualquer ponto de entrada da cena.

### Itens para a personagem

A seção **Itens** entrega qualquer item que não tenha história própria — bandagem, tala, antibiótico e o taco de beisebol (roupa sai do guarda-roupa, pista sai do cenário):

- **Na bolsa**, com quantidade para o que empilha; se não couber tudo, diz quanto coube.
- **No chão**: cai deitado na frente da personagem, na cena atual, e os jogadores veem. Ela guarda com um clique perto, ou arremessa.
- **Na mão** (só armas): vai para a bolsa e já é empunhado; **E** golpeia.

A seção mostra os espaços usados da bolsa, o que está na mão e quantos itens estão soltos na cena, e **Recolher tudo para a bolsa** guarda o que estiver no chão, perto ou longe dela. A lista vem de `ITEM_DEFS` (`inventory.js`), então um item novo aparece ali sozinho; a ponte com o jogo é o `itemDesk` de `app.js`.

### Pistas na cena

As pistas ficam **dentro da cena** e se abrem **clicando nelas**, sem passar pelo mapa do mestre. Sobre uma pista o cursor vira uma lupa; o clique abre a interface dela, desenhada em pixel art na própria imagem do jogo, então os jogadores veem a mesma coisa na tela deles. **Esc** fecha. **P** mostra as áreas de todas as pistas (só para o mestre).

- **Os jogadores também clicam**, pela janela deles: o cursor muda sobre as pistas, o clique e a digitação voltam para o jogo do mestre. O mestre desliga isso em **Jogadores → Jogadores podem clicar nas pistas** (ou no aviso *Jogadores clicam*, no topo do painel).
- **Pista encontrada**: na primeira abertura aparece o aviso “PISTA ENCONTRADA” (desligável) e ela entra no registro com quem achou: a cena, os jogadores ou o mestre.
- **Conclusões com a regra das três pistas**: cada conclusão mostra quantas pistas a sustentam e quantas já foram achadas, e avisa quando tem menos de três. O Escritório vem com quatro conclusões, cada uma com três a seis caminhos.
- **Memória das interfaces**: gaveta aberta, computador logado, barbante no mapa, cadeado aberto e botão já apertado ficam gravados na sessão. **Zerar progresso** apaga o que a mesa fez, não o que o mestre escreveu.

**Criar pistas próprias** (seção **Pistas → + Nova pista**): nome, tipo, marca na cena (brilho, ícone flutuante, contorno, discreta ou oculta, que só o mestre abre), objeto da cena que a faz aparecer, conclusões que ela apoia, nota só para o mestre e os campos do tipo. **Marcar na cena** deixa o painel transparente: arraste sobre a cena para desenhar a área, em qualquer lugar da parede do fundo, do chão ou de um objeto da frente. A área acompanha a camada certa quando a câmera anda. **Testar só pra mim** abre a pista só na tela do mestre. Cada pista da lista tem **Abrir** (para todos), **Só eu**, **Olhar** (a câmera vai até ela), **Ativa/Desativada**, **Editar** e **Excluir**. As pistas que já vêm com a cena podem ser editadas ou excluídas e voltam com **Restaurar originais**.

Tipos de pista, cada um com a própria interface:

| Tipo | Interface |
| --- | --- |
| **Documento** | Ofício timbrado com brasão, papel velho ou recorte de jornal; texto datilografado com rolagem, assinatura e carimbo |
| **Bilhete** | Papel rasgado com fita ou post-it amarelo ou rosa, escrito à mão com caneta azul, vermelha ou lápis |
| **Carta** | Envelope com lacre de cera; clique no lacre, a aba abre e a carta sai do envelope |
| **Foto** | Foto antiga que se vira para ler o verso e se examina com lupa; detalhes escondidos só aparecem dentro da lente |
| **Objeto** | Objeto sobre um feltro sob luz, com etiqueta; clicar examina de perto e revela um detalhe |
| **Cadeado** | Cadeado de segredo com rodas de números (setas, roda do mouse ou teclado); ao abrir pode ligar um objeto da cena |
| **Mapa** | Mapa da cidade com três X, fichas de anotação, barbante e lupa |
| **Computador** | Terminal de fósforo verde de 1987 com senha, pastas, arquivos e arquivo corrompido |
| **Mesa** | A mesa vista da cadeira, com todos os objetos clicáveis e o botão NÃO APERTE |

### As pistas do Escritório

- **Mesa da secretaria**: telefone de disco (atenda para ouvir a linha), luminária (acende e apaga a luminária da cena de verdade), computador, teclado que levanta e revela o post-it **CEU1987**, ofício sobre o mata-borrão, café ainda quente, três gavetas (a da direita só abre com o molho de chaves) e o **grande botão de emergência NÃO APERTE**. A tampa de acrílico agora tem um **teclado com senha**: clicar nela abre o teclado com a dica (*Meu verdadeiro nome*) e a palavra é **Raimundo** — sem distinguir maiúsculas ou acentos; a senha, a dica e o objeto de cena do estrago são campos da pista, editáveis pelo mestre. Apertar o botão dispara o alarme com giroflex e contagem, corta para a cinemática, e depois **o botão fica apertado para sempre**: a placa passa a dizer APERTARAM., ninguém mais aperta, e o escritório mostra o que fizeram — rachaduras descendo do teto, fuligem, reboco caído com o ripado à mostra, o retrato torto, entulho e papéis no chão (o objeto **Estrago do botão**, que o mestre também pode ligar e desligar sozinho). **Rearmar o botão**, na seção Pistas, desaperta, tranca a tampa de novo e conserta a sala; **Zerar progresso** também faz isso.
- **Cinemática do foguete**: estática de TV; ao entardecer o silo abre e o foguete sobe sobre fumaça iluminada pelo fogo; do alto, ele cruza a curvatura da Terra, desliga o motor e aponta para baixo; sobre uma cidade com a mesma igreja, caixa d’água e cúpula do mapa, um risco cai atrás da cúpula. Clarão, silhuetas, bola de fogo, onda de choque correndo pelo chão, anel de condensação, e a nuvem de cogumelo sobe puxando o caule enquanto o chapéu rola sobre si mesmo e esfria de branco a amarelo, vermelho, marrom e cinza, sob um céu que fica vermelho. VOCÊ FOI AVISADO. Tudo em pixels 2×2 com pontilhado, com som sintetizado; os jogadores veem na tela deles e **Esc** pula (só o mestre).
- **Computador**: liga com boot e bipes; o que se digita durante o boot espera o prompt. Usuário SECRETARIA, senha CEU1987. Pastas INTERDICOES, OBRAS, PESSOAL e LIXEIRA; **NAO_ABRIR.TXT** rasga a tela e termina em “ERRO DE LEITURA NO SETOR 0317”. O botão de energia apaga o tubo na linha que encolhe dos CRTs.
- **Mapa com três X**: clique em cada X para ler a ficha (igreja, caixa d’água, estação). Lidos os três, o **barbante** liga os pontos e o centro do triângulo cai na **Prefeitura**. A lupa acha 03:17 ao lado da estação e “PORÃO” a lápis sob a Prefeitura.
- **Foto da Prefeitura**: inauguração da ala leste em 1987, com faixa, multidão e céu vermelho. **Virar** mostra “o céu estava vermelho naquele dia” e 15 SET 87; a lupa acha um rosto pálido na janela da ala leste e o relógio da fachada às 3h17.
- **Ofício**, **porta do arquivo** (cadeado 0317 que deixa a porta entreaberta na cena), **bilhete na porta**, **envelope lacrado** e **molho de chaves** (quando esses objetos estão ligados), **relógio de parede** parado às 03:17 e **retrato do prefeito**, cujos olhos seguem o cursor.

O computador da mesa foi redesenhado **virado para a cadeira**: da câmera se vê a traseira do monitor de tubo sobre o gabinete, com respiros, etiqueta e cabos, e só um brilho da tela escapa pela borda, iluminando a cadeira. O teclado e o mouse ficaram do lado de quem senta; a luminária e os livros mudaram de lugar, e um pequeno botão vermelho apareceu na beirada da mesa.

### Documentos e anotações

- **Documento para os jogadores**: título, carimbo e texto viram um papel em pixel art sobre a cena, com recolhimento automático opcional; **N** recolhe.
- **Marcadores de entrada** no palco, só na janela do mestre, e **anotações da cena**, livres.

### Cortina e sessão

- **B** fecha a cortina só para os jogadores: tela preta, “A sessão já vai começar”, “Intervalo”, “Fim da sessão” ou mensagem própria. O mestre continua vendo a cena, com um aviso no palco.
- A sessão (cena ao vivo, luz, objetos, prévia, pistas criadas e editadas, pistas encontradas, memória das interfaces, anotações, documento, cortina, a seção aberta e os blocos recolhidos do painel) fica salva neste navegador e sobrevive a recarregar a página. **Exportar sessão** gera um `.json` para outro computador; **Importar** o traz de volta; **Recomeçar** limpa.

| Tecla | Ação |
| --- | --- |
| **M** | abre e fecha o mapa do mestre |
| **1–9** | escolhe a cena da prévia |
| **Shift+1–9** | envia a cena na hora |
| **Ctrl+Enter** | envia a prévia com transição |
| **B** | cortina para os jogadores |
| **N** | recolhe o documento |
| **T** · **L** | tremor · relâmpago |
| **P** | mostra as áreas das pistas |
| **I** · **E** | bolsa da personagem · golpe com o taco na mão |
| **Esc** | fecha a pista aberta · pula a cinemática |
| **F** · **E** | na tela dos jogadores: tela cheia · escala |

### O Escritório: três camadas em uma câmera

O primeiro cenário segue a imagem de referência: parede bege sobre lambri escuro, dois quadros de avisos em volta do brasão, estante, banco sob a janela, chão de tábuas encerado pegando sol e, na frente, a mesa com luminária de banqueiro, monitor e documentos. A sala foi alargada para um mapa fechado de 1680 px, três telas e meia: entrada à esquerda, cabideiro e estante; quadros e brasão no centro; janela, arquivo de gavetas, relógio, bebedouro e a porta do **ARQUIVO** à direita.

- **Parede** (fundo): 573×62 pixels de arte, rola a 0,68 da velocidade do jogador.
- **Chão** (onde a personagem pisa): desenhado **linha por linha**, cada linha na sua profundidade, como o chão de *Street Fighter II*. Tábuas, juntas, tapete, sol e manchas ficam em coordenadas do mundo, então mantêm a perspectiva enquanto a câmera anda. A linha de fator 1 é o chão do jogo (y = 229).
- **Frente**: mesa, cadeira, planta de vaso e espada-de-são-jorge, a 1,17–1,3; passam na frente da personagem.
- **Janela**: céu, prédios e árvores em três planos ainda mais lentos, com nuvens, estrelas e chuva animadas.
- **Paredes laterais**: nas pontas do mapa a sala se fecha em perspectiva (placa de saída, diploma, calendário). A câmera para no fim da sala, a personagem para na parede e o ragdoll também.

Todas as camadas vêm de **um só modelo de câmera**: `x = 240 + (X − câmera) · f` e `y = horizonte + (olho − altura) · f`. Por isso o canto das paredes, a borda do chão e a janela se encontram em qualquer posição. Arte em pixels 2×2, a mesma densidade da personagem, e posições arredondadas.

**Luz pintada, não filtrada.** Cada pixel é pintado como *material + nível* (rampa de 8 tons em OKLab, sombras frias e luzes quentes), e a luz sobe ou desce o pixel na própria rampa, sempre para uma cor da rampa. O sol entra pela janela e desenha no chão e na mesa as vidraças com os caixilhos, calculado como raio de luz; arandelas, luminária, monitor e placa de saída acendem poças com pontilhado só na transição. Nenhuma cor é cinza neutro: a cegueira parcial do jogo detecta pixels cinza. As camadas de cada luz são calculadas uma vez e guardadas; um quadro custa menos de 1 ms.

### Criar uma cena nova

Copie `mestre/cena-modelo.js`, uma sala simples e funcional com comentários, troque `id` e nome e acrescente a tag `<script>` antes de `painel-mestre.js` no `index.html`. Pinte a parede em `(u, v)`, o chão como função de `(X, profundidade)` e as peças da frente. A cena já chega com biblioteca, miniatura, prévia, luzes, transições, pontos de entrada e marcadores. `mestre/ferramentas/previa-cenas.html` renderiza cenas soltas para conferir a arte. Cenas planas também servem: `mestre/cena-campo.js` é o fundo original do jogo, mantido como **Campo de ruínas**.

### Arquivos

| Arquivo | Função |
| --- | --- |
| `mestre/pixel-kit.js` | Rampas OKLab, pincéis de pixel, fonte 5×7 e 3×5 com acentos, luz por rampa |
| `mestre/scene-engine.js` | Biblioteca e palco: câmera, camadas, paredes laterais, cache de luz, transições, efeitos, marcadores |
| `mestre/cena-escritorio.js` | Escritório: paleta, parede, chão, laterais, janela, mesa, luzes, objetos, pontos e entradas |
| `mestre/cena-campo.js` · `mestre/cena-modelo.js` | Fundo original como cena · modelo para novas cenas |
| `mestre/sobreposicoes.js` | Letreiro, cortina, documento e tela de espera |
| `mestre/link.js` | Ligação mestre ↔ jogadores (`postMessage`, `BroadcastChannel`, batimento) |
| `mestre/painel-mestre.js` · `mestre/painel-mestre.css` | Janela do mestre no HUD roxo: topo ao vivo com avisos, coluna de seções com ícones, blocos que recolhem e filtro de pistas |
| `mestre/som-ambiente.js` | Som ambiente por canal, passos por piso, cinco músicas em loop e efeitos das pistas e da cinemática, sintetizados (Web Audio) |
| `mestre/pistas.js` | Sistema de pistas: modelo por cena, âncoras, clique na cena e pela tela dos jogadores, descobertas, conclusões, memória |
| `mestre/pistas-ui.js` | Kit de interface em pixel art: paleta, arte em cache, escrita à mão, lupa, carimbo, assinatura, barra de título |
| `mestre/pistas-tipos.js` | Documento, bilhete, carta, objeto e cadeado |
| `mestre/pista-foto.js` · `mestre/pista-mapa.js` | Foto com verso e lupa (Prefeitura, retrato, casa) · mapa com X, barbante e lupa |
| `mestre/pista-mesa.js` · `mestre/pista-computador.js` | Mesa com botão NÃO APERTE (tampa com senha, botão que fica apertado, estrago na sala) · terminal com senha e arquivos |
| `mestre/cinematica-foguete.js` | Cinemáticas; o foguete e a nuvem de cogumelo |
| `mestre/ferramentas/previa-pistas.html` | Ferramenta de arte: a cena com as pistas clicáveis, sem personagem |
| `jogadores.html` · `mestre/jogadores.js` | Tela dos jogadores |

Integração com o jogo em `app.js`: o fundo vem da cena, a frente é desenhada depois da personagem, do sangue e dos restos, a câmera respeita os limites da sala e as dicas de câmera, a personagem é tingida pela luz, e o quadro pronto segue para os jogadores antes dos marcadores do mestre. Sem os scripts de `mestre/`, o jogo desenha o fundo original, que é o que o teste sem navegador executa.

### Validação

`node tests/cenas.test.js`: geometria da câmera e da sala fechada, cinco luzes × dois climas com camadas sólidas e coloridas, furos só na vidraça, arte determinística, sol no lugar certo, todos os textos desenháveis pela fonte e o modelo de cena.

`node tests/pistas.test.js`: os nove tipos e seus campos, âncoras na parede, na mesa e no chão (e de volta a partir de um retângulo desenhado), a menor pista sob o cursor, personagem na frente de pista de parede, pistas que esperam objeto, cliques dos jogadores (nunca em pista oculta, só quando permitido), quem encontrou, contadores das conclusões, edição, exclusão e restauração, sessão exportada e importada, arquivos e senha do computador e o cadeado.

`node tests/browser-pistas.test.js`: no Chrome, abre pistas clicando na cena sem o painel, lê os três X e usa o barbante e a lupa, os jogadores clicam na foto pela janela deles e ela vai para a bolsa, de onde o mestre a examina para todos e eles a viram, digita a senha durante o boot sem acionar atalhos, abre o arquivo corrompido, levanta o teclado, abre gaveta, erra e acerta a senha da tampa, aperta NÃO APERTE, confere a cinemática na tela dos jogadores e pula, confere o botão apertado e o estrago na sala e o rearma pelo painel, os jogadores digitam 0317 e a porta do arquivo abre na cena, cria uma pista pelo editor marcando a área na cena (que vai para a bolsa) e confere tudo depois de recarregar. `node tests/som.test.js` cobre as chaves de cada som, os passos vindos da marcha e as cinco trilhas com um AudioContext de mentira. Capturas em `pixel_art/generated/pistas/`.

`node tests/browser-painel.test.js`: no Chrome, a página com o nome do RPG e o botão que abre o mapa; as nove seções com ícone e nome, trocadas com as setas; cada controle na sua seção; a janela do mesmo tamanho em todas as seções, com o topo e a coluna parados enquanto só a seção rola (e a janela inteira rolando num celular deitado); o filtro de pistas; blocos recolhidos e a última seção de volta depois de recarregar; e os avisos do topo (pistas, som, cliques dos jogadores, cortina e documento) levando à seção certa. Captura em `pixel_art/generated/painel/`.

`node tests/browser-mestre.test.js`: no Chrome, abre a tela dos jogadores e confere que ela recebe a mesma imagem do mestre. Testa cortina só para os jogadores, documento, olhar para uma pista, as cinco luzes, chuva, objetos, efeitos, teleporte, parede direita e limite da câmera, transições íris e dissolver com letreiro, e sessão restaurada depois de recarregar. Capturas em `pixel_art/generated/mestre/`. Com os testes das pistas, da anatomia das animações, do guarda-roupa, dos gestos de tratamento, dos itens no cenário, do som, da roupa que acompanha o corpo, do Escritório do Jorge, do próprio painel e da exploração são 40 arquivos de teste, todos passando.

### Pesquisa que orientou as decisões

- Prévia e “ao vivo”: ver ou ativar cena no [Foundry VTT](https://foundryvtt.com/article/scenes/) e o [modo estúdio do OBS](https://obsproject.com/forum/threads/obs-studio-mode.193773/).
- Barra de páginas e troca rápida no [Roll20](https://wiki.roll20.net/Page_Toolbar); transições com letreiro inspiradas no módulo [Scene Transitions](https://foundryvtt.com/packages/scene-transitions).
- Pontos com notas escondidas e revelação no [Roll20 Map Pins](https://help.roll20.net/hc/en-us/articles/36271267343639-Map-Pins); documentos na tela comum no [Monk’s Common Display](https://github.com/ironmonk108/monks-common-display).
- Pistas: três caminhos para cada conclusão na [Three Clue Rule, do The Alexandrian](https://thealexandrian.net/wordpress/1118/roleplaying-games/three-clue-rule); tipos de entrada, notas do mestre e “mostrar aos jogadores” no [Monk’s Enhanced Journal](https://github.com/ironmonk108/monks-enhanced-journal) e nos [handouts do Roll20](https://wiki.roll20.net/Handout).
- Evitar caça ao pixel: tecla que mostra os pontos clicáveis nas [opções de Thimbleweed Park](https://blog.thimbleweedpark.com/options_options.html); detalhes para observar e confirmação do progresso em [The Case of the Golden Idol](https://www.gamedeveloper.com/design/case-of-the-golden-idol) e na [confirmação de Return of the Obra Dinn](https://intermittentmechanism.blog/2024/05/21/confirmation-in-the-return-of-obra-dinn/).
- Interface como o próprio objeto (papel, foto, terminal): [interfaces diegéticas](https://www.wayline.io/blog/diegetic-interfaces-game-design) e a [interface de Dead Space](https://www.gamedeveloper.com/design/video-designing-i-dead-space-i-s-immersive-user-interface). Cadeados que dão retorno claro e códigos tirados das pistas: [60out sobre cadeados em escape rooms](https://www.60out.com/blog/escape-room-tips-how-to-handle-locks-keys-in-escape-rooms). Linhas de varredura discretas: [emulação de CRT para pixel art](https://www.gamedeveloper.com/art/opinion-crt-emulation-for-pixel-art).
- Nuvem de cogumelo: bola de fogo, onda de choque, caule puxado pela subida, anel de condensação, vórtice toroidal e resfriamento das cores em [Anatomy of a mushroom cloud, Los Alamos](https://www.lanl.gov/media/publications/national-security-science/1219-anatomy-of-a-mushroom-cloud) e na [Wikipedia](https://en.wikipedia.org/wiki/Mushroom_cloud).
- Mestre vê tudo e jogadores só o permitido, luz por hora do dia e mostrar ou esconder objetos no [Arkenforge para mesa presencial](https://arkenforge.com/in-person-play/); música e ambiente por cena no [Alchemy](https://startplaying.games/blog/posts/alchemy-vtt-what-how-to).
- Chão por rolagem de linhas: [Street Fighter II, row scrolling](https://sf2platinum.wordpress.com/2020/10/15/row-scrolling-for-parallax-effects/). Limites de câmera e dica de câmera: [Scroll Back, de Itay Keren](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers).
- Segundo monitor: [Window Management API](https://developer.chrome.com/docs/capabilities/web-apis/window-management). `file://` é contexto seguro segundo o [MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), e [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) exige mesma origem, por isso a ligação principal usa `postMessage`.
- Sombras com mudança de matiz e pontilhado contido: [Pixnote, sombreamento em pixel art](https://pixnote.net/en/learn/shading/).
- Painel em seções: poucas seções fixas numa coluna com ícone e nome na [navigation rail do Material Design](https://m3.material.io/components/navigation-rail/guidelines); só mostrar o detalhe quando é pedido, em no máximo dois níveis, na [revelação progressiva da NN/g](https://www.nngroup.com/videos/progressive-disclosure/); blocos que recolhem, com vários abertos ao mesmo tempo e um sinal claro de aberto e fechado, em [Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/) e [Accordion Icons](https://www.nngroup.com/articles/accordion-icons/), da NN/g; poucas seções longas pedem abas, muitas curtas pedem blocos que recolhem, em [Tabs vs. Accordions](https://www.nngroup.com/videos/tabs-vs-accordions/).

### O Escritório do Jorge

Uma cena nova na biblioteca do mapa do mestre (a terceira: **3** mostra na prévia, **Shift+3** envia na hora). É o escritório de um escritor comum, só que tomado pela investigação, no clima de *Five Nights at Freddy's* — madrugada, monitor de câmeras, ventilador de mesa, corredor escuro atrás da porta aberta —, sem nenhum animatrônico. O Escritório da Prefeitura e o Campo continuam iguais: a cena do Jorge vive em arquivos próprios, e o `index.html` só ganhou as linhas que carregam esses arquivos.

**Três camadas, como o Escritório.** Na parede: a porta aberta para o corredor de ladrilhos xadrez (com o gravador das câmeras em cima e a lâmpada do fundo que nunca funciona direito), o cartaz do livro, o quadro branco, a estante com as cinco edições, o **mural** no centro com fichas, fotos, mapa e barbante vermelho (legível na própria cena), a janela com persiana, o gaveteiro com a pasta do Kakau em cima, a impressora e o triturador. No chão: tábuas escuras, tapete velho sob a mesa, o cabo das câmeras e as tiras de papel perto do triturador. Na frente: a mesa com o monitor de segurança virado para a sala (mostra a câmera escolhida, ao vivo), o computador de costas com a luz batendo na cadeira, a Bíblia marcada, os envelopes de dinheiro, a secretária eletrônica com relógio, a luminária articulada e o ventilador girando; caixas do livro e uma lixeira nos cantos.

**Luzes:** Fim de tarde (sol pela persiana em listras), Noite (luz do teto, poste da rua pela persiana), **Meia-noite** (a padrão: luminária, monitores e a lâmpada do mural), Só os monitores e Luzes apagadas (05:59; só o monitor das câmeras no nobreak). **Objetos:** luminária, computador, monitor das câmeras, ventilador, luz do mural, recado na secretária, folha na impressora, as três mudanças da CAM 04, porta do corredor, luz do corredor e papel triturado.

#### As pistas

| Pista | O que acontece |
| --- | --- |
| **Edições do livro** (estante) | Cinco edições de *Autobiografia do Jorge — Como eu salvei o mundo*. Abra uma: folha de rosto à esquerda, páginas marcadas com post-its à direita. **COMPARAR** põe duas lado a lado. Na p. 113 a nova impressão diz “Ele ergueu os olhos. O céu estava faminto.”; na p. 214 tem um parágrafo inteiro a mais, com O CÉU TEM FOME, no estilo de Jorge. A caneta dele sublinha a diferença e cola um post-it. |
| **Computador do Jorge** | Desktop com a capa do livro de papel de parede. **PUBLISHER**: os e-mails (e o primeiro, que Jorge mandou). **GRÁFICAS**: a anotação digitalizada com “Está chegando antes.” circulado várias vezes e a lista das três gráficas. **LIVRO**: `MANUSCRITO_FINAL_REAL.docx` e `BACKUP_ANTIGO_2019.docx`, os dois já com a frase; **HISTÓRICO** encontra a frase em todas as versões — nenhuma alteração, nenhum usuário desconhecido. |
| **Mural da investigação** | LIVRO, DINHEIRO, NOVA BÍBLIA e KAKAU ligados a CONHECIMENTO; passar o mouse acende o barbante, clicar lê as anotações. O centro reescreve “NÃO É A FRASE.”, risca, e escreve “É O QUE A FRASE ENSINA.” |
| **Quadro branco** | A linha do tempo (2017, 2019, 2020, 2023, março de 2026 circulado: nova tiragem e Nova Bíblia?) e as listas “o que eu sei” e “o que eu não sei”. |
| **Envelope de notas** | Três notas. A **lupa** mostra símbolos quase invisíveis na segunda; a **câmera do celular** (6×) lê o microtexto da terceira — DENTE RAIZ CÉU CARNE CONHECIMENTO — e acha **EDEN**. |
| **Nova Bíblia** | Os versículos marcados, o do firmamento e dos dentes em destaque. **COMPARAR** traz uma Bíblia comum, onde eles não existem; na margem, “NÃO EXISTE EM NENHUMA TRADUÇÃO.” A aba C é a página de créditos: primeira impressão em março de 2026, “6 meses atrás”, “MESMO MÊS DA NOVA TIRAGEM.” |
| **Pasta: caso Kakau** | Notícia (“Detento apresenta surto após programa de leitura”), ficha da biblioteca da prisão (obra de Jorge) e o livro riscado: na p. 57, circulada e sublinhada, “VOCÊ VAI ENTENDER QUANDO ELE OLHAR PARA BAIXO.” — que Jorge nunca escreveu. Na pasta: “Quem é ‘ele’?” |
| **Gaveteiro** | Quatro gavetas de arquivo; na G–L está a pasta KAKAU (abre a pista), e as outras pastas têm um detalhe cada (a de REVISÕES guarda a prova de 2019 com a frase original). |
| **Monitor das câmeras** | CAM 01 corredor, 02 porta da frente, 03 depósito, 04 sala das caixas de livros, 05 exterior, 06 copiadora. Imagem verde com chiado, varredura lenta, REC, relógio e o mapa do prédio; clique no mapa ou use 1–6 e as setas. |
| **Secretária eletrônica** | Dois recados, com legenda e fita girando. |
| **Triturador de papel** | Seis tiras para remontar trocando de lugar: uma cópia da anotação das gráficas. |
| **Folha na impressora** | Só aparece quando a impressora imprime. Uma página que Jorge conhece — e, olhando um pouco, uma linha nova: “Jorge fechou o arquivo. Olhou para a câmera. Finalmente percebeu que não estava investigando a editora. A editora estava investigando ele.” |

As conclusões (regra das três pistas): *Jorge não escreveu a frase, mas ela é dele* · *A alteração chega antes da gráfica* · *Nova Bíblia e nova tiragem: o mesmo mês* · *O perigo é o que a frase ensina* · *Alguma coisa reage à investigação*.

#### O caso reage

- **Descobertas.** Cada interface registra o que foi realmente visto, com o aviso DESCOBERTA: a frase trocada, o parágrafo novo, um e-mail da Publisher, a anotação das gráficas (ou as tiras remontadas), o manuscrito, o centro do mural, EDEN, o versículo comparado e a frase do Kakau.
- **As câmeras mudam enquanto ninguém olha.** Ler um e-mail da Publisher, consultar a pasta do Kakau e examinar a Nova Bíblia mexem na CAM 04, sempre na mesma ordem, qualquer que seja a pista: primeiro uma caixa aberta, depois um livro no chão, depois o livro aberto. Na primeira vez que a mudança aparece, o sinal rasga.
- **A impressora liga sozinha.** Com **6 descobertas** (campo *Descobertas para a impressora* na pista “Folha na impressora”; 0 faz imprimir logo) e ninguém com uma pista aberta, a câmera vai até a impressora, ela imprime por alguns segundos e a folha fica na bandeja. O mestre pode ligar o objeto *Folha na impressora* à mão.
- **O que Jorge fechou.** A linha nova usa `{objeto}`: é a última coisa fechada antes da impressão (o arquivo, o livro, a Bíblia, a pasta, o envelope…). Apague `{objeto}` no editor para deixar o texto fixo.
- **CAM 07.** Depois de ler a linha nova aparece uma câmera que Jorge nunca instalou: o próprio escritório, ao vivo, com a personagem dentro. O campo *CAM 07* da pista das câmeras escolhe *depois da folha*, *sempre* ou *nunca*.
- **Zerar progresso** desfaz tudo isso: descobertas, CAM 04 e a folha na impressora.

#### Tudo editável

No painel (seção **Pistas → Editar**), cada pista do escritório traz todos os textos que os jogadores leem. Os campos de várias linhas têm um formato simples, explicado no próprio rótulo (por exemplo `NOME | ANO | TIRAGEM`). Um campo vazio tira aquele texto da interface; os avisos DESCOBERTA e os essenciais do livro (título, frases, páginas) voltam ao original. **Restaurar originais** traz tudo de volta.

| Pista | O que se edita |
| --- | --- |
| **Edições do livro** | Título, subtítulo e autor; as edições (nome, ano, tiragem, selo na lombada, marca-d’água e quais têm a frase nova, com `*`); os números e o texto das quatro páginas marcadas, com `{FRASE}` e `{PARAGRAFO}`; as duas frases e o parágrafo; o rodapé da folha de rosto; os post-its do Jorge; a legenda da estante; os avisos DESCOBERTA |
| **Folha na impressora** | Quantas descobertas ligam a impressora, qual página marcada sai e a linha nova, com `{objeto}` |
| **Computador do Jorge** | Nome do computador e usuário; nomes das pastas; e-mails; nomes, datas e tamanhos dos arquivos; anotação digitalizada, arquivo de texto e rascunho da lixeira; datas, versões e linhas do HISTÓRICO, trecho procurado e conclusão; barra de status; texto ao lado do documento; tela sem energia; avisos |
| **Monitor das câmeras** | Nome de cada câmera (CAM 01 a 07), palavras do mapa, tapete da CAM 02, avisos da CAM 07, monitor desligado, nome do sistema, quando a CAM 07 aparece e o adesivo da mesa |
| **Mural da investigação** | Títulos das cinco fichas, frase riscada, resposta, frase do pé, anotações de cada ficha e o aviso |
| **Quadro branco** | Os três títulos, a linha do tempo (um ano repetido fica circulado), a anotação do ano repetido e as duas listas |
| **Envelope de notas** | Valor e série das notas, etiqueta do envelope, microtexto e palavra escondida, o que se diz de cada nota, legenda e avisos |
| **Nova Bíblia** | Nome, cabeçalhos, as duas passagens e as páginas ao lado (versículos inventados com `*`), anotação de Jorge, anotação na Bíblia comum, data e página de créditos, anotações dos créditos e avisos |
| **Pasta: caso Kakau** | Rótulo, jornal, manchete, notícia, cabeçalho e linhas da ficha, carimbos, páginas e textos do livro riscado (a página com `{FRASE}`, a palavra e os rabiscos), post-it, pergunta do Jorge e aviso |
| **Gaveteiro** | As gavetas e as pastas com o que tem dentro; a pasta sem texto abre a pista escolhida |
| **Secretária eletrônica** | Recados e nome no aparelho |
| **Triturador de papel** | O texto das tiras, a legenda e o aviso |

**A sala acompanha.** O cartaz (autor e subtítulo), as fichas do mural, a linha do tempo do quadro branco, o adesivo da mesa e a capa da Bíblia são pintados com os textos das pistas: quando um deles muda, o escritório é repintado na hora. Os botões e as dicas de uso das interfaces (VOLTAR, COMPARAR, “setas viram”…) continuam fixos.

#### Arquivos do Escritório do Jorge

| Arquivo | Função |
| --- | --- |
| `mestre/cena-jorge.js` | A cena: paleta, parede, chão, laterais, janela, mesa, luzes, objetos, entradas, pistas e conclusões |
| `mestre/caso-jorge.js` | O livro (páginas e edições), descobertas, câmeras que reagem, impressora, `{objeto}`, sons novos e o kit de arte das interfaces |
| `mestre/pista-livros.js` | Estante com as edições e a folha impressa |
| `mestre/pista-pc.js` | Computador do Jorge |
| `mestre/pista-cameras.js` | Monitor das câmeras, as seis salas e a CAM 07 |
| `mestre/pista-mural.js` | Mural e quadro branco |
| `mestre/pista-provas.js` | Notas de dinheiro, Nova Bíblia, pasta do Kakau, gaveteiro, secretária eletrônica e triturador |
| `mestre/ferramentas/previa-jorge.html` | Ferramenta de arte: a cena do Jorge com as pistas clicáveis, sem personagem |

`node tests/jorge.test.js`: câmera e sala fechada, cinco luzes × dois climas com camadas sólidas e coloridas, furos só na persiana, arte determinística, pistas em superfícies reais, três pistas por conclusão, os doze tipos novos com campos e textos desenháveis, todos os textos reescritos no editor (interfaces, avisos e as palavras pintadas na sala) e Restaurar originais, páginas diferentes entre as edições, descobertas, CAM 04 na ordem certa, impressora só com a sala livre, Zerar progresso e todas as interfaces desenhadas nos seus estados. `node tests/browser-jorge.test.js`: no Chrome, a cena enviada com Shift+3 sem mexer na primeira cena, colorida em todas as luzes, paredes, mural, edições comparadas, e-mail que muda a CAM 04, jogadores vendo a câmera, impressora sozinha, CAM 07, sessão recarregada, textos mudados no editor do painel chegando às interfaces e à sala (e voltando depois de recarregar) e Zerar progresso. Capturas em `pixel_art/generated/jorge/`.

### Exploração: portas, cenas genéricas e improviso

Entrar numa sala, mexer nas coisas e sair por uma porta, um corredor, uma escada, um elevador ou pela lateral da tela direto para outra cena — e, quando os jogadores forem para onde nada foi preparado, abrir uma cena genérica que combine, ligar e continuar sem quebrar o ritmo.

**Atravessar.** Perto de uma passagem aparece a dica **↑** com o que ela faz (*Entrar*, *Subir*, *Descer*, *Chamar o elevador*, *Seguir*); **↑** ou **W** atravessa. Clicar na porta — também pela janela dos jogadores, se o mestre deixar — leva a personagem até ela. Encostar e empurrar a borda da sala sai pela lateral. A chegada é na passagem de lá, virada para dentro da sala; a cena de destino volta com a luz, o clima e os objetos de quando foi deixada, e a hora e a chuva seguem da cena de onde ela vem. O mesmo **↑** usa objetos: abrir gaveta, examinar, acender a luz, ligar a TV.

**Trancas.** Aberta; trancada (com a mensagem que o mestre escrever); **chave** (o item *Chave* com o mesmo nome, na bolsa, ignorando maiúsculas e acentos); **código** (teclado na tela, que os jogadores digitam pela janela deles, com um bilhete opcional ao lado); ou **só com a liberação do mestre**, que vira um pedido *Quer passar*.

**Elevador.** Uma lista de andares (`RÓTULO | cena | chegada`); o painel mostra os botões e o andar atual; a porta abre com a transição de portas de elevador. O mesmo painel pode valer para todos os andares do prédio. Andar sem cena também vira pedido.

**Pedidos de improviso.** Uma passagem sem destino não abre para os jogadores (*NÃO ABRE*) e aparece para o mestre no topo do mapa e na seção **Exploração**, com miniaturas de sugestões: primeiro pelo nome da passagem (*Banheiro* sugere banheiro, *Estoque* sugere depósito, *Diretoria* sugere escritório), depois pelo lugar onde ela está (numa rua: loja, lanchonete, portaria…). Um clique **cria a cena, liga ida e volta e leva a personagem** — a cena criada é a mesma da miniatura. Também dá para escolher outro modelo, ligar a uma cena que já existe (escolhendo por onde chega) ou deixar como está.

**Biblioteca de improviso.** Dezoito modelos genéricos, sem nada da história, cada um um gerador: a mesma semente dá a mesma sala; outra semente, outras cores, móveis, bagunça e detalhes. **Conectores**: corredor de prédio (residencial, comercial, hospital ou hotel), escadaria e portaria. **Casa**: apartamento, quarto e banheiro (de casa ou público). **Trabalho**: escritório, sala administrativa, depósito e oficina mecânica. **Comércio**: loja de conveniência, lanchonete e bar com fliperama. **Rua**: rua, beco e estacionamento subterrâneo. **Saúde**: enfermaria. **Abandonado**: prédio abandonado. Cada modelo tem pelo menos três coisas para mexer e eventos próprios. **Conjuntos prontos** criam várias cenas já ligadas: *Prédio residencial* (9 cenas, com escada e elevador), *Hospital* (8), *Quarteirão comercial* (7), *Prédio de escritórios* (8, com uma sala sem destino para improvisar) e *Prédio abandonado* (5).

**Peças.** 180 peças em pixel art feitas em código, todas no mesmo kit de medidas (parede de 62 linhas, porta de 30 × 48, luz vinda de cima à direita): portas de oito modelos, vão, escada, elevador e saídas laterais; janelas; luminárias, luz de emergência e placa de saída; e móveis e objetos de sala, quarto, cozinha, escritório, depósito, oficina, loja, restaurante, diversão, hospital, banheiro, rua e estacionamento, em camadas de parede, de chão e da frente. As peças acendem as próprias luzes (lâmpada, tela, vitrine, poste), mudam com o desgaste e trazem estados que viram objetos da cena (porta aberta, TV ligada, energia). Paredes, barras, pisos, vistas e o conjunto de luz (interior, rua, subsolo, hospital, abandonado) completam a sala.

**Coisas para fazer.** Examinar de perto (a peça ampliada, um detalhe escondido e às vezes um item), recipientes (gavetas, armários, geladeira, caixas, caçamba — com itens e tranca de chave ou código), interruptor, **TV** com canais (notícias, chuvisco, desenho, novela, propaganda, mensagem, futebol), **telefone** e orelhão (números com recado, cobrança em moedas, chamada recebida), **computador** com senha, pastas e arquivos corrompidos, **máquina de venda** (produtos e preços editáveis, pagos com as **Moedas** da bolsa, produto que às vezes engancha), **fliperama** com dois jogos jogáveis e recordes, e **quadro de energia**, um puzzle de disjuntores em três dificuldades que devolve a luz da sala.

**Eventos.** Cada cena tem eventos que o mestre liga, edita e dispara: ao entrar, de tempos em tempos (com chance e intervalo) ou só no botão — legenda na tela, som, luzes piscando, queda e volta de energia, tremor, relâmpago, chuva, telefone tocando, TV ligando sozinha, um objeto que muda de estado e escuridão em volta.

### Montar e Exploração no mapa do mestre

**Montar.** A biblioteca mostra as miniaturas dos 18 modelos: **Criar** faz a sala da miniatura, **Outra** sorteia outra variação e **Opções…** escolhe nome, semente, desgaste, luz, largura e as opções do modelo, com prévia grande. Os conjuntos são criados num clique. Cada cena montada tem nome editável, **Prévia**, **Enviar**, **Passagens**, **Duplicar** (as portas da cópia começam sem destino) e **Excluir**. O editor tem:

- **Prancheta**: a cena como os jogadores veem, com o contorno de cada peça (parede, chão e frente em cores diferentes). Clique escolhe; arrastar move (na horizontal e, nas peças de parede soltas, na altura); arrastar o vazio anda pela sala; **← →** movem o escolhido; **Ctrl+Z** e **↶ Desfazer** voltam. A luz da prancheta pode ser outra, só para conferir.
- **Objetos**: a lista filtrável de tudo o que está na cena.
- **Inspetor**: nome, posição, ordem na camada, aparência (cores, modelos, estados ao abrir a cena e, com a cena ao vivo, o estado *agora*) e a interação — o que a peça faz (nada, qualquer interação ou qualquer tipo de pista), marca, nota e todos os campos do tipo (os produtos da máquina, os canais da TV, os arquivos do computador…), com **Testar só pra mim**. Numa porta, **Editar a passagem**.
- **Peças**: o catálogo com miniaturas, por grupo ou pelo nome; um clique põe a peça no meio da prancheta.
- **Sala**: parede, barra, piso e cores, vista das janelas, desgaste, tipo e luz de abertura, largura, energia e luzes, **Variar detalhes** (mesmos objetos, outros detalhes) e **Novo arranjo** (o modelo monta a sala de novo e as portas continuam ligadas pelo papel de cada uma).

**Exploração.** **Pedidos** com sugestões, *Criar*, *Ligar* e *Não abre*; ou *Deixar passar*, *Destrancar de vez* e *Continua trancada*. **Passagens** de qualquer cena — não só a ao vivo: destino e chegada, ida e volta, tranca, chave, código e bilhete, mensagem, transição, letreiro, marca, *aparece com* um objeto e os andares do elevador; *Atravessar*, *Olhar*, *Outro lado*, ativar e excluir. Nas cenas pintadas à mão a passagem nova é marcada arrastando sobre a cena, como uma pista; nas montadas entra uma peça de porta, escada, elevador ou saída. O **mapa de conexões** desenha cada grupo de cenas ligadas como uma árvore (setas nos dois sentidos, elevador tracejado, cadeado nas trancadas, **?** onde há pedido): um clique mostra as passagens da cena, dois cliques a enviam. **Eventos** da cena escolhida com *Disparar* e o registro dos últimos; **Como funciona** liga e desliga os pedidos, a travessia pelos jogadores, a dica ↑, o ↑ nos objetos, a continuidade da hora e os eventos.

Tudo — cenas montadas, ligações, trancas, eventos, preferências e o estado de cada cena visitada — fica na sessão salva no navegador e vai junto no **Exportar sessão**.

### Arquivos da exploração

| Arquivo | Função |
| --- | --- |
| `mestre/montador.js` | Receita (JSON) → cena: casca, luzes por conjunto, geometria das peças, interações e passagens, edição ao vivo, miniaturas, sessão |
| `mestre/montador-paleta.js` | Rampas, variantes de luz, materiais de parede e piso e pincéis comuns das peças |
| `mestre/modulos-estrutura.js` · `modulos-casa.js` · `modulos-trabalho.js` · `modulos-comercio.js` · `modulos-saude.js` · `modulos-rua.js` | As 180 peças |
| `mestre/interacoes-basicas.js` · `mestre/interacoes-jogos.js` | Examinar, recipiente e interruptor · TV, telefone, computador, máquina de venda, fliperama e quadro de energia |
| `mestre/cenas-genericas.js` | Os 18 modelos, os nomes para o improviso e os 5 conjuntos |
| `mestre/exploracao.js` | Passagens, trancas, elevador, chegada, pedidos, sugestões, eventos, estado lembrado das cenas |
| `mestre/painel-exploracao.js` · `mestre/painel-exploracao.css` | Seções **Montar** e **Exploração** do mapa do mestre |
| `mestre/ferramentas/previa-exploracao.html` | Ferramenta de arte: cada modelo em qualquer luz, semente e desgaste, e a vitrine de peças |

`node tests/montador.test.js`: as 180 peças; os 18 modelos iguais com a mesma semente e diferentes com outra, cada um em seis variações com passagens com papel, interações e eventos que existem e portas que não se cobrem; camadas de cinco tipos de luz; os cinco conjuntos com todo destino existindo e voltando, e elevadores válidos; sugestões pelo nome da passagem; a área que anda com a peça, a passagem que vem da receita, sessão e cópia. `node tests/itens-exploracao.test.js`: a ponte com a bolsa (contar, gastar e dar moedas e chaves). `node tests/browser-exploracao.test.js`: no Chrome, a biblioteca e os conjuntos; criar pelo cartão; arrastar uma porta na prancheta, recolorir no inspetor, pôr uma máquina de venda que vende, trocar o piso e desfazer; um prédio de nove cenas no mapa; um pedido vindo dos jogadores com o nome da porta em primeiro, resolvido num clique com ida e volta e travessia; código errado e certo no teclado; o painel do elevador levando a outro andar; um evento disparado com legenda; pedidos desligados deixando a porta fechada; e tudo de volta depois de recarregar.

### Pesquisa da exploração

- Portas ao fundo e a tecla para cima dos side-scrollers 2.5D; apontar e clicar para andar até a porta, das aventuras gráficas.
- Regiões de teleporte com destino, vários destinos à escolha (o elevador) e o laço infinito de duas regiões ligadas (por isso atravessar exige uma ação): [Scene Regions do Foundry VTT](https://foundryvtt.com/article/scene-regions/), [vários destinos](https://github.com/foundryvtt/foundryvtt/issues/12842) e [o laço](https://github.com/foundryvtt/foundryvtt/issues/10887).
- Lugares como nós e passagens como ligações, e prédios como nós que contêm outros: [Node-Based Scenario Design](https://thealexandrian.net/wordpress/7949/roleplaying-games/node-based-scenario-design-part-1-the-plotted-approach) e [Moving Between Nodes](https://thealexandrian.net/wordpress/8171/roleplaying-games/advanced-node-based-design-part-1-moving-between-nodes), do The Alexandrian.
- Kits modulares com medidas comuns para montar muitos cenários com as mesmas peças: [Skyrim’s Modular Approach to Level Design](https://www.gamedeveloper.com/design/skyrim-s-modular-approach-to-level-design) e a [transcrição da palestra de Joel Burgess](http://blog.joelburgess.com/2013/04/skyrims-modular-level-design-gdc-2013.html).
- Improviso com lugares evocativos e “três aspectos fantásticos” em cada um: *Develop Fantastic Locations* no [Lazy GM’s Resource Document, Sly Flourish](https://slyflourish.com/lazy_gm_resource_document.html).
- Consertar a luz como puzzle curto e claro: a tarefa [Fix Lights de Among Us](https://among-us.fandom.com/wiki/Fix_Lights).

## Arquivos principais

| Arquivo | Função |
| --- | --- |
| `pixel_art/generated/character.png` | PNG RGBA transparente 64×96, montagem final |
| `pixel_art/generated/parts/` | 19 PNGs separados, todos na mesma tela de 64×96 |
| `pixel_art/generated/outfits/reference/` | Roupas opcionais, vinculadas aos mesmos ossos |
| `pixel_art/generated/rig.json` | Pivôs, hierarquia, ordem de desenho e dimensões |
| `pixel_art/native_clusters.json` | Documento histórico da referência: segmentos `[y, x_inicial, x_final, índice_da_cor]` em coordenadas nativas |
| `pixel_art/palette.json` | 19 cores: as 16 originais, o meio-tom de pele e dois tons de cabelo |
| `pixel_art/hair.py` | Desenho do cabelo e as suas duas camadas |
| `motion.js` | Física do corpo, a camada de vida e a classe `HairSway` do cabelo |
| `ragdoll.js` | Corpos rígidos articulados, gravidade, inércia angular, limites das juntas, atrito, chão e junta do mouse |
| `pixel_art/tools/render_life.js` | Gera os quadros de `idle_life.gif` |
| `skeleton.js` | Transformações hierárquicas, IK das pernas e rasterizador |
| `app.js` | Cena, controles, gravidade, inspeção e reprodução |
| `jogadores.html` | Tela dos jogadores: só a imagem da cena, cortina e documentos |
| `mestre/scene-engine.js` | Motor de cenas: câmera em perspectiva, três camadas, paredes laterais, luz pré-calculada, transições e efeitos |
| `mestre/cena-escritorio.js` | O Escritório, pintado inteiramente em código |
| `mestre/painel-mestre.js` | Janela do mestre: biblioteca, prévia, ao vivo, mesa, tela e sessão |
| `assets.js` | Pixels dos PNGs embutidos para funcionar até por `file://` |
| `wardrobe.js` | Guarda-roupa: 85 peças (cabelos, barbas, corpo, chapéus, roupas, acessórios), tons de pele, rampas de cor, fios das peças soltas e 25 conjuntos, 14 deles os personagens das imagens |
| `itens-cena.js` | Itens soltos no cenário: física, paredes, clique/carregar/arremessar, golpe no corpo |
| `armas.js` | O taco: empunhado no ombro, golpe com E, alcance do golpe |
| `treatment-motion.js` | O gesto de usar um item: inclinar, agachar, sentar; IK dos dedos com limites; o braço que sobra |
| `pixel_art/tools/audit_treatment.js` / `audit_treatment_sheet.py` | Auditoria dos 207 gestos de tratamento com os ângulos contra os limites |
| `wardrobe-ui.js` / `wardrobe.css` | A janela do guarda-roupa em pixel art, com a personagem viva na prévia |
| `pixel_art/tools/audit_animations.js` / `audit_sheet.py` | Auditoria: renderiza cada clipe e imprime os ângulos das juntas por quadro, com o esqueleto por cima |
| `pixel_art/tools/probe_ragdoll_limits.js` | Arremessa o ragdoll centenas de vezes e mede o ângulo máximo de cada junta |
| `pixel_art/tools/render_showcase.js` / `preview_showcase.py` | GIFs do guarda-roupa, dos clipes corrigidos e dos tons de pele |
| `pixel_art/generated/reference_comparison.png` | Referência e montagem, ambas ampliadas 8× |
| `pixel_art/generated/validation_report.json` | Verificação de formato e igualdade exata |

## Esqueleto

São 20 ossos, incluindo a raiz, e 19 peças. A raiz conduz abdômen e quadril; o abdômen conduz o tórax. O tórax conduz braços e pescoço; o pescoço conduz a cabeça. O cabelo da frente e o de trás são duas camadas, filhas da cabeça, deformadas por linha em vez de por osso. Cada braço conduz antebraço e mão. Cada coxa conduz canela e pé. Camadas de roupa usam o campo `bone` para seguir um osso existente e `slot` para equipar/desativar um grupo.

Os pivôs do JSON estão em coordenadas globais da pose de referência. Em execução, a posição local é a diferença entre o pivô da peça e o pivô do pai. Ângulos são incrementos **em radianos**, positivos no sentido horário. O rasterizador faz a transformação inversa de cada célula de destino para o PNG da peça. Copia somente pixels inteiros de alfa 255; não usa rotação do Canvas, filtros ou antialiasing para a arte.

```js
const rig = new Skeleton2D(CHARACTER_ASSET);
rig.setAnimation('walk', tempoEmSegundos);
rig.pose.head += 0.05;
rig.resolve();
const pixels = rig.rasterize({ facing: 1 });
context.putImageData(new ImageData(pixels, 64, 96), 0, 0);
```

As peças contêm pequenas sobreposições anatômicas ocultas. Os arquivos do rosto e do cabelo são comparados byte a byte com os anteriores; a silhueta do corpo foi refinada conforme a nova solicitação. As antigas regiões de roupa usam a rampa de pele, sem detalhes íntimos. O braço distante, oculto na referência, tem preenchimento reconstruído com a mesma paleta. Durante a animação as peças naturalmente mudam de posição; a preservação exata se aplica aos arquivos do rosto e do cabelo.

## Editar e regenerar

Python 3 com Pillow é necessário apenas para editar/exportar, não para jogar. Os PNGs podem ser abertos em Aseprite, LibreSprite ou Krita, mantendo o tamanho da tela e os pivôs. Depois de editar diretamente os PNGs, execute apenas `bake_assets.py` para atualizar o navegador; executar o gerador novamente substitui os PNGs pela fonte de segmentos.

```powershell
python pixel_art/generate_sprite.py
python pixel_art/preview_sprite.py
python pixel_art/tools/bake_assets.py
node tests/skeleton.test.js
node tests/motion.test.js
node tests/ragdoll.test.js
node tests/recovery.test.js
node tests/drag.test.js
node pixel_art/tools/render_clips.js
node pixel_art/tools/render_life.js
python pixel_art/tools/preview_animation.py
python pixel_art/validate_sprite.py
```

`tools/transcribe_reference.py` recria o documento de segmentos a partir da referência original sem redimensionar. Use apenas ao reconstruir a base: ele substitui alterações em `native_clusters.json`.

Os testes verificam 288 quadros, cores da paleta, alfa binário, comprimento dos ossos, ausência de corte, espelhamento, ocultação de peças, roupas independentes, montagem, silhueta e previews nearest neighbor. Os testes de cabelo conferem o comprimento fixo de cada mecha, os limites da tela, a direção do arrasto na corrida e na queda, o desligamento da física e a reprodutibilidade ao percorrer a linha do tempo. Os testes dos clipes conferem que correr e cair chegam à tela como 15 desenhos distintos, segurados pelo mesmo tempo, sem corte e sem atravessar o chão, e que a corrida só entra acima da velocidade de caminhada. Os GIFs são previews; os PNGs RGBA são os arquivos de produção. `reference_character.png` guarda a montagem vestida exata da etapa anterior; `character.png` é a base final sem roupas.

## Refinamento anatômico

A fonte atual é `pixel_art/refine_anatomy.py`, chamada por `generate_sprite.py`. Pesquisa e decisões: `pixel_art/anatomy_research.md`. A versão anterior está em `pixel_art/history/before_anatomy/`. O gerador usa os arquivos de rosto e cabelo desse histórico para preservar sua identidade.

No inspetor, **Isolar peça** mostra somente a parte escolhida. As duas mãos têm pivôs próprios nos punhos. Pescoço e abdômen também são peças independentes. `generated/joints.json` identifica cada articulação e `generated/articulation_sheet.png` mostra os PNGs com os pivôs marcados. As roupas opcionais foram ajustadas à nova anatomia.

## Refinamento pela referência fornecida

A versão ativa é `anatomyRevision: 5`. `pixel_art/reference_body.py` refina todos os segmentos do corpo a partir de `references/body_reference.png` (cópia da imagem fornecida pelo usuário). O gerador chama esse módulo depois de carregar a estrutura modular. Rosto e cabelo continuam com seus pixels preservados.

O braço próximo voltou a acompanhar a inclinação da referência; tórax, cintura e quadril receberam volumes e sombras locais; coxas, joelhos, panturrilhas, tornozelos e pés foram redesenhados. Partes dos clusters originais de pele exposta foram preservadas nas pernas. Mãos, punhos, cotovelos e demais articulações seguem independentes. A mão distante fica naturalmente escondida pelo corpo no repouso.

Comparação: `generated/body_reference_comparison.png`. Versão anterior: `history/before_reference_refinement/`. As roupas seguem opcionais. Nenhuma alteração no PNG fornecido fora do projeto.


### Pele e iluminação contínuas

A revisão 6 preserva exatamente a silhueta, rosto, cabelo e pivôs aprovados. `pixel_art/skin_lighting.py` pinta planos de luz compartilhados antes de aplicar as máscaras das peças: as junções recebem as mesmas cores em vez de linhas de separação. A paleta tem 17 cores, incluindo um novo tom intermediário de pele. As sombras mais escuras ficam nas sobreposições e nos planos afastados da luz. Sem filtros ou mistura de alpha.

Comparação: `pixel_art/generated/skin_lighting_comparison.png`. A versão anterior está em `pixel_art/history/before_skin_lighting/`. A validação também verifica a preservação das máscaras e a igualdade de cor nos pixels sobrepostos de 10 junções.


## Cabelo refinado e com física

A versão ativa é `anatomyRevision: 7`. `pixel_art/hair.py` é a única fonte do cabelo: um mapa de clusters escrito à mão, em coordenadas da tela de 64×96.

### A unidade cabeça + cabelo

`head`, `hair_back` e `hair_front` carregam o mesmo `anchor`. O rasterizador amostra as três **pela mesma transformação e pelo mesmo pivô**, então é impossível uma escorregar um pixel em relação à outra — era assim que aparecia pele por baixo da franja no salto. Duas regras a mais:

- **O x é preso em pixel inteiro, com histerese.** Andando, a pose coloca a cabeça em x 32,50 — exatamente em cima da fronteira de arredondamento — e um terço de pixel de respiração bastava para jogá-la um pixel para trás e de volta a cada poucos quadros. O pino só sai do pixel que está segurando quando a posição real o deixa com folga. Medido: 0 mudanças em 900 quadros andando, nos dois sentidos; o salto, que inclina o tronco de verdade, continua movendo a cabeça.
- **Inclinação abaixo de 0,18 rad é ignorada.** A animação inclina a cabeça no máximo 2,5°, o que não gira um bitmap: só tira um pixel da ponta de uma linha e não da seguinte, o que partia a mecha da bochecha numa diagonal pontilhada. Acima do limite a inclinação vale um pixel e a unidade gira de verdade, então o inspetor continua funcionando.

### Girar é problema do renderizador

O desenho tem clusters e vãos de um pixel — é assim que pixel art se desenha, e **a arte não se mexe para facilitar a vida da animação**. Só que um bitmap rígido amostrado ponto a ponto não sobrevive a girar muito: a queda rola a cabeça uns oitenta graus, e aí uma mecha de dois pixels vira cacos e um vão de um pixel fecha numa linha e não na seguinte, cercando um pixel transparente. É o mesmo artefato visto dos dois lados.

Então quem se adapta é o rasterizador, e só quando há giro de verdade (acima de `UNIT_SNAP`; abaixo disso a camada não gira e o sprite é a arte, pixel por pixel):

- **amostragem por área**: a célula é testada no centro e nos quatro quartos, primeiro acerto vence. Uma célula que cobre o cluster fica com ele, mesmo que o centro caia entre dois pixels da fonte;
- **buraco de rotação é preenchido**, camada por camada, antes de compor. Um pixel vazio cercado pelos quatro vizinhos *da mesma camada* nunca foi desenhado assim — `hair.py` garante isso num assert de build —, então é artefato de giro. Feito por camada, um vão real entre duas peças diferentes nunca é tocado.

Girada bastante, a mecha da bochecha encosta na massa de onde ela sai. Isso é união, não quebra: o teste exige que o cabelo nunca tenha **mais** peças do que foram desenhadas.

### Duas camadas

| Camada | z | Papel |
| --- | --- | --- |
| `hair_back` | −2 | **O cabelo inteiro**, pintado sólido, atrás do corpo |
| `hair_front` | 19 | Só o que precisa cobrir o rosto: a franja e a mecha da bochecha |

Os 69 pixels de `hair_front` também estão pintados dentro de `hair_back`, por baixo. As duas camadas se sobrepõem por completo em vez de encostarem uma na outra — e é justamente aí que estava o defeito antigo: peças que se encostam abrem uma fresta de um pixel assim que se movem quantidades diferentes. Agora não existe emenda para abrir.

Nada fino e solto pende da massa. Uma mecha de um ou dois pixels sozinha se parte em pontinhos assim que as linhas deslizam uma em relação à outra, então a mecha que caía sobre o braço foi incorporada à massa.

### O desenho

A silhueta continua sendo a da referência — mesma coroa, mesma massa ao vento caindo para a direita do personagem, mesma mecha junto à bochecha. O que mudou foi o acabamento:

- **Massa cheia, não trança.** O cabelo de trás é um volume único: nada de contorno escuro na borda interna e nada de brilho contínuo descendo pelo meio — os dois juntos faziam a massa parecer uma chiquinha. Cada linha vai de claro na face externa a escuro na face virada para o corpo, como na referência, e a massa é mais larga que o PNG original (210 pixels contra 177).
- **Cinco tons no lugar de três.** A paleta ganhou `hair_deep #3a1236` e `hair_light #7e3a85`: `#230521 · #3a1236 · #471e41 · #66296c · #7e3a85`.
- **Brilho em poucos pixels**, na coroa e no alto da massa, em vez de uma faixa contínua.
- **Contorno sem degraus de dois pixels e sem reentrâncias.** Nenhuma linha fica recuada em relação às duas vizinhas: uma reentrância de um pixel vira um buraco piscando no instante em que as linhas se inclinam.
- **Os olhos ficam livres.** A entrada do cabelo recua até x30 na linha 27 e a mecha da bochecha fica em x37; os olhos ocupam x32-33 e x35-36. A versão anterior comia o branco de um olho e a íris do outro. `hair.py` e `validate_sprite.py` falham se qualquer pixel de olho for coberto.

O rosto (`head.png`) continua igual byte a byte ao arquivo aprovado. Comparações: `generated/hair_comparison.png` e `generated/hair_detail.png` (recorte da cabeça em 12×).

### A simulação

O cabelo não é uma corrente de peças rígidas — peças rígidas foi o que produziu as frestas. `HairSway`, em `motion.js`, simula uma mecha verlet presa à cabeça, exatamente como uma corrente de ossos faria, mas entrega o resultado de outro jeito: a curva resolvida vira **um deslocamento horizontal e vertical por linha da tela**, que o rasterizador aplica ao amostrar.

Cada linha desenha então uma cópia inteira e deslocada de uma linha da arte. Nenhum pixel pode ser descartado. Duas garantias fecham o cerco:

- as camadas com curva de balanço são amostradas **sem rotação** — a inclinação da cabeça entra na própria curva, como cisalhamento, que nesses ângulos (no máximo 2,5°) dá a mesma imagem;
- nenhuma linha pode escorregar um pixel inteiro em relação à de cima (`ROW_SLACK`), o que mantém a massa uma peça só.

A pose desenhada é o equilíbrio. Não há gravidade constante: o cabelo já foi desenhado pendendo do jeito certo, e o solver só acrescenta a diferença que o movimento faz — parado e sem vento, o sprite é pixel a pixel a arte original.

As forças, em pixels por segundo ao quadrado: a velocidade e a aceleração horizontais do corpo (com o sinal de `facing`, já que o raster espelha depois), a velocidade vertical, o impacto do pouso e uma brisa ambiente de três senos que nunca fecham no mesmo ciclo. A brisa é o que mantém o cabelo vivo em repouso — e resolve um problema antigo: a respiração sozinha movia o tórax menos de meio pixel, então a pose "Base" ficava congelada no raster. Agora qualquer janela de dois segundos, em qualquer modo, produz pelo menos cinco quadros distintos.

Números do passo fixo de 120 Hz: corrida desloca a ponta cerca de 4,6 px, a brisa em repouso cerca de 1 a 2,4 px.

### O que os testes travam

`tests/motion.test.js` roda os cinco modos, nos dois sentidos, e reprova se em qualquer quadro:

- o cabelo cercar um pixel transparente por todos os lados — é exatamente isso que se vê piscando;
- o cabelo se partir em mais pedaços do que a arte tem (são dois: a massa e a mecha da bochecha);
- a área do cabelo cair mais de 20%;
- uma linha escorregar um pixel inteiro em relação à vizinha;
- a arte sair da tela de 64×96;
- a cabeça se deslocar lateralmente andando ou parada;
- o cabelo cobrir um pixel de olho.

`validate_sprite.py` confere o mesmo do lado do PNG: `hair_back` é o cabelo completo, `hair_front` é subconjunto dele, o contorno não tem reentrâncias e a curva de balanço está declarada no `rig.json`.

Versão anterior do cabelo: `pixel_art/history/before_hair_refinement/`. Prévia animada: `generated/hair_physics.gif` (corrida e salto) e `generated/hair_rest.gif` (brisa em repouso).


## Correr e cair: quinze desenhos cada

As duas animações foram **copiadas quadro a quadro** das folhas de referência em `png/`, e têm exatamente a mesma contagem de quadros que elas. Não são interpoladas: cada desenho é segurado pelo mesmo tempo, como pixel art é animada de verdade. `motion.js` desliga a suavização entre poses enquanto um desses clipes está tocando, e só a usa no instante em que o clipe troca — misturar os quinze desenhos apagaria justamente o que foi copiado.

**A corrida** (`png/Run`) não é uma caminhada rápida: o apoio dura um terço do ciclo, os dois pés saem do chão entre as passadas, o corpo se inclina para a frente e os cotovelos ficam fechados em noventa graus com as mãos dentro da largura do peito. O ciclo segue a distância percorrida, não o relógio — uma passada são 96 px de cena —, então os pés não patinam em nenhuma velocidade.

**A queda** (`png/Dead`) foi medida, não inventada: o ângulo entre o quadril e o peito de cada desenho da folha vai de 10° no primeiro a 85° no último, e essa curva está em `FALL_PITCH`. O giro é dividido entre dobrar na cintura e girar o corpo inteiro: no começo os pés ainda estão no chão e a personagem se dobra sobre eles; quando os pés saem, a raiz assume o giro e as pernas ficam para trás. Os pés que ainda sustentam peso são resolvidos por IK e não saem do lugar — o pé próximo sai no quarto desenho e o distante no sexto, como na referência. A cabeça gira menos que o peito para o rosto continuar legível até o fim.

### A batida no chão

A queda não termina quando a animação termina. O impulso do impacto é **medido**, não escolhido: o clipe são 15 desenhos segurados, então a velocidade do corpo é o que muda de um desenho para o outro, e o quadro em que o chão mata essa velocidade é a aterrissagem. Derivar a pose segurada daria um trem de picos e nada útil, por isso a medida é por desenho.

O que sai dali se espalha, cada parte no seu próprio ritmo:

- as costelas **cedem** contra o chão e voltam — cerca de um pixel, mola dura e bem amortecida, porque mais que isso deixa de parecer carne contra o piso e passa a parecer o piso engolindo;
- o corpo **desliza** e a fricção o para (≈1,7 px), e ele fica onde parou — escorregar para a frente e voltar não é como chão funciona;
- os membros **tremem** em frequências diferentes umas das outras, senão o sprite inteiro balança como um objeto só;
- o **cabelo** leva a maior parte, porque é a coisa mais solta nela: um impulso de verdade (velocidade, não força) na mecha simulada, com peso maior na ponta. Pico de 4,6 px na batida, 0,5 px depois de assentar — deitada de bruços o cabelo está no chão, e brisa não levanta o que o chão segura;
- **a respiração perde o fôlego**: para no meio, volta curta e irregular — o próprio comprimento de cada respiração varia — e só recupera o ritmo ao longo de uns quatro segundos.

Números conferidos: nos 15 desenhos de cada clipe, nada sai da tela e nada atravessa o chão; em 900 quadros de simulação com física do cabelo, os dois clipes mantêm o cabelo inteiro e **0 pixels transparentes cercados**; o impacto dispara exatamente uma vez por queda.

Prévias: `generated/run.gif`, `generated/fall.gif`, `generated/fallcycle.gif` (queda, espera e levantar) e as folhas `generated/run_contact_sheet.png` e `generated/fall_contact_sheet.png`.

## Escolher as cores

Uma fileira de oito amostras redondas, cada uma já pintada com a cor que ela define, com o nome embaixo: **Cabelo, Olho esq., Olho dir., Faixas, Camiseta, Short, Botas, Manto**. Não há nada para ler antes de usar, a fileira dobra em duas linhas no celular em vez de virar um painel, e **escolher a cor de uma roupa veste a roupa** — escolher cor de algo invisível e não ver nada acontecer é o tipo de coisa que faz uma interface parecer quebrada.

**Como o tingimento funciona.** Uma peça não é uma cor, é uma rampa: quatro ou cinco tons que carregam o sombreamento dela, às vezes com um segundo matiz dentro — o forro quente do manto é de outra cor que o manto. Então a cor nova é aplicada como a **diferença** entre a cor escolhida e a base da rampa, em matiz, saturação e luminosidade, e todos os tons se movem por essa mesma diferença. Cada tom mantém o seu lugar no sombreamento e o segundo matiz viaja junto com o primeiro em vez de ser achatado nele. Substituir os tons por uma rampa gerada jogaria fora justamente o sombreamento com que a arte foi desenhada, que é a razão de ela ler.

**Os olhos são um pixel cada**, então são pintados um a um, não por rampa. A cor segue a íris quando o olhar a move para o outro lado da órbita — é o mesmo olho olhando para o outro lado, não outro olho —, e piscar continua fechando os dois. Tudo isso está no teste.

**Nenhuma rampa encosta no corpo.** Era o contrário no começo: o short usava `denim_light`, que é a cor da íris, e as botas usavam o couro e um tom de pele. Tingir o short teria mudado os olhos dela. Agora cada rampa tem os seus próprios tons, e a validação reprova se alguma voltar a dividir um índice com o corpo — a única exceção é o cabelo, que é parte do corpo por desenho.

Junto veio uma regra que faltava: **duas entradas de paleta não podem ter a mesma cor**. Todo PNG aqui é a fonte de verdade dos próprios pixels, e o *baker* volta de pixel para índice comparando a cor; duas entradas com o mesmo hex são a mesma entrada, uma delas vence em silêncio, e uma rampa construída sobre a perdedora nunca pode ser tingida. Foi exatamente o que aconteceu quando as botas pegaram emprestado o couro do rosto: uma bota tingia e a outra não. A validação agora reprova duplicatas.

Restaurar tudo é um clique em **Cores originais**, e o teste confere que devolver a cor devolve a arte pixel por pixel.

## As faixas

Um slot, `wraps`, que enfaixa o corpo do pescoço para baixo — pescoço, tronco, abdômen, quadril, braços, antebraços, coxas e canelas —, deixando livres só as mãos, os pés e a cabeça. Sem esse detalhe a personagem vira múmia; com ele lê como alguém enfaixado.

**Por baixo de tudo.** Cada roupa é pintada sobre a pele do osso em que ela pendura; as faixas também, mas **meio passo mais abaixo** (`z` do osso + 0,25 contra + 0,5 das outras). Então camiseta, short, botas e manto passam por cima delas exatamente como pano passa por cima de um curativo. O teste diz isso de forma exata: **vestir as faixas só pode substituir pele nua** — qualquer pixel que já pertencia a outra roupa tem de sair do composto sem mudar, com a camiseta, com o kit inteiro e com o manto por cima.

**Não é um desenho à parte.** As faixas são geradas a partir da silhueta de cada peça do corpo, então acompanham o membro, terminam onde ele termina e se movem com ele sem rigging nenhum a mais. O que elas acrescentam é o enfaixamento: uma tira dando voltas num membro, vista de lado, é uma sequência de faixas macias separadas pela linha sombreada onde cada volta monta sobre a anterior.

A fase de cada volta é medida nas coordenadas da folha, não a partir da borda esquerda de cada linha — uma tira enrolada no corpo é uma coisa só, então as faixas têm de bater do braço para as costelas para o quadril. Medir a partir de uma borda que muda linha a linha foi o que transformou tudo em camuflagem na primeira tentativa. A inclinação é pequena de propósito: faixas perfeitamente horizontais leem como blusa listrada, e inclinadas demais voltam a virar ruído. Passo de três pixels, uma linha de monta, e uma sujeirinha rara nas voltas que não pegam luz — pano sujo por igual lê como cor suja, pano sujo em pontos lê como pano.

A validação confere que cada pixel de faixa cai dentro da silhueta do próprio membro, que nenhuma delas encosta em mão, pé ou cabeça, e que toda roupa que pendura no mesmo osso tem `z` maior.

## O manto com capuz

Um slot de roupa novo, `cloak`, com duas camadas: `cloak_hood`, soldado à cabeça do mesmo jeito que o cabelo — mesma âncora, mesma transformação, então não tem como escorregar um pixel contra o rosto — e `cloak_body`, que pende do peito e é **simulado**.

**Fica por cima de tudo.** Até aqui toda roupa era desenhada logo atrás do osso em que ela pendura, que é onde as outras devem ficar. O manto carrega um `z` próprio e entra na mesma ordem das peças do corpo, acima da camada mais alta — sem isso o cabelo e a camiseta sairiam por cima dele. Há um teste que, com a personagem em repouso (nada girado, nada balançando), exige que **cada pixel opaco do desenho do manto** chegue intacto ao raster final.

**O que é de dentro fica dentro.** A peça declara o que ela `covers`: a massa de cabelo das costas e os dois braços inteiros. Cabelo comprido vai dentro do capuz e braço vai dentro do manto — sem isso a mão cruza na frente do pano durante a corrida e lê como uma mão solta. A franja continua aparecendo, que é justamente o que se vê de quem está de capuz.

**O capuz encosta no rosto por construção.** A borda interna do capuz não é escrita à mão: é lida do próprio desenho da cabeça na hora do build, linha por linha, e a borda externa abaixo da coroa é essa mesma borda mais a espessura da aba. Nomear as duas à mão foi o que deixou um pixel de luz do dia entre a aba e a bochecha — as duas podiam discordar, e discordaram. Agora não podem. O build reprova se sobrar qualquer buraco que a cabeça não alcance, e o teste procura fundo preso dentro da cabeça e dos ombros em todos os clipes em pé, nos dois sentidos.

**Sombreamento.** A aba tem dois pixels: um para o lado de dentro da abertura, que é o tom mais escuro do sprite e é o que faz o rosto ler como estando *dentro* de um capuz, e um para o fio da aba. Três viravam uma barra preta ao lado da bochecha. A cúpula é uma rampa limpa da borda iluminada até a sombra junto ao rosto, com um brilho concentrado onde a luz de fato bate — oito pixels de largura não são espaço para um vinco também: um vale cortado numa rampa tão curta lê como linha desenhada no pano, não como pano. E o capuz projeta sombra nos ombros logo abaixo dele, com quatro linhas de degradê; sem isso o ombro iluminado da capa passa como uma faixa clara bem debaixo do capuz escuro e os dois leem como dois objetos empilhados em vez de uma peça só.

**Física própria.** O manto tem a sua própria mecha simulada (`cape`), ancorada no tronco, com três elos de rigidez e arrasto próprios: pano pesado demora mais para sair do lugar, balança num arco menor e demora mais para parar. Só isso não bastaria — duas coisas no mesmo vento balançam juntas por mais diferente que sejam armadas —, então o **vento também é separado**: cabelo e manto têm rajadas em períodos deliberadamente sem razão inteira entre si, e sensibilidades diferentes à velocidade, à aceleração e ao peito subindo. Cabelo é leve e pega cada tremida da brisa; manto é pano pesado, ignora a tremida e enfuna com o movimento de quem o veste.

Medido em quatro minutos parada: o manto bate 52 vezes contra 112 do cabelo, e só **15% dos picos** caem no mesmo instante. O teste reprova acima de 50% e também reprova se o manto bater tão rápido quanto o cabelo.

O desenho é construído por regra, não pixel a pixel: silhueta por linha, depois as dobras, depois a luz. Primeiro os planos grandes — o plano iluminado onde o pano encara o céu, o plano médio, o plano escuro onde ele vira para o corpo —, e só então três dobras cortando por cima, cada uma com dois pixels de crista iluminada e dois de vale escuro. Em vinte pixels de largura, cinco vincos de um pixel viram telha ondulada; três dobras com volume viram pano. A barra vira e mostra o forro quente, que é a única coisa ali que pega luz que o lado de fora nunca vê.

## Camada de vida

Nada aqui anima junto. O detalhe que faz um personagem parado parecer gente em vez de boneco balançando não é a quantidade de movimento — é o fato de cada sistema ter o seu próprio relógio. Respiração, peso, piscar, olhar, gestos, inércia e cabelo rodam separados e com períodos que não se encaixam. `tests/motion.test.js` reprova se dois quaisquer deles caírem na mesma batida em mais de metade dos eventos.

| Sistema | Ritmo | O que aparece na tela |
| --- | --- | --- |
| Respiração | 3,7 s parada, 1,45 s correndo | O peito sobe 1 px parado, 2 px correndo |
| Peso | troca a cada 6,3–12,3 s | O quadril se apoia numa perna; os joelhos absorvem |
| Piscar | 2,5–7 s, ~1 em 4 é duplo | Pálpebra em dois estágios |
| Olhar | mouse, ou 1,6–3,3 s sozinho | O pixel azul da íris muda de lado |
| Gestos | 9,4–16,3 s de quietude | Coçar, jogar o cabelo, rolar os ombros, olhar em volta |
| Inércia | molas de 34 e 22 | Peito e braços chegam em tempos diferentes; a roupa vai junto com a parte do corpo em que está |
| Cabelo | física verlet própria | Ver a seção do cabelo |

### Respiração

A curva não é um seno: o ar entra mais rápido do que sai e a pausa fica embaixo. O que se vê é o **canal `chest` subindo um ou dois pixels inteiros** — os ângulos são só decoração, e são pequenos de propósito: girar o tronco balança a cabeça de lado, e uma cabeça que anda mais de um pixel enquanto o personagem caminha é exatamente o que lê como tique. Correndo a respiração acelera e aprofunda; a fadiga sobe mais rápido do que desce, então o fôlego continua pesado um tempo depois que a corrida para, e os ombros trabalham mais que o peito.

### Peso

Parado, o personagem não fica quadrado nos dois pés. O quadril desliza até 0,9 px para um lado, e a cada seis a doze segundos muda de ideia. Os pés ficam plantados e as pernas são resolvidas por IK até eles, então **os joelhos absorvem a diferença** — é isso que faz ler como peso e não como o personagem escorregando.

O IK não reproduz a pose desenhada por conta própria: ele dobra o joelho para o outro lado. Então a plantagem é aplicada como *diferença* em relação ao que o solver devolve para a pose desenhada. Quadril parado ⇒ pernas exatamente como desenhadas; quadril movido ⇒ joelhos dobrados pela diferença.

### Olhos

Um pixel de íris, então há duas respostas: o ponteiro decide enquanto estiver sobre a cena, e quando não está os olhos passeiam sozinhos. Há zona morta para um ponteiro no meio não trocar a íris a cada quadro, e o lado é calculado no espaço do sprite — o raster espelha quando o personagem vira, e sem isso os olhos olhariam para o lado errado.

### Inércia e antecipação

No quadro em que o corpo começa a empurrar, tudo acima do quadril leva um chute para o lado contrário — é a antecipação. Depois cada canal volta no seu tempo: peito e braços, nessa ordem. Medido ao arrancar: peito −1 e braços −1, que voltam a zero nos quadros 80 e 100. A roupa não tem canal próprio (veja abaixo).

As molas são **levemente superamortecidas de propósito**. Um canal que anda em pixel inteiro não tem onde colocar um overshoot: oscilar em cima do limiar de arredondamento não lê como elasticidade, lê como pixel piscando. A elasticidade mora no cabelo, que tem resolução de sobra para ela.

O pulo a partir do chão também se prepara: `pressJump` dá 0,055 s de agachamento antes das pernas empurrarem. Um pulo que já estava no buffer quando o personagem estava no ar dispara direto no contato — esse já foi antecipado.

### Roupa

A roupa **acompanha o corpo o tempo todo**. Cada peça é desenhada com a mesma transformação e o mesmo canal da parte do corpo em que está: quando o peito respira ou fica um pixel para trás ao arrancar, a camisa em cima dele faz o mesmo, no mesmo quadro. Antes as camadas de roupa tinham canais próprios que ficavam um pixel atrasados e se ajustavam ao corpo depois; isso foi retirado. O rasterizador ignora um `drift` que a peça declare para si (`rasterize` em `skeleton.js`), e só o corpo tem canais.

Só balança o que pende solto do corpo — saia, vestido, saia longa, batina, abas do sobretudo, capa e manto, poncho, cachecol, gravata, barba longa, a cauda da mortalha e o cabelo —, sempre a partir de um ponto que segue o corpo. `tests/roupa-acompanha-corpo.test.js` trava isso: peças copiadas de cada parte do corpo continuam em cima dela pixel a pixel ao andar, correr, parar, virar, pular e cair; conjuntos com todo tipo de peça desenham igual a um segundo rig que só conhece o estado do corpo; e nenhuma peça pintada sobre o corpo tem fio de física.

### O que os testes travam

Além do que já era verificado: nenhum sistema pode dormir (todos precisam disparar em quatro minutos); dois sistemas quaisquer não podem cair na mesma batida em mais de metade dos eventos; as piscadas têm que ficar entre 2,5 e 7 s, com espaçamentos variados e pelo menos alguns duplos; a cabeça pode sair da linha ao arrancar mas tem que ficar imóvel em velocidade constante; e desligar a **Vida** tem que devolver o sprite pixel a pixel igual à arte desenhada.

## Saúde e ferimentos

O coração sobre a personagem acompanha a posição dela. Clique nele ou pressione **H** para abrir o painel; **Esc** fecha. O mapa frontal possui 19 regiões selecionáveis (incluindo os dois olhos) e mantém direita/esquerda anatômicas quando o sprite vira. Passe o mouse ou foque uma região para consultar seus ferimentos; clique para fixar a seleção e tratar. Os olhos têm branco lilás, pupila e rótulos D/E próprios.

- **Hematomas:** impactos acima de 65 unidades/s na física do ragdoll. Não provocam sangramento por si só.
- **Cortes:** impactos acima de 145 unidades/s; causam marcas na pele, gotas/manchas no cenário e perda progressiva de sangue.
- **Bandagem:** trata somente a região selecionada, estanca o sangramento e permite que o corte cicatrize lentamente. O jogo continua enquanto o painel está aberto. **Pausar saúde** congela a progressão fisiológica; pausar a animação não interrompe o relógio de saúde.
- **Desmembramento:** impactos extremos acima de 330 unidades/s em extremidades podem separar a peça atingida e seus descendentes. A ligação é removida do ragdoll, as articulações internas do membro continuam funcionando e a peça pode ser arrastada separadamente. A lesão aberta fica na região que permaneceu ligada ao corpo. Cabeça, braços, antebraços, mãos, coxas, canelas e pés podem ser separados.
- **Consequências:** lesões não fatais preservam a vida. A personagem anda mais devagar com lesões nas pernas e não pula com fraturas. Após perder partes das pernas, ou com múltiplas fraturas nas pernas sem tala, permanece em ragdoll ativo e pode se arrastar com A/D ou setas; os membros separados não recebem força dos controles. Decapitação, cérebro destruído e sangue zerado causam morte imediata. Zerar cabeça, pescoço ou tórax inicia falência progressiva, com janela crítica e agonia. Trocar de animação e restaurar a aparência não cura nem recria membros. Não há regeneração de membros; recarregue a página para iniciar outra sessão intacta.

Em **Ferramentas do mestre**, é possível aplicar hematoma, corte ou desmembramento diretamente para experimentar o sistema. Os valores são regras desta simulação, não dados médicos. Há um intervalo de proteção por região para que várias iterações do mesmo contato não multipliquem o dano. Sangue e ferimentos pertencem à sessão local; não há armazenamento entre recarregamentos.

A referência de Project Zomboid é a organização de lesões, sangramento e bandagens por parte do corpo, integrada à condição geral: [BodyPart, documentação oficial](https://projectzomboid.com/modding/zombie/characters/BodyDamage/BodyPart.html) e [BodyDamage, documentação oficial](https://projectzomboid.com/modding/zombie/characters/BodyDamage/BodyDamage.html). Hematomas por impacto, volume de sangue em porcentagem e separação física de membros são decisões deste protótipo; não são uma reprodução de todas as regras do Zomboid.

Validação: `node tests/health.test.js`. O teste de navegador `tests/browser-health.test.js` usa a mesma instalação temporária de Playwright do teste de arrastar e verifica mapa, sangue, curativo, espelhamento, desmembramento, interação com o membro separado, morte e layout móvel. As capturas ficam em `pixel_art/generated/health/`.

### HUD em pixel art, ossos e visão

Arraste o HUD pela faixa superior **ARRASTE AQUI**. O painel permanece onde foi colocado ao fechar/abrir e é limitado à janela; também pode ser movido em passos de 8 pixels com as setas quando o cabeçalho está focado. O ícone de coração continua ligado à personagem.

Cada região tem **100 pontos de vida próprios**. Hematomas, cortes, fraturas e lesões oculares diminuem a vida somente nas regiões afetadas; a condição geral considera a média e o sangue restante. Ossos têm integridade própria. Impactos acima de 215 unidades/s podem fraturar ossos; **Imobilizar osso** aplica uma tala, alivia a limitação de mobilidade e permite recuperação lenta. A bandagem não cura fraturas.

**CORPO / OSSOS — RAIO-X** alterna o mapa em pixel art e a sobreposição dos ossos na cena. Fraturas aparecem em outra cor e com uma interrupção no desenho do osso. **Ferramentas do mestre** inclui os comandos **Quebrar osso** e **Lesionar olho**.

**Olho direito** e **Olho esquerdo** têm vida e lesões independentes. Ao chegar a zero, aquele olho perde a visão; um olho sem visão deixa a metade correspondente da cena cinza (direito → metade direita; esquerdo → metade esquerda), e ambos sem visão deixam a cena inteira cinza. Virar o sprite não troca as metades da tela. A cegueira não mata nem desativa os controles. O HUD permanece colorido para que os estados de saúde continuem legíveis. Olhos destruídos não recuperam visão automaticamente.

### Anatomia alinhada, talas, arrasto e órgãos

O raio-X agora é composto dentro do mesmo raster de cada região, com a mesma transformação da pele. O crânio usa a posição dos olhos do sprite original. Ossos e talas são limitados à máscara de cada peça, acompanhando pose, rotação e espelhamento. Talas de madeira e tiras claras aparecem no membro imobilizado mesmo fora do raio-X. Amputações revelam pequenos segmentos de osso tanto no ponto de separação do corpo quanto na peça separada.

O arrasto usa um ciclo alternado de alcance e apoio das mãos, com o tronco baixo e propulsão durante o contato com o chão. **A/D** escolhe a direção; soltar as teclas interrompe o ciclo. Os membros separados não recebem força dos controles. Agarrar o personagem interrompe os apoios; sem contato da parte conectada com o chão, continua a física de queda.

A aba **ÓRGÃOS** mostra cérebro, coração, pulmões direito/esquerdo, fígado e rins direito/esquerdo, todos com barras independentes de 100 PV. **Ferir órgão** testa dano localizado. **Trauma profundo** também abre a região protetora. O desprendimento exige órgão com até 25 PV e corte de pelo menos 70 na região; no crânio/tórax exige fratura, e no abdômen exige até 60 PV na região. Impactos de pelo menos 280 unidades/s podem provocar o desprendimento quando essas condições são satisfeitas. Um órgão desprendido vira uma peça com gravidade, giro, atrito e contato com o chão; não reaparece no interior do corpo.

O cérebro destruído causa morte imediata. Coração, fígado, ambos os pulmões ou ambos os rins sem função iniciam prazos de sobrevivência; um pulmão ou rim isolado não inicia contagem fatal. Um pulmão funcional limita velocidade a 80% e impede corrida. O sangramento continua independente. São regras de jogo ajustáveis, descritas abaixo.

Testes adicionais: `node tests/anatomy.test.js` e `tests/browser-anatomy.test.js` (Chrome/Playwright). Cobrem máscaras e espelhamento da anatomia, talas e extremidades expostas, ciclo de arrasto sem pernas, barras de órgãos, critérios de desprendimento, queda das peças e danos fatais. Capturas em `pixel_art/generated/anatomy/`.

### Marcha lesionada, infecção e necrose

Uma fratura ou menos de 45 PV em uma região da perna ativa a marcha mancando. O lado mais comprometido apoia por menos tempo, dá um passo mais curto e levanta menos o pé; tronco e braço compensam o peso. A intensidade cresce com o dano, e a tala alivia a limitação. Correr fica bloqueado enquanto manca. Duas pernas incapazes de apoiar levam ao arrasto; duas fraturas na mesma perna ainda permitem usar a outra. O arrasto mantém o ciclo alternado dos braços e sustenta a cabeça olhando na direção do movimento, com pescoço articulado e transição física.

Cada região ligada ao corpo guarda **infecção (0–100%)** e **necrose (0–100%)**. Cortes sem bandagem começam a acumular infecção após 8 segundos de simulação. Uma região com vida zerada acumula imediatamente, mesmo sem corte: 4% por segundo. Ao completar a barra de infecção, a necrose avança 5% por segundo, escurece aquela região gradualmente até cinza escuro e destrói a vida restante. As demais regiões mantêm suas cores; cegueira continua sendo um efeito separado sobre a metade correspondente da cena, ou sobre a cena inteira quando ambos os olhos estão sem visão. Esses tempos são regras de jogo.

O HUD exibe a barra na região com corte, vida zerada, infecção ou necrose. Bandagem precoce protege um corte ainda não infectado; infecção já estabelecida e região com 0 PV precisam de **TRATAR INFECÇÃO**. Esse tratamento reduz a infecção, interrompe a necrose e também cobre um corte aberto. Tecido já necrosado permanece escuro e não recupera vida automaticamente. Uma nova lesão exige novo tratamento. Pausar a simulação congela a progressão.

Validação: `node tests/infection-limp.test.js` e `tests/browser-infection-limp.test.js` (Chrome/Playwright), com capturas em `pixel_art/generated/infection-limp/`. Os testes cobrem progressão real no HUD, tratamento sem regeneração, cor por região, marcha nos dois lados, orientação da cabeça e tela móvel.


## HUD roxo e condução da mesa

Abra `index.html` diretamente no navegador. **H** abre o HUD; **Esc** fecha. O painel usa os ornamentos enviados, molduras roxas, barras segmentadas e símbolos de ferimentos. Na aba **Órgãos**, os sete cartões ficam ao lado do mapa; **Tratar região do órgão** retorna à região correspondente na aba Corpo. As lesões aparecem por hover, foco de teclado ou seleção, sem lista geral extensa.

### Relógio do mestre

- A sessão começa com **SAÚDE PAUSADA**. O botão **Iniciar saúde** fica abaixo da cena e funciona mesmo com o HUD fechado.
- O relógio atualiza sangue, infecção, necrose, cicatrização e prazos fatais. A reprodução da animação tem pausa independente. Colisões e danos diretos ainda podem ferir enquanto a saúde está pausada.
- Ao ocultar a página, a saúde pausa automaticamente; voltar à página não a retoma.
- **Ferramentas do mestre → Suspender piora** congela a fisiologia apenas deste personagem enquanto você resolve socorro especial. Novos danos continuam permitidos; uma lesão de morte imediata continua imediata.
- **Regras do mestre** ajusta segundos de estado crítico e agonia, de 0 a 86400, por causa. Cada episódio guarda os prazos vigentes no início: alterações e restauração dos padrões não modificam contagens existentes.
- `HealthClock` administra uma coleção de personagens; `add(health)` registra outro. Esta interface entrega um personagem. Não há cadastro de cinco jogadores nem persistência: recarregar inicia outra sessão e restaura as regras.

### Sobrevivência e reação

| Causa | Crítico: ainda pode agir | Agonia: até morrer |
| --- | ---: | ---: |
| Coração sem função | 5 s | 15 s |
| Dois pulmões sem função | 15 s | 45 s |
| Fígado sem função | 300 s | 120 s |
| Dois rins sem função | 600 s | 180 s |
| Cabeça, pescoço ou tórax zerado | 5 s | 25 s |
| Cérebro destruído, decapitação, sangue zerado | Morte imediata | — |

Esses valores são balanceamento do RPG. Em estado crítico, velocidade limitada a 60%, sem corrida ou salto, preservando restrições anatômicas maiores. Agonia impede controle voluntário e recuperação automática, com pequenos movimentos visuais sobre o ragdoll. Morte encerra as animações vitais; o corpo ainda pode acomodar-se fisicamente no chão ou ser arrastado pelo mestre. Múltiplas causas usam o próximo colapso/morte mais cedo; novos danos não reiniciam prazos. Bandagens estancam sangue e não restauram órgãos nem ressuscitam.

Reações de dano leve, moderado, grave e devastador duram 0,45 / 0,75 / 1 / 1,3 s, com entrada, breve sustentação e saída suave para o gesto continuar perceptível após clicar no HUD. São poses visuais sobrepostas; não alteram velocidade, colisão, posição física ou controles. Fraturas são graves; amputações e desprendimentos são devastadores. Eventos simultâneos são agrupados pela maior gravidade e danos menores não reiniciam uma reação mais forte. As reações são atualizadas também em ragdoll, sem provocar lesões por si mesmas. Uma amputação reage com o tronco e os membros restantes.

### Organização e validação

- `hud.css`: estilos consolidados e responsivos; `pixel_art/hud/`: ornamentos locais e divisor manual em SVG.
- `anatomy.js`: sprites pequenos e desenhos detalhados dos órgãos, feitos por matrizes de pixels.
- `health.js`: `HealthClock`, `SURVIVAL_RULES`, eventos de dano e episódios fatais. `step(dt)` avança fisiologia; `stepPhysical(dt)` avança somente a proteção contra impactos repetidos. `snapshot()` inclui `vitalState`, `prognosis`, `causes`, `suspended` e `deathCause`; `incapacitated` vale para agonia e morte.
- `motion.js`: `InjuryReaction`, camada visual separada do movimento e da física.

Execute `node tests/survival.test.js`, `node tests/health.test.js`, `node tests/anatomy.test.js` e as regressões existentes de movimento, esqueleto, ragdoll, recuperação, arraste e infecção. Os testes `tests/browser-*.test.js` usam Chrome/Playwright; configure `NODE_PATH` para a instalação de Playwright ou `PLAYWRIGHT_MODULE` para o módulo. `browser-hud-refinement.test.js` abre a página por `file://` e verifica funcionamento offline, relógio, intervenção, morte progressiva, controles, hover/foco, arraste e telas de 390/320 px. Capturas ficam em `pixel_art/generated/hud-purple/`.


### Dor por causa crítica, visão parcial e amputações dos braços

A camada visual de dor tem oito ciclos próprios: coração (mão junto ao peito e contrações duplas), pulmões (tentativas de respirar), fígado (proteção do abdômen), rins (proteção dos flancos), cabeça, pescoço, tórax e fraqueza por sangue abaixo de 25%. A causa fatal com o próximo prazo mais curto determina o ciclo quando há múltiplas lesões. As poses são discretas durante o estado crítico e mais marcadas na agonia; não alteram comandos, velocidade, gravidade, colisões ou contagens. Continuam com o relógio de saúde pausado, respeitam a pausa da animação e encerram na morte. Partes ausentes não recebem gestos. As transformações visuais preservam as conexões das articulações, incluindo cabeça e cabelo.

Os ciclos também aparecem antes da falência: um órgão com 60% de vida ou menos já provoca dor (incluindo o primeiro clique em **Ferir órgão**). Sem causa fatal ou perda extrema de sangue, prevalece o órgão mais lesionado. Cabeça, pescoço, tórax ou abdômen com 50% de vida ou menos, ou fratura sem tala, também podem sustentar um ciclo. Isso é apenas expressão visual: não cria uma contagem fatal nem muda o estado vital. O braço visível assume a pose de proteção mesmo durante a caminhada, sem somar o balanço da caminhada ao gesto.

Perder braços, antebraços ou mãos não força queda nem arrasto. As pernas determinam a capacidade de locomoção; falência vital e lesões nas pernas continuam tendo suas próprias consequências. Os membros separados usam grupos físicos independentes: permanecem no cenário e podem ser arrastados sem derrubar o personagem, sem espelhar junto com ele e sem reaparecer ao mudar de animação ou se levantar. A recuperação ignora membros ausentes como apoio.

A cegueira unilateral usa uma camada visual que ocupa exatamente metade da cena e não intercepta cliques. O HUD continua colorido; dano parcial que não zera o olho não ativa o filtro.

Validação adicional: `node tests/pain-mobility.test.js` verifica os oito ciclos no rasterizador, integridade das articulações e ausência de mudanças na física. `node tests/browser-pain-vision.test.js` verifica as metades cinzas nos pixels renderizados, caminhada/salto/recuperação sem braços e animações de agonia na aplicação. Capturas em `pixel_art/generated/pain-vision/`.

`node tests/browser-hud-reactions.test.js` aplica ferimentos pelos botões do HUD e compara a renderização real com o mesmo quadro sem a camada de dor, mantendo respiração, ferimentos e física idênticos. Verifica os cinco botões de lesão, cinco perfis de dor em órgãos ainda funcionais, duração visível, movimento e pausas. Comparações de pixels e capturas ficam em `pixel_art/generated/hud-reactions/`.
## Revisão anatômica das animações

Cada clipe foi renderizado quadro a quadro com o esqueleto por cima e os ângulos de cada junta impressos como um fisioterapeuta os leria (`pixel_art/tools/audit_animations.js` e `audit_sheet.py`, saída em `generated/audit/`). O que estava errado, e o que foi feito:

- **Passadas alternando curta e longa.** A referência fica de pé com o pé distante cinco pixels à frente do próximo; mantido dentro da caminhada e da corrida, isso dava um passo de 5 px e o seguinte de 15 px — uma manqueira. Os dois pés agora andam na mesma linha; a profundidade da perna distante continua no ângulo que ela faz a partir do próprio quadril.
- **Braços um quarto de ciclo fora de fase.** Os braços chegavam ao extremo na posição de passagem, com as pernas cruzadas, e pendiam no contato. O braço próximo agora está mais para trás no instante em que o calcanhar próximo pousa à frente, e os dois pendem na passagem.
- **Quadril invertido.** O corpo descia sobre a perna de apoio no meio da passada e subia no contato — o contrário do que uma caminhada faz —, o que dobrava o joelho de apoio em 48° a cada meio ciclo e deixava a marcha agachada. Agora o quadril é mais baixo no contato, com as duas pernas abertas, e mais alto passando sobre a perna esticada; na corrida, mais baixo no meio do apoio e mais alto no voo.
- **Pés planos no ar.** As solas ficavam paralelas ao chão o tempo todo, o que dorsiflexionava o tornozelo em 43° na caminhada e 57° na corrida (um tornozelo chega a uns 20–25°). O pé agora tem ciclo próprio: calcanhar toca primeiro, sola plana no apoio, o calcanhar levanta e o pé gira sobre a ponta na saída, e no ar o pé pende do tornozelo seguindo a canela. Na corrida o pouso é na ponta do pé. Um pé que apontasse para baixo ao pousar levanta o tornozelo o quanto for preciso para não furar o chão.
- **Corrida inclinada para trás.** O sinal do tronco estava trocado: `-.13` inclinava a corredora 15° para trás, como quem cruza a linha de chegada. O torso desenhado já pende 8° para trás; caminhar e correr agora inclinam para a frente, e o queixo recolhe para o rosto continuar olhando adiante sem girar a unidade da cabeça (que fica abaixo de `UNIT_SNAP`, senão a franja pisca).
- **Salto sem corpo.** Os joelhos dobravam 36° e nada mais. Agora o salto tem três formas misturadas pela fase (`amount`): subindo as pernas recolhem e os braços sobem com o impulso; no ápice o corpo relaxa; descendo as pernas esticam para o chão, ponta do pé primeiro, e os braços abrem para equilibrar. Antes de pular o corpo junta (quadril baixa, peito à frente, braços atrás) e o pouso absorve para a frente com os braços vindo à frente — não para trás, como estava.
- **Deitada com as pernas no ar.** Os últimos desenhos da queda seguravam as duas pernas horizontais na altura do quadril, a oito pixels do chão, para sempre. Nos quatro últimos desenhos as pernas baixam e deitam no chão, a distante um pouco mais atrás.
- **Levantar era a queda de trás para a frente.** Ela flutuava a 60° com as pernas atrás e nada embaixo. O clipe `levantar` (1,5 s) é um movimento com apoio: as mãos deslizam até embaixo dos ombros e empurram, o peito sobe, o corpo vem de quatro, um pé desce atrás e vem para a frente, os dois pés ficam embaixo dela num agachamento com as mãos ainda no chão, e ela se ergue. Os quadros de contato são resolvidos por IK no próprio rig na primeira vez em que o clipe toca, e um teste garante que nenhum pixel rígido passa do chão em nenhum instante.
- **Limites articulares.** `JOINT_LIMITS` em `skeleton.js` prende cada junta ao que um corpo permite — ombro 172° à frente e 57° atrás, cotovelo e joelho só para um lado (6° e 5° além do reto), quadril 120° à frente e 29° atrás, tornozelo 26° para cima e 52° para baixo, pescoço e coluna assimétricos — e `clampPose()` é a última coisa que a camada de movimento faz, depois de respiração, peso, gestos, dor e pouso. Quando um agachamento fundo exigiria mais dorsiflexão do que o tornozelo tem, o calcanhar levanta (`plantFoot`).
- **Ragdoll dobrando ao contrário.** Os limites do ragdoll eram simétricos: um arremesso levava o ombro a 165° atrás das costas, o quadril a 107° atrás e o joelho e o cotovelo 10–14° ao contrário (medido por `pixel_art/tools/probe_ragdoll_limits.js`, 160 arremessos). Os limites agora são os mesmos do esqueleto; medido de novo, o pior caso fica em 67° no ombro e 33° no quadril, que é o transbordo de um solver iterativo num arremesso forte.
- **Virar.** O sprite espelha num quadro, como pixel art vira, mas por 0,16 s o corpo se inclina na direção nova, o braço próximo cruza e a cabeça vira primeiro. O cabelo faz a parte dele sozinho: o vento que o puxa troca de sinal.

Comparação: `pixel_art/generated/antes_depois_animacoes.png`. Prévia contínua, vestida: `generated/clipes.gif` (andar, virar, correr, saltar, cair, levantar). `tests/anatomia-animacao.test.js` mantém tudo isso: percorre 14 s de cada modo e reprova qualquer junta fora do limite, mede as passadas dos dois pés, a fase dos braços, a altura do quadril, a articulação dos pés, a inclinação, o salto, as pernas no chão, o apoio das mãos e dos pés no levantar e os ângulos do ragdoll em 60 arremessos.

## O gesto de usar um item, região por região

`treatment-motion.js` foi refeito. Antes, o braço era resolvido por IK com o cotovelo dobrando para o lado errado no braço próximo (o sinal do joelho), o alvo era só o meio da região e nada segurava as juntas: para a cabeça, o pescoço, o tórax, o abdômen e os braços o cotovelo ficava virado ao contrário; para a canela e o pé a mão parava a vinte pixels do ferimento; e com um braço faltando o braço distante trabalhava escondido atrás do tronco, então o item parecia flutuar. Uma ferramenta (`pixel_art/tools/audit_treatment.js` + `audit_treatment_sheet.py`) renderiza os 207 gestos — 19 regiões × 3 itens × os dois braços, sem o braço direito, sem o esquerdo, sem a mão direita — e imprime os ângulos das juntas contra os limites do rig; `generated/tratamento_poses.png` é a folha de contato.

Agora o corpo vai até o ferimento como uma pessoa vai: inclina para o peito e a barriga, **agacha** para a coxa (quadril desce oito pixels, os dois pés plantados por `plantFoot`, joelhos à frente) e **senta no chão** para a canela e o pé (quadril no piso, o joelho ferido levantado, a outra perna esticada), com a cabeça olhando o que faz. O braço que trabalha é resolvido por IK **com as pontas dos dedos** no alvo — o antebraço e a mão como uma peça só, o cotovelo sempre dobrando para trás — e depois cada junta é presa ao limite; um alvo perto demais para dedos esticados (o próprio ombro) é alcançado pelo punho, com a mão virando a partir dele. Um braço ferido é segurado à frente do peito (levantado quando o ferimento é no próprio braço, para ficar na frente do corpo) enquanto o outro trata; um remédio vai à boca. Quando falta um braço, o outro faz tudo, e o braço distante é **erguido na ordem de desenho** (`rig.raise`) para passar na frente do tronco em vez de sumir atrás dele. Nada rígido atravessa o chão: a pose é elevada pelo pixel mais baixo, e no meio da transição para o agachamento os pés são replantados. Com o corpo em física (ragdoll, rastejando) só os braços são posados, nas transformações resolvidas, com os mesmos limites.

Validação: `node tests/tratamento-anatomia.test.js` — os 207 gestos em sete instantes cada: nenhuma junta fora do limite, cotovelo nunca para trás, o item sempre numa mão presente, dedos no ferimento (ou na boca), nada abaixo do chão, agachamento para coxa, sentar para canela e pé, braço distante na frente quando é o único, corpo físico intocado.

## Guarda-roupa

Nada aqui é PNG. `wardrobe.js` gera cada peça a partir de regras — quase sempre da silhueta da parte do corpo em que ela pendura, então a peça segue o membro em todos os clipes e em qualquer arremesso do ragdoll de graça — e a pinta como uma rampa de cinco tons que o sistema de tingimento já existente recolore. `Wardrobe.extend(asset)` devolve uma cópia do asset com as peças anexadas como camadas de roupa comuns (`bone`, `slot`, `z`, e quando é o caso `sway`, `drift` e `covers`), as cores novas na paleta e uma rampa por peça; o rig e o rasterizador não sabem a diferença entre uma peça desenhada e uma gerada. As referências: as bases de *paper doll* do Mana Seed e do gerador LPC (uma paleta universal por peça, toda peça deitada sobre os próprios quadros do corpo para qualquer combinação animar) e a ordem de camadas deles — chapéu sobre cabelo, cabelo sobre gola, manga distante atrás do tronco.

**As peças** (85, em dez categorias). As 49 originais: cinco penteados além do original — chanel, rabo de cavalo, coque, curtinho, trança — que copiam pixel a pixel a franja, a têmpora e a mecha da bochecha desenhadas (esse é o rosto dela) e trocam só a massa de trás, na paleta do próprio cabelo, então a cor do cabelo tinge todos; chapéu de aba, boné, gorro, bandana, óculos, coroa de flores, tapa-olho; camiseta, regata, camisa com botões, blusa listrada, suéter de gola alta, moletom com capuz, vestido, top esportivo, armadura de couro, túnica; manto com capuz, jaqueta de couro, colete, sobretudo, capa, poncho; short, calça jeans, calça cargo, calça de moletom, legging, bermuda, saia, saia longa; botas, tênis, sandálias, botas altas, sapatilhas; faixas, cachecol, mochila, cinto, luvas, colar, ombreiras, bolsa a tiracolo. Oito tons de pele (a rampa de cinco tons da própria pele, tingida do meio-tom) e a cor dos olhos.

**As peças novas, para os personagens das imagens enviadas**: cortes masculinos pintados do zero sobre o crânio (raspado com degradê, curto social, mullet com a massa de trás no fio do rabo, cacheado curto, careca), uma categoria de **barba** (rala, cheia, cavanhaque, bigode, longa trançada — com fio de física — todas na paleta do cabelo, então a cor do cabelo tinge a barba), uma categoria de **corpo** (*forte*: ombros, peito e braços mais largos, pintados na rampa da pele, então o tom de pele tinge junto), máscara de borboleta (asas maiores que a cabeça, nervuras, o corpo sobre os olhos), elmo com chifres, óculos escuros (óculos e tapa-olho passaram para os extras, para empilhar com chapéus), scrubs de gola V, macacão de presídio com o remendo, batina com colarinho e faixa, armadura de placas com ombreiras de espigões e a gema, mortalha de fantasma (capuz, corpo, barra que pinga e some, pernas escondidas), paletó aberto no V da camisa, jaqueta militar de botões dourados, jaqueta aberta com gola contrastante, calça social, grevas de placas, gravata (com fio), corrente com cruz, coldre, luvas sem dedos, arnês de tiras, braçadeira, tatuagens, crachá, estetoscópio, cinto de ferramentas, faixa no braço. Catorze conjuntos novos no grupo **Personagens** reproduzem as imagens: Veterano, Taco rosa, Cavaleiro negro, Fantasma, Anão, Borboleta, Chapéu vermelho, Jaqueta verde, Presidiário, Regata azul, Forte, Couro vermelho, Médico e Padre.

**Roupa colada ao corpo, pano solto balançando.** Tudo o que é pintado sobre o corpo — camisas e mangas, calças, a barra das blusas, jaquetas, paletó, macacão, armaduras, luvas e correias — acompanha o osso em que está em todo quadro, pixel a pixel, sem atraso e sem fio de física. Só balança o que pende solto: saia e vestido, saia longa e batina, abas do sobretudo, capa e manto, poncho, cachecol, gravata, barba longa e a cauda da mortalha, cada um num fio preso a um ponto que segue o corpo (`CLOTH` em `wardrobe.js` guarda os fios compartilhados da barba, da gravata e da mortalha; os outros vêm com a peça). Os punhos, as barras, as dobras do cotovelo e do joelho e o vinco das costuras continuam refinados nas peças.

**Física nas peças soltas.** Saia, vestido, saia longa, sobretudo, capa, poncho, cachecol, rabo de cavalo e trança carregam um fio verlet próprio (`strands` na definição da peça), com rigidez, arrasto, dobra e vento próprios, entregue ao rasterizador como deslocamento por linha — o mesmo mecanismo do cabelo e do manto. `HairSway` aceita perfis embutidos e vento por fio, então uma peça nova não precisa mexer em `motion.js`. Um vestido esvazia a categoria das pernas (`excludes`); um penteado esconde as camadas do cabelo desenhado (`covers`); o poncho esconde os braços dentro dele.

**A janela** (`wardrobe-ui.js`) é um painel de 320×248 desenhado a 1× e mostrado ampliado, na tinta roxa do HUD, com as categorias em duas fileiras, três fileiras de ladrilhos com paginação (‹ ›) e os conjuntos em dois grupos (CONJUNTOS e PERSONAGENS): à esquerda a personagem viva — respirando, piscando, com o cabelo e o pano se mexendo — que pode andar no lugar para julgar a física; à direita as categorias, as peças como ladrilhos recortados das próprias peças sobre uma silhueta apagada, uma fileira de cores por peça (mais um seletor livre e "original"), e os conjuntos prontos: Original, Exploradora, Cidade, Inverno, Verão, Noite, Festa, Andarilha, Sobrevivente, Campo e Heroína, mais os catorze personagens. SORTE sorteia. O que foi vestido fica salvo neste navegador; na primeira visita ela começa vestida com o conjunto Original, e a roupa vestida aparece na bolsa como um item (veja *Bolsa de suprimentos*). **G** abre, **Esc** fecha, **Restaurar aparência** despe.

Prévias: `generated/roupas.gif` (os 25 conjuntos parados, andando e correndo), `generated/roupas_contact_sheet.png`, `generated/peles.gif` (tons de pele e penteados). Validação: `node tests/guarda-roupa.test.js` (cada peça renderiza e deixa o corpo em paz, os penteados mantêm a franja pixel a pixel, tingir e destingir é exato, tom de pele não toca as roupas, vestido exclui pernas, conjuntos válidos, peças em todos os clipes e num arremesso, saia, cachecol e rabo balançam e assentam; camisa e jeans sem fio, gravata e barba longa com fio), `node tests/roupa-acompanha-corpo.test.js` (a roupa segue o corpo pixel a pixel em todo quadro) e `node tests/browser-wardrobe.test.js` (Chrome: abre em G, conjunto veste, vestido tira a calça, tinge e destinge, cabelo, pele, olhos, extras um a um, prévia andando com física, Esc, vestida na corrida, lembrada ao recarregar, sorteio e limpar; capturas em `pixel_art/generated/wardrobe/`).

"# O-Ceu-tem-fome." 
