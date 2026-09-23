# O Céu tem Fome — RPG de mesa

Abra **index.html** diretamente no navegador. Não há instalação, dependências JavaScript, build ou conexão externa. É a mesa digital do RPG: o mestre monta os cenários com luz, clima e som, esconde pistas na própria cena e cuida do personagem (saúde, bolsa e roupas), e os jogadores acompanham numa tela só deles (`jogadores.html`).

### Combate tático na própria cena

O botão **MODO TÁTICO**, acima da cena, abre a preparação. A interface da luta é desenhada diretamente no render de 480×270: retratos e iniciativa no alto, recursos individuais e dez ícones de golpes na base. **MIRA** abre a silhueta anatômica sobre a cena, com seleção ampliada dos olhos; **Esc** fecha a mira. Escolha **Iniciar batalha** no próprio HUD. **MESTRE** abre os controles de pausa, turno, desfazer e encerramento; **AJUSTAR MESA** abre o editor avançado de participantes, lados, iniciativas e terreno. A grade usa o piso em perspectiva; o tamanho inicial é 48 unidades. O pincel permite bloquear, liberar, marcar terreno difícil ou terra e reposicionar o alvo selecionado. Durante os turnos, pause para editar o terreno. NPCs têm controle do mestre e IA desligada; o temporizador também começa desligado.

- **Movimento:** 6 + MÁQUINA por turno, ajustado pelos ferimentos. Clique no destino para revisar o caminho, custo e oportunidades; clique novamente para confirmar. Passos diagonais custam 2, ortogonais 1 e terreno difícil dobra o custo. Ocupantes e quinas bloqueadas impedem passagem.
- **Câmera:** acompanha o personagem do turno, inclusive durante o deslocamento. Para olhar o cenário livremente, use **A/D**, **←/→**, a roda do mouse ou arraste com o botão direito, central ou **Shift + botão esquerdo**. **C** ou **FOCAR [C]** retoma o acompanhamento. Um novo turno volta a enquadrar seu participante. Os mesmos controles estão disponíveis na janela dos jogadores; as duas janelas compartilham o enquadramento da mesa. Olhar o cenário não consome PA nem movimento.
- **Ações:** cada personagem recebe seus próprios 4 + SENSO PA por turno, conforme a ficha dele. PA, movimento e reação são individuais; o HUD distingue os recursos de quem está no **TURNO** e os do **ALVO**. Selecione o alvo na cena ou na fila, escolha um dos dez golpes e a região na silhueta, confira a chance e confirme. Selecionar alguém escolhe o alvo; quem ataca continua sendo o participante do turno. Repetir o mesmo golpe aumenta a dificuldade em 2. Levantar, limpar olhos, desengajar e defender custam 2 PA.
- **Reações:** sair de uma célula adjacente a um hostil interrompe o caminho antes do passo. O controlador escolhe atacar ou deixar passar. Atacar consome a reação da rodada; recusar a conserva. Desengajar evita oportunidades até encerrar o turno.
- **Dado:** ataques, oportunidades e testes de Fortitude mostram o mesmo d20 animado da ficha acima do personagem que rolou. O dado apresenta o resultado já resolvido, sem refazer rolagens nem aplicar dano novamente. Pausa e câmera também afetam a apresentação. Movimento e ações auxiliares não exigem d20.
- **Mestre:** pode pular turnos, incluir ou retirar participantes, editar iniciativa, habilitar IA individualmente, corrigir recursos, condições, posições e resultados. Quem entra durante a luta recebe turno somente na próxima rodada. **Desfazer ação** restaura os recursos, ferimentos, posições e decisões envolvidos e pausa o encontro.
- **Janela dos jogadores:** recebe a cena e um HUD próprio. Pode agir pelo participante com controle Jogador no turno ou reação correspondente. A janela do mestre valida cada comando; NPCs ocultos são filtrados do estado enviado.
- **Tempo e sessão:** cada rodada completa entrega 6 segundos aos sistemas habilitados. O botão de pausa do relógio de saúde continua valendo. Pensar, animar ou escolher reações não avança a saúde. O temporizador opcional começa em 60 segundos e pausa durante ações, reações e desconexão. Reabrir uma sessão restaura a batalha pausada, sem repetir rolagens ou dano.

Na exploração, **WASD/setas** caminham também em profundidade, **Espaço** pula, **E** interage e **J** aciona a arma livre. Caminhar em profundidade reaproveita a animação lateral. Encerrar a batalha conserva posições e ferimentos; quem terminou caído permanece caído e pode usar **V** para levantar se tiver condições físicas.

As regras estão em `mestre/tatico-regras.js` (`TACTICAL_RULES`, `TACTICAL_ACTIONS`); terreno, animações, HUD, integração e IA ficam em arquivos `tatico-*` separados. A batalha usa a saúde regional existente. Os valores de dano e duração são iniciais de teste: as simulações de IA ajudam a detectar travamentos, mas ainda é necessário testar o equilíbrio em mesa, especialmente atributos altos e condições. Cenas sem metadados de obstáculos exigem revisão do mestre na preparação; o sistema não deduz colisões pela pintura.

Verificações: `node tests/tatico.test.js`, `node tests/tatico-motion.test.js` e `node tests/tatico-balance.test.js`. Os testes `browser-tatico*.test.js` usam Playwright com Chrome instalado; `PLAYWRIGHT_MODULE` pode indicar o módulo instalado fora do projeto. `browser-tatico-hud.test.js` verifica os cliques reais no render das duas janelas, mira, reação, pausa e movimento projetado; `browser-tatico-dado.test.js` verifica resultados únicos e integração com saúde. Capturas ficam em `pixel_art/generated/tatico/`. A direção de arte e suas referências estão em [mestre/tatico-arte.md](mestre/tatico-arte.md).

A página abre com o nome do RPG, a cena e um cartão **Na mesa** com os atalhos do personagem e do mestre. O personagem nasceu como protótipo de anatomia e movimento; as ferramentas daquela fase (inspeção do rig, ficha do sprite, links do cabelo) saíram da página, e o histórico continua abaixo.

A base atual refina **a anatomia, a pose e o cabelo**, preservando os arquivos do rosto. O cabelo foi redesenhado a partir da referência e é simulado em tempo real. Roupa e botas foram removidas da pintura do corpo e exportadas como camadas opcionais. O PNG original tem 26×56 pixels; o arquivo entregue tem uma tela transparente de 64×96, com o desenho em `(19,20)`. Não houve ampliação, redução ou interpolação da fonte. Os previews usam apenas nearest neighbor. As primeiras interpretações estão guardadas somente como histórico.

### O elenco vivo e as ferramentas do mestre

Cada ficha da mesa é uma pessoa com corpo — e agora esse corpo **corre sozinho**, esteja quem estiver sendo controlado. Até aqui, sair do controle de alguém era congelá-lo no tempo: a fome parava, a ferida parava de infeccionar, o sangue parava de escorrer. Agora só o desenho é que é barato; a simulação é a mesma de todo mundo.

- **Os sistemas, ligados por padrão.** Saúde (ferimentos, infecção, sangue, morte), fome e sede, e física. A saúde de todos corre no **mesmo relógio do mestre** — de propósito: *SAÚDE PAUSADA* tem de parar a mesa inteira, e não só quem está no corpo do jogo. A fome corre com as **regras da mesa**; só as duas barras e as condições são de cada pessoa.
- **Desligar o que não interessa.** Cada um dos três liga e desliga para a mesa inteira (seção **Ferramentas**) ou para uma pessoa de cada vez (os três selos na linha dela, na seção **Elenco**). O selo de uma pessoa tem três estados: ligado, desligado e *segue a mesa* — para o mestre poder mudar o padrão depois sem desfazer o que decidiu caso a caso.
- **O cadáver cai.** Quem morre fora do controle desaba onde está, em ragdoll, e a pose fica guardada: trocar de cena, assumir outra pessoa ou recarregar a página não levanta ninguém do chão. Quem sai do corpo do jogo caído — porque morreu, desmaiou ou o mestre o derrubou — continua caído na mesma pose e no mesmo lugar.
- **O ragdoll é de todos.** Arraste qualquer pessoa da cena e você pega o corpo dela com física, no mesmo gesto do personagem controlado. Um corpo parado no chão **dorme** e passa a custar nada até alguém encostar nele.
- **Arrastar não machuca.** O dano do arremesso nasce **desligado**: encenar não pode abrir uma fratura sem querer. Ligue em *Ferramentas* quando a queda for do jogo, e não sua.
- **O pedaço decepado não muda de dono.** Um membro separado passa a ter esqueleto próprio, tingido uma vez com a pele, a roupa e as feridas de quem o perdeu. Antes ele era redesenhado com o rig do jogo, e bastava assumir outra pessoa para o braço de alguém trocar de cor.

#### A mão, a seleção e o desfazer

O gesto do mouse na cena é o de qualquer editor, e só o primeiro movimento decide o que ele é:

| Gesto | O que faz |
| --- | --- |
| Clique numa pessoa | escolhe ela (e só ela) |
| **Shift**+clique | soma e tira da seleção |
| **Shift**+arrastar no vazio | a caixa de seleção; pega quem ela encostar |
| Arrastar quem **não** está selecionado | pega o corpo dele com física (ou desliza, com a ferramenta *Posicionar*) |
| Arrastar quem **está** selecionado | leva o grupo inteiro, guardando as distâncias |
| **Alt**+arrastar | duplica a pessoa e já sai arrastando a cópia |
| Botão direito | o menu dela, com tudo isto para uma pessoa só |

Teclas: <kbd>Q</kbd> derrubar · <kbd>V</kbd> levantar · <kbd>X</kbd> congelar no lugar · <kbd>O</kbd> ocultar dos jogadores · <kbd>Del</kbd> tirar de cena · <kbd>Esc</kbd> limpar a seleção · <kbd>Ctrl</kbd>+<kbd>A</kbd> escolher todos em cena · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicar · <kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd> empurrar (com <kbd>Shift</kbd>, a passo largo) · <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfazer.

A seção **Ferramentas** do mapa do mestre reúne os três sistemas, a mão do mouse, o dano do arremesso e as ações em massa sobre a seleção — derrubar, levantar, congelar, travar, esconder, virar, trazer, duplicar, curar por inteiro, entrar e sair de cena, espalhar em fila, ir até e tirar de cena. **Travar** faz o clique atravessar a pessoa, para pegar quem está atrás. **Esconder** tira a pessoa do quadro dos jogadores sem tirá-la da cena: ela continua agindo, e o mestre a encontra por um contorno tracejado que só ele vê. **Desfazer** guarda os últimos 24 gestos do mestre — mover, tirar de cena, derrubar, duplicar, excluir — e devolve inclusive a ficha apagada.

#### SUBSTÂNCIA no osso e na cura

O vigor da ficha já dizia quanto cada região de carne aguenta. Agora ele faz mais duas coisas, pelo mesmo caminho (`health.definirVigor`):

- **O osso tem vida, e o vigor a aumenta.** Cada região guarda `boneHp` e `maxBoneHp`; um osso com o dobro de vida resiste ao dobro de pancada antes de fraturar, e a consolidação fecha no teto **dele** — comparar com um 100 fixo deixava o osso grande fraturado para sempre.
- **A regeneração natural é mais rápida.** O ritmo da cura passa a ter três fatores: a taxa de sempre, o metabolismo (fome e sede) e o vigor. A cura também sobe até o teto do vigor, e não até um 100 fixo. Em SBT 1 — o personagem padrão — tudo dá exatamente o que sempre deu.

Enquanto um corpo cai, o desenho fica até 1/30 s atrás da física — é o que faz quatro corpos caírem juntos sem derrubar o quadro. O quadro pronto carrega a **moldura dele** junto: posicioná-lo pelo recorte recém-medido fazia `putImageData` recusar o dado nos quadros em que os tamanhos não batiam, e o personagem sumia da tela por um quadro. Era isso que fazia o sprite piscar durante o arrasto, num quarto dos quadros.

Validação: `node tests/elenco.test.js` (bastidores, ligar e desligar, morte fora do controle, cadáver que viaja na troca, pegar o corpo com o mouse, dano opcional, seleção, grupo, desfazer e sessão), `node tests/health.test.js` (o vigor no osso e na regeneração), `node tests/ragdoll.test.js` (o pedaço decepado guarda a aparência de quem o perdeu) e `node tests/browser-ferramentas.test.js` (tudo isso no Chrome, com capturas em `pixel_art/generated/ferramentas/`).

### IA do trânsito da estrada

O carro do jogador tem prioridade: os NPCs mantêm maior distância, antecipam movimentos manuais e cancelam mudanças que fechariam sua passagem. Quando ele chega rápido por trás, procuram uma faixa livre; em risco de colisão, podem ceder pelo acostamento da própria mão, retornando quando houver espaço seguro. Na aproximação frontal, freiam e procuram uma saída livre. A prioridade muda as decisões, preservando as dimensões reais de contato e os danos. `node tests/transito-prioridade.test.js` verifica essas situações, inclusive saídas ocupadas e retorno após a passagem.

Os motoristas antecipam filas olhando além do líder imediato e comparam o fluxo da faixa vizinha antes de ultrapassar. Quem está sendo ultrapassado mantém o ritmo, e quem recebe um pedido de retorno pode reduzir suavemente para abrir espaço, com limite de duração. A IA acompanha o progresso da ultrapassagem e volta à direita se perder a vantagem ou se o líder mudar para a mesma faixa. O piloto automático compartilha suas intenções com o trânsito; o comando manual continua livre. Essas situações são verificadas por `node tests/transito-cooperacao.test.js`.

O trânsito usa `mestre/transito-estrada.js`, independente do desenho e sem dependências externas. Cada veículo percebe o líder mais próximo no próprio sentido, pontos cegos e aproximações por trás; freia até parar, acompanha filas e retoma gradualmente. Chuva, neblina, curvas e danos reduzem o ritmo. Os perfis cauteloso, comum e apressado são sorteados uma única vez (25%, 60%, 15%) com semente reproduzível.

Mudanças de faixa têm sinalização prévia e reserva do espaço previsto. Na mão dupla, a ultrapassagem depende da visibilidade, do tráfego contrário e do espaço para retornar; termina pela posição relativa ao veículo ultrapassado. Curvas fortes, cristas e zonas de cruzamento impedem iniciá-la. O acostamento serve a emergências. Veículos incapacitados permanecem como obstáculos com pisca-alerta. Colisões usam o movimento entre passos, com dano e separação longitudinal, sem empurrar preventivamente um carro para outra faixa.

A simulação avança a 60 passos por segundo, com decisões normais a 10 Hz e frenagem de emergência em cada passo. O controlador conserva `criar/draw/relatorio` e oferece `atualizar(dt)` para simular sem desenhar. `ctl.transito[i].ia` expõe perfil, estado, motivo e manobra; `ctl.trafego` expõe percepção e distância circular. O piloto automático usa os mesmos critérios de percepção e espaço. Semáforos e novas regras de cruzamentos não fazem parte desta alteração.

Validação: `node tests/transito-simulacao.test.js` (filas, retomada, dois sentidos, emenda, jogador parado, ponto cego, ultrapassagem, aborto, disputa de faixa, cortes, contato contínuo, chuva e 30/60/120 FPS) e `node tests/sinalizacao-transito.test.js` (setas de ambos os lados, alerta, freios e cache dos carros e motos). A variável opcional `TRANSITO_PREVIA` indica o caminho de uma prancha PNG para inspeção da sinalização. As regressões do minigame, acelerador, veículos, arte, pane e percurso continuam aplicáveis.

## Usar

- **Base**: corpo sem roupas, com contorno e cabelo da referência.
- **Roupas opcionais**: faixas, camiseta, short, botas e **manto com capuz** como camadas sobrepostas, desativadas inicialmente. Dois slots são especiais: o **manto** fica por cima de qualquer outra roupa e tem física própria; as **faixas** ficam por baixo de todas elas.
- **Respirar**, **Andar**, **Correr**, **Cair**, **Pular**: demonstrações de animação esquelética. Correr e cair têm **15 quadros cada**, um por desenho das folhas `png/Run (1..15)` e `png/Dead (1..15)`.
- **Vida**, **Física do cabelo** e **Brisa**: ligam a camada de vida, a simulação do cabelo e o vento ambiente.
- Passe o mouse pela cena: os olhos acompanham o ponteiro.
- **Guarda-roupa** (**G** ou o botão ROUPAS na cena): cabelos, chapéus, blusas, casacos, calças, saias, calçados, acessórios, tons de pele e cor dos olhos, tudo desenhado por código sobre os mesmos ossos do corpo, com cor própria, conjuntos prontos e física nas peças soltas. Detalhes em [Guarda-roupa](#guarda-roupa).
- **Ragdoll**: segure o botão esquerdo sobre o personagem e arraste. O ponto segurado acompanha o mouse; o corpo gira com gravidade e inércia e colide com o chão. Ao soltar, ele mantém o impulso. A recuperação parte da postura física atual: de bruços, busca apoio; de costas, senta e recolhe as pernas; invertido, primeiro se desvira; agachado, firma os pés e sobe. Se já estiver em pé, faz só um ajuste de equilíbrio. Os pés ficam plantados durante a subida, e a posição da queda é preservada. Enquanto estiver no ar ou segurado, continua em ragdoll. É possível pegá-lo novamente durante a recuperação. Funciona nas duas direções e com zoom da página.
- **Ficha da mesa** (**C**, ou o botão na lateral): cinco atributos em cartas de tarô, 28 perícias, vitalidade ligada ao corpo em barra de casulos — um casulo é um ponto —, vela de sanidade e d20 animado — e o HUD some enquanto ela está aberta. Tem **página separada** (`ficha.html`) para mandar aos jogadores. Detalhes em [Ficha da mesa](#ficha-da-mesa).
- **Mapa do mestre** (**M**): o cenário é uma cena que o mestre troca ao vivo para os jogadores, com prévia, transições, luz, clima, objetos, efeitos, documentos e uma janela limpa para TV, projetor ou Discord. O cenário inicial é o **Escritório**, em três camadas. Detalhes em [Mapa do mestre](#mapa-do-mestre).
- **Elenco e ferramentas do mestre**: cada ficha é uma pessoa com corpo próprio, e o corpo dela corre sozinho — saúde, fome e física — esteja você controlando-a ou não. Arraste qualquer pessoa da cena para pegar o corpo dela com física; clique para escolhê-la, **Shift**+clique para somar, **Shift**+arrastar no vazio para a caixa de seleção, **Alt**+arrastar para duplicar. Detalhes em [O elenco vivo e as ferramentas do mestre](#o-elenco-vivo-e-as-ferramentas-do-mestre).
- **Escritório do Jorge**: terceira cena do mapa do mestre (**Shift+3**), inspirada em *Five Nights at Freddy's* sem animatrônicos — mural da investigação, edições do livro, computador, câmeras que reagem à investigação e uma impressora que liga sozinha. Detalhes em [O Escritório do Jorge](#o-escritório-do-jorge).
- **Jogar**: A/D ou setas movem, Espaço pula, **Shift** corre e **F** derruba o personagem. A corrida entra acima de 96 px/s. Após a queda, o personagem se levanta onde caiu com o clipe **levantar**: apoia as mãos, sobe o peito, põe um pé à frente, agacha e fica de pé. Virar de lado inclina o corpo na direção nova por alguns quadros.
- **O personagem não tem gênero.** Ele é uma **base** para o jogador de RPG de mesa montar o personagem dele — rosto, corpo, cabelo, roupa e cor são escolha de quem joga. Por isso os textos do jogo nunca decidem isso por ele: onde precisa de um nome, é **“o personagem”** (o termo de mesa, que serve para qualquer ficha); onde precisa de um estado, é **substantivo** (*Fome forte*, *Desidratação*, *Com ferimentos*), porque substantivo não combina com gênero nenhum; e os conjuntos do guarda-roupa têm nome de tema (*Expedição*, *Estrada*, *Batalha*), não de pessoa.
- **Esqueleto**: mostra articulações e hierarquia.
- **Cores**: uma fileira de amostras — cabelo, cada olho, faixas, camiseta, short, botas e manto. Cada amostra já é a cor que ela define, então a fileira também é a leitura do que o personagem está vestindo; escolher a cor de uma roupa veste a roupa.
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
- **Blocos que recolhem**: cada título (▾) fecha o seu bloco, vários podem ficar abertos, e o painel lembra quais estavam recolhidos e qual seção estava aberta, mesmo depois de recarregar. *Como o personagem usa* e *Atalhos* começam recolhidos.
- **Filtro de pistas**: digitar em *Filtrar pistas* mostra só as que têm aquilo no nome, no tipo ou na nota (sem ligar para acentos). As notas do mestre aparecem em duas linhas; um clique mostra a nota inteira.
- **Teclado**: com o foco na coluna, **↑ ↓** trocam de seção. Em tela muito baixa (celular deitado), a janela inteira rola e a coluna fica presa no topo.

| Seção | O que tem |
| --- | --- |
| **Cenas** | Biblioteca, prévia só do mestre, luz, clima, entrada, transição, letreiro e **Enviar aos jogadores** |
| **Montar** | Biblioteca de cenas genéricas e conjuntos prontos, cenas montadas da sessão e o editor: prancheta de arrastar, objetos, inspetor, peças e sala |
| **Luz e clima** | Iluminação e relógio, clima, objetos da cena, efeitos (tremor, relâmpago, escuridão…) e o personagem (teleporte, parede) |
| **Som** | Som ambiente com os canais e as músicas |
| **Pistas** | Pistas da cena (criar, abrir, editar, filtro), conclusões, o que já foi encontrado e anotações da cena |
| **Exploração** | Pedidos de improviso, passagens de qualquer cena (destino, chegada, tranca, elevador), mapa de conexões, eventos e preferências |
| **Itens** | Entregar itens, o que está no chão desta cena e como o personagem usa cada um |
| **Jogadores** | Tela dos jogadores, cliques deles nas pistas, cortina e documento |
| **Sessão** | Exportar, importar, recomeçar e a lista de atalhos |

### A mesa em duas janelas

- **Abrir tela dos jogadores** abre `jogadores.html`, uma janela sem nenhum controle: só a cena, a cortina e os documentos. Leve-a para a TV, o projetor ou o segundo monitor e aperte **F** nela; no Discord ou no OBS, compartilhe só essa janela. **Abrir no segundo monitor** usa a Window Management API do Chrome quando há mais de uma tela.
- A imagem é a mesma do jogo do mestre, quadro a quadro, sem os marcadores do mestre, a linha de arrasto nem os painéis. Ela vai por `postMessage` com o buffer de pixels transferido, o que funciona até por `file://`, onde as duas páginas nem têm a mesma origem. Se `jogadores.html` for aberta à mão, um `BroadcastChannel` é tentado. A escala é inteira quando cabe (4× em 1920×1080) e **E** alterna para ajustar à tela; o cursor e a barra somem sozinhos.
- O indicador mostra se a tela está conectada, a taxa de quadros e o tamanho da janela. Se o jogo do mestre recarregar, a tela reconecta sozinha em menos de um segundo. O navegador pode pausar janelas totalmente cobertas: deixe as duas visíveis.

### Preparar em silêncio, enviar quando quiser

Como no modo estúdio do OBS e na diferença entre “ver” e “ativar” cena do Foundry, a seção **Cenas** tem uma **prévia que só o mestre vê**: escolha a cena na biblioteca (miniaturas; **1–9**), a luz, o clima, os objetos e o ponto de entrada, e mova a câmera da prévia. **Enviar aos jogadores** (**Ctrl+Enter**) aplica tudo com a transição escolhida: esmaecer, dissolver, íris em volta do personagem, persiana ou corte seco, com duração e **letreiro** opcional (nome e subtítulo em fonte de pixel). **Shift+número** envia uma cena na hora. **↶ Anterior** desfaz a última mudança ao vivo.

### Ambiente ao vivo

Em **Luz e clima**, tudo muda para os jogadores sem recarregar nada, com uma dissolução pontilhada:

- **Iluminação**: Manhã, Tarde, Pôr do sol, Noite e Luzes apagadas. Cada uma pinta de novo as camadas pela luz, não por filtro, e também escurece ou esfria o personagem.
- **Relógio da cena**: o relógio de parede mostra a hora escolhida e continua andando.
- **Clima**: céu limpo ou chuva (céu fechado, chuva na janela, sem sol no chão).
- **Objetos**: aparecem e somem (luminária, monitor, café, envelope lacrado, molho de chaves, papéis no chão, bilhete na porta, arquivo entreaberto, retrato torto, pegadas e poça de sangue).
- **Efeitos**: tremor (**T**), relâmpago com trovão (**L**), luzes piscando, escuridão com raio em volta do personagem e pulso de tensão com batimento.
- **Som ambiente**: sintetizado no navegador. Ruído de sala, relógio, chuva, grilos à noite, vento em cena externa, trovão e batimento. Liga num botão, porque o navegador só permite som depois de um clique. **Cada som tem a própria chave** — tom da sala, chuva, vento, relógio, grilos e pingos, batimento, trovão e os passos do personagem — e o que foi escolhido fica salvo na sessão.
- **Passos**: a camada de movimento avisa quando um calcanhar pousa (dois por passada, alternando os pés, mais fortes correndo, um ao aterrissar de um salto) e o som toca conforme o piso — madeira no escritório (batida surda com um estalo em cima), grama na cena de campo (um esmagado de ruído).
- **Música**: cinco trilhas curtas escritas em notas e tocadas pelo navegador, em loop, uma de cada vez, com volume próprio e lembradas na sessão (voltam a tocar quando o som é ligado): *Investigação* (baixo andante em ré menor, piano abafado, colchão de cordas), *Tensão* (bordão grave, quintas desafinadas, um sopro), *Chuva calma* (arpejos de triângulo sobre maj7), *Perseguição* (baixo quadrado, caixa de ruído, arpejo), *Lamento* (melodia triste em lá menor). Ficam em `MUSIC` no `som-ambiente.js`: cada voz é uma onda, um ganho, um envelope e as notas como `[tempo, altura MIDI, duração]`.
- **Personagem**: leva o personagem para qualquer ponto de entrada da cena.

### Itens para o personagem

A seção **Itens** entrega qualquer item que não tenha história própria — bandagem, tala, antibiótico e o taco de beisebol (roupa sai do guarda-roupa, pista sai do cenário):

- **Na bolsa**, com quantidade para o que empilha; se não couber tudo, diz quanto coube.
- **No chão**: cai deitado na frente do personagem, na cena atual, e os jogadores veem. O personagem guarda com um clique perto, ou arremessa.
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
| **I** · **E** | bolsa do personagem · golpe com o taco na mão |
| **Esc** | fecha a pista aberta · pula a cinemática |
| **F** · **E** | na tela dos jogadores: tela cheia · escala |

### O Escritório: três camadas em uma câmera

O primeiro cenário segue a imagem de referência: parede bege sobre lambri escuro, dois quadros de avisos em volta do brasão, estante, banco sob a janela, chão de tábuas encerado pegando sol e, na frente, a mesa com luminária de banqueiro, monitor e documentos. A sala foi alargada para um mapa fechado de 1680 px, três telas e meia: entrada à esquerda, cabideiro e estante; quadros e brasão no centro; janela, arquivo de gavetas, relógio, bebedouro e a porta do **ARQUIVO** à direita.

- **Parede** (fundo): 573×62 pixels de arte, rola a 0,68 da velocidade do jogador.
- **Chão** (onde o personagem pisa): desenhado **linha por linha**, cada linha na sua profundidade, como o chão de *Street Fighter II*. Tábuas, juntas, tapete, sol e manchas ficam em coordenadas do mundo, então mantêm a perspectiva enquanto a câmera anda. A linha de fator 1 é o chão do jogo (y = 229).
- **Frente**: mesa, cadeira, planta de vaso e espada-de-são-jorge, a 1,17–1,3; passam na frente do personagem.
- **Janela**: céu, prédios e árvores em três planos ainda mais lentos, com nuvens, estrelas e chuva animadas.
- **Paredes laterais**: nas pontas do mapa a sala se fecha em perspectiva (placa de saída, diploma, calendário). A câmera para no fim da sala, o personagem para na parede e o ragdoll também.

Todas as camadas vêm de **um só modelo de câmera**: `x = 240 + (X − câmera) · f` e `y = horizonte + (olho − altura) · f`. Por isso o canto das paredes, a borda do chão e a janela se encontram em qualquer posição. Arte em pixels 2×2, a mesma densidade do personagem, e posições arredondadas.

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

Integração com o jogo em `app.js`: o fundo vem da cena, a frente é desenhada depois do personagem, do sangue e dos restos, a câmera respeita os limites da sala e as dicas de câmera, o personagem é tingida pela luz, e o quadro pronto segue para os jogadores antes dos marcadores do mestre. Sem os scripts de `mestre/`, o jogo desenha o fundo original, que é o que o teste sem navegador executa.

### Validação

`node tests/cenas.test.js`: geometria da câmera e da sala fechada, cinco luzes × dois climas com camadas sólidas e coloridas, furos só na vidraça, arte determinística, sol no lugar certo, todos os textos desenháveis pela fonte e o modelo de cena.

`node tests/pistas.test.js`: os nove tipos e seus campos, âncoras na parede, na mesa e no chão (e de volta a partir de um retângulo desenhado), a menor pista sob o cursor, personagem na frente de pista de parede, pistas que esperam objeto, cliques dos jogadores (nunca em pista oculta, só quando permitido), quem encontrou, contadores das conclusões, edição, exclusão e restauração, sessão exportada e importada, arquivos e senha do computador e o cadeado.

`node tests/browser-pistas.test.js`: no Chrome, abre pistas clicando na cena sem o painel, lê os três X e usa o barbante e a lupa, os jogadores clicam na foto pela janela deles e ela vai para a bolsa, de onde o mestre a examina para todos e eles a viram, digita a senha durante o boot sem acionar atalhos, abre o arquivo corrompido, levanta o teclado, abre gaveta, erra e acerta a senha da tampa, aperta NÃO APERTE, confere a cinemática na tela dos jogadores e pula, confere o botão apertado e o estrago na sala e o rearma pelo painel, os jogadores digitam 0317 e a porta do arquivo abre na cena, cria uma pista pelo editor marcando a área na cena (que vai para a bolsa) e confere tudo depois de recarregar. `node tests/som.test.js` cobre as chaves de cada som, os passos vindos da marcha e as cinco trilhas com um AudioContext de mentira. Capturas em `pixel_art/generated/pistas/`.

`node tests/browser-painel.test.js`: no Chrome, a página com o nome do RPG e o botão que abre o mapa; as onze seções com ícone e nome, trocadas com as setas; cada controle na sua seção; a janela do mesmo tamanho em todas as seções, com o topo e a coluna parados enquanto só a seção rola (e a janela inteira rolando num celular deitado); o filtro de pistas; blocos recolhidos e a última seção de volta depois de recarregar; e os avisos do topo (pistas, som, cliques dos jogadores, cortina e documento) levando à seção certa. Captura em `pixel_art/generated/painel/`.

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
- **CAM 07.** Depois de ler a linha nova aparece uma câmera que Jorge nunca instalou: o próprio escritório, ao vivo, com o personagem dentro. O campo *CAM 07* da pista das câmeras escolhe *depois da folha*, *sempre* ou *nunca*.
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

**Atravessar.** Perto de uma passagem aparece a dica **↑** com o que ela faz (*Entrar*, *Subir*, *Descer*, *Chamar o elevador*, *Seguir*); **↑** ou **W** atravessa. Clicar na porta — também pela janela dos jogadores, se o mestre deixar — leva o personagem até ela. Encostar e empurrar a borda da sala sai pela lateral. A chegada é na passagem de lá, virada para dentro da sala; a cena de destino volta com a luz, o clima e os objetos de quando foi deixada, e a hora e a chuva seguem da cena de onde ela vem. O mesmo **↑** usa objetos: abrir gaveta, examinar, acender a luz, ligar a TV.

**Trancas.** Aberta; trancada (com a mensagem que o mestre escrever); **chave** (o item *Chave* com o mesmo nome, na bolsa, ignorando maiúsculas e acentos); **código** (teclado na tela, que os jogadores digitam pela janela deles, com um bilhete opcional ao lado); ou **só com a liberação do mestre**, que vira um pedido *Quer passar*.

**Elevador.** Uma lista de andares (`RÓTULO | cena | chegada`); o painel mostra os botões e o andar atual; a porta abre com a transição de portas de elevador. O mesmo painel pode valer para todos os andares do prédio. Andar sem cena também vira pedido.

**Pedidos de improviso.** Uma passagem sem destino não abre para os jogadores (*NÃO ABRE*) e aparece para o mestre no topo do mapa e na seção **Exploração**, com miniaturas de sugestões: primeiro pelo nome da passagem (*Banheiro* sugere banheiro, *Estoque* sugere depósito, *Diretoria* sugere escritório), depois pelo lugar onde ela está (numa rua: loja, lanchonete, portaria…). Um clique **cria a cena, liga ida e volta e leva o personagem** — a cena criada é a mesma da miniatura. Também dá para escolher outro modelo, ligar a uma cena que já existe (escolhendo por onde chega) ou deixar como está.

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

## Sair de casa: 9 cenas novas, 3 carros e o que se come no caminho

O Escritório, o Escritório do Jorge e o Campo de ruínas deixaram de ser ilhas. Cada um virou um **lugar com saída**: dá para andar até a porta, atravessar o prédio inteiro e chegar na rua, onde tem um carro estacionado — um carro diferente para cada grupo, porque cada um é de um jeito. Tudo continua pintado por código, na mesma câmera e com a mesma luz das cenas antigas.

| De onde | Para onde se vai | O que tem lá |
| --- | --- | --- |
| **Escritório** (Prefeitura, 2º andar) | porta de vidro → **Corredor do 2º andar**; porta do arquivo (depois do cadeado 0317) → **Sala do arquivo** | — |
| **Corredor do 2º andar** | escada → **Escadaria do 1º andar**; portas → **Banheiro**, **Copa**; Gabinete trancado; sala 204 e elevador para o mestre improvisar | bebedouro de pressão, quadro de avisos, a placa de 1987, carrinho de limpeza |
| **Escadaria · 1º andar** | sobe → corredor; desce → **Saguão**; porta de vidro do 1º andar (improviso) | vitral com o brasão, o balde da limpeza |
| **Saguão · térreo** | escada; **portas de vidro → Praça da Prefeitura**; elevador em manutenção | portaria com o livro de ocorrências, bebedouro, mesinha do cafezinho (garrafa térmica), o relógio parado às 3h17 |
| **Praça da Prefeitura** | portão → saguão; a rua continua para os dois lados (improviso) | **sedã oficial** na vaga do gabinete, chafariz, carrinho de pipoca, carrinho de água de coco, banca de jornal |
| **Sala do arquivo** | porta → Escritório; **escada do porão trancada** (para depois) | caixas de 1987, a caixa “ANEXO — NÃO DESCER”, arquivo de aço, leitora de microfilme |
| **Banheiro / Copa da Prefeitura** | porta → corredor | pia, privada; geladeira, armário, fogão, micro-ondas, cafeteira, sanduicheira, bebedouro de galão |
| **Escritório do Jorge** | porta do corredor → **Corredor do prédio** | — |
| **Corredor do prédio** | portas do depósito, das caixas e das cópias (improviso), **banheiro**, **copa**; escada → **Porta da frente** | a porta 12, o hidrante, a câmera CAM 01 com o LED vermelho |
| **Porta da frente** | escada → corredor; **porta → Rua do prédio** | capacho, cartas no chão, ganchos com o casaco, caixas de correio |
| **Rua do prédio** | porta → hall; a rua segue para os dois lados | **hatch azul desbotado**, trailer de lanches 24 h, orelhão, poste de sódio, gato de rua |
| **Copa / Banheiro do Jorge** | porta → corredor | filtro de barro, fogão, micro-ondas, cafeteira, geladeira; pia, privada, chuveiro |
| **Campo de ruínas** (refeito em perspectiva) | lateral → **Estrada de terra**; o outro lado, improviso | bica, poço com manivela, cocho, goiabeira, mangueira, fogueira |
| **Estrada de terra** | lateral → campo; a estrada segue (improviso) | **picape enferrujada**, porteira, bananeira, a placa “ESTAÇÃO VELHA 2 KM” |

As cenas do prédio do Jorge batem com o que as câmeras dele mostram (CAM 01 corredor, CAM 02 porta da frente, CAM 05 exterior), e a praça mostra a mesma Prefeitura da foto pregada no quadro de avisos do Escritório — prédio branco com colunas e cúpula. O Campo virou uma sala em perspectiva com muro de pedra e arcos, guardando as cores do fundo antigo.

### Os carros, na perspectiva certa

`mestre/veiculos.js` desenha carro por raio, pixel a pixel, dentro da câmera da própria cena: a lateral de perto na escala da profundidade, o teto e o capô vistos de cima e **a ponta que aparece muda de lado conforme a câmera anda**, como na vida. A imagem fica em cache por modelo, cor, sujeira, luz e posição da ponta, e acende com as luzes do preset (sol, poste, faróis) com sombra de contato no chão.

- **Sedã oficial** escuro com o brasão da cidade na porta, calotas e antena — poder e burocracia (Prefeitura).
- **Hatch velho** azul desbotado, para-choque preto, uma calota faltando, papéis e livros no banco de trás — o escritor obcecado (Jorge).
- **Picape enferrujada** com lama nas rodas e lona amarrada na caçamba — os lugares esquecidos (Campo).

O mestre coloca carro em **qualquer cena** pela seção **Exploração** do mapa do mestre: *Adicionar carro*, *Mover no palco* (arrasta na cena: horizontal muda o lugar, vertical a profundidade), virar, cor, faróis, pisca-alerta, motor ligado, sujeira e placa. Interagir com o carro chama `Veiculos.aoUsar({veiculo, cena, fonte, sys})` — o gancho que a **viagem de carro** usa (a seção seguinte).

## Fome e sede

Quatro estágios em cada uma, e o mestre manda: **Satisfeita → Com fome → Faminta → Fraca** e **Hidratada → Com sede → Sedenta → Desidratada** (limites em 30, 60 e 85).

- **Estágio 1**: um pouco mais devagar, cura mais lenta. **Estágio 2**: devagar, sem fôlego para correr e a vista escurecendo nas bordas. **Estágio 3**: bem mais devagar, a vinheta pulsando e **perda lenta de vida**, que o mestre desliga e que nunca passa do piso que ele escolher. Fome e sede juntas se multiplicam (com piso), e o personagem fala o que está sentindo (“Minha boca está seca”, “Minhas pernas estão fracas de fome”).
- Na tela aparecem **dois ícones de pixel art** — um pão e uma gota — que enchem de cor conforme aperta, e só aparecem quando há o que mostrar. Os jogadores veem junto.
- **Seção FOME E SEDE** do mapa do mestre: os dois medidores com os quatro estágios (um clique põe o personagem em qualquer um), nível fino, congelar, **automático com prazo** (“chegar em COM FOME em 45 min”, com a conta do que falta em tempo real), ritmo lento/normal/puxado, perda de vida com piso, **pular tempo** (+5 min, +15 min, +1 h, +4 h), as condições ativas e o histórico do que ele comeu e bebeu.
- O relógio é o mesmo da saúde (**H** → *Iniciar saúde*): com ele parado, fome e sede só mudam quando o mestre mexer.
- **Condições**: enjoo, dor de barriga, intoxicação alimentar, **infecção intestinal com fases** (incubação → enjoo → gastroenterite, com vômitos que dão mais sede e fome → fraqueza), cafeína (“ligada”), tremedeira, moleza depois da marmita e o bônus de uma refeição boa. O chá de boldo e o soro caseiro ajudam; o mestre cura qualquer uma com um clique.

## A viagem de carro e o minigame de estrada

Entrar no carro agora leva a algum lugar. O caminho inteiro:

1. **Entrar** — chegando perto do carro, <kbd>↑</kbd> abre a **interface do carro por dentro**: para-brisa com a estrada correndo, retrovisor com o nome do modelo, velocímetro, conta-giros, combustível e temperatura, as luzes de bateria e óleo acesas enquanto o motor está frio, volante com a placa no cubo, rádio com cinco estações, faróis, pisca-alerta e buzina.
2. **Ligar** — *GIRAR A CHAVE*: a chave gira, o motor pega (os ponteiros acordam, as luzes de aviso apagam) e aparece o botão **PARTIR**.
3. **Sair do mapa** — o carro **anda de verdade dentro da cena**, na perspectiva dela, levantando poeira, até sumir na beira. O personagem some do cenário, porque está dentro do carro.
4. **Para onde?** — o carro vira um **pedido no mapa do mestre**, no mesmo lugar em que as portas sem destino já viravam pedido: seção **Exploração → Pedidos**, com as sugestões de cena (rua, estacionamento, oficina, loja, prédio abandonado, beco) em miniatura, a lista das cenas que já existem e o botão de **criar uma na hora**. Ali mesmo o mestre marca **o tamanho do percurso** (de “logo ali” a “outra cidade”), se a viagem tem o **minigame de estrada** e qual trecho.
5. **A estrada** — se o mestre quiser, roda o minigame (abaixo). Se não quiser, corta direto.
6. **Chegar** — a cena de destino entra, o personagem desce e **o carro vai junto**: ele sai da cena de origem e estaciona na de destino com a mesma cor, placa e sujeira.

A viagem **custa tempo do relógio do mestre** — quanto, depende do percurso que ele escolheu (8 min para o quarteirão ao lado, 110 para outra cidade) — e esse tempo passa na fome e na sede. Batida na estrada pode virar hematoma — o mestre liga e desliga isso.

### O minigame, estilo Rad Racer

Um trecho de direção em **pseudo-3D**, em pixel art, no mesmo buffer de 240×135 das cinemáticas.

- **A técnica** é a dos anos 80, que a pesquisa desta fase levantou ([Lou's Pseudo 3D Page](https://www.extentofthejam.com/pseudo/), [Jake Gordon](https://jakesgordon.com/writing/javascript-racer-v2-curves/)): a pista é uma fila de segmentos com curva e altura; cada um é projetado por `escala = profundidade/z` e pintado **do fundo para a frente**, e cada segmento só pinta acima do topo do anterior (`maxy`) — é isso que faz um morro esconder o que vem depois, de graça. A curva não mexe no mundo: é um deslocamento que se acumula linha a linha (`x += dx; dx += curva`), o mesmo truque de série aritmética do Enduro do Atari. Os sprites da beira e o trânsito escalam por `1/z` e são cortados pelo mesmo `maxy`. A neblina é desbotamento exponencial com **pontilhado ordenado**, nunca degradê liso.
- **O carro é o do jogador.** A traseira não é um desenho à parte: é o **modelo 3D do próprio carro** com que o jogador interagiu, girado 90° em torno do eixo da altura (`Veiculos.traseira`). Cada plano do sólido gira, e o sombreador continua recebendo as coordenadas do modelo — por isso vidros, lanternas, placa, brasão, ferrugem, a lona da picape e os papéis no banco do hatch caem exatamente onde deviam, sem uma linha nova de pintura. Nas curvas o carro **inclina de verdade**, porque o ângulo do giro muda. O trânsito usa os mesmos modelos, de frente ou de costas, em poucas distâncias guardadas em cache.
- **Sete trechos**, para a viagem nunca ser a mesma: *Rodovia ao sol*, *Serra ao entardecer* (curvas fechadas e o sol baixo), *Estrada de terra* (poeira, cerca, gado e sulcos), *Rodovia à noite* (faróis, olhos de gato, lua e estrelas), *Chuva forte* (asfalto molhado, limpador e pouca aderência), *Neblina de madrugada* (enxerga pouco, as coisas aparecem em cima da hora) e *Beira da cidade* (prédios, outdoor e trânsito). Cada trecho tem céu, chão, pista, beira, clima e trânsito próprios, e a pista sai de uma semente. No sorteio, nunca repete o da viagem anterior.
- **A arte, e por que ela fecha.** Nada é pintado em RGB: tudo entra num `PixelBuffer` em **(rampa, nível)**, como o resto do jogo, e só vira cor no fim (`K.resolve`). Isso dá as três coisas que separam pixel art boa de amadora — **a paleta fecha** (toda cor sai de uma rampa de 8 tons construída em OKLab, com matiz deslocando na sombra e na luz; um teste confere que não escapa uma cor sequer); **degradê é pontilhado, não é mistura** (céu, neblina e sombreado andam entre dois níveis vizinhos com bayer 4×4, faixa chapada no meio do nível e pontilhado fino só na travessia); e **distância tira contraste em vez de jogar cinza por cima** (a perspectiva atmosférica puxa o *nível* na direção do tom do horizonte e só bem longe dissolve a rampa, então o campo lá no fundo continua sendo campo). O resto veio da mesma cartilha: silhueta legível antes do detalhe, contorno com um tom mais escuro da própria rampa em vez de preto chapado, três a quatro níveis por material, textura de chão irregular (grama espaçada igual vira tapete de plástico) e leitura conferida em 1×.
- **Cada trecho tem a paleta dele.** A noite não é o dia escurecido: é a paleta inteira puxada para o azul (variante `estradaNoite`), como as cenas já faziam com o humor da luz. Entardecer esquenta, chuva lava, neblina achata o contraste, terra empoeira. O carro segue a mesma regra pela variante da paleta dos veículos (`night`, `sunset`, `rain`, `moon`).
- **O que está na tela**: céu em degradê chapado com nuvens de três bolhas (topo na luz, barriga na sombra), sol baixo com halo pontilhado e as listras clássicas, lua em foice e estrelas que piscam, serra em camadas com crista iluminada, touca de neve nos picos e mata na crista em tufos, horizonte de prédios com janelas acesas, asfalto com trilhas de roda, remendos, linha de bordo, zebra vermelha e branca, acostamento de terra com um risco escuro que assenta a estrada no terreno, e uma beira povoada de pinheiros, árvores, cercas, postes, placas, guarda-corpo, olhos de gato, silos, caixas d'água, vacas e capim — cada peça um mapa de pixels com silhueta e três tons.
- **Jogar**: <kbd>A</kbd> <kbd>D</kbd> (ou as setas) guiam, <kbd>W</kbd> **acelera**, <kbd>S</kbd> **reduz** (as lanternas acendem), <kbd>H</kbd> buzina, <kbd>Esc</kbd> pula. **Sem ninguém tocando, o carro se vira sozinho**: fica na mão da direita, segura atrás de quem está na frente e desvia pelo acostamento da mão dele — dá para só assistir. Quem encostar numa seta assume o volante.
- **O acelerador é de CRUZEIRO: não se segura botão.** O veículo guarda uma **velocidade escolhida**; para a frente ela sobe, para trás ela desce até parar, e soltando as duas o veículo continua no que ficou. O motor persegue essa escolha com a mesma aceleração e o mesmo freio de antes — por isso ele ainda demora a chegar lá, ainda escorrega no cascalho e ainda perde nas subidas: quem mudou foi quem decide, não a física. Antes o veículo ia sozinho até o talo e a única coisa que o pé fazia era frear.
- **O velocímetro mostra as DUAS velocidades.** No canto do painel, um relógio de 240° em pixel art: o **ponteiro** é a velocidade que se tem, o **risco âmbar na borda** é a que se pediu. Aperta para a frente, o risco anda na frente e o ponteiro vai atrás — é assim que se lê, num relance, que ninguém precisa segurar tecla nenhuma. O fundo de escala é o teto **daquele veículo**: uma bicicleta com o ponteiro parado no primeiro quinto seria uma mentira sobre o esforço de quem pedala.
- **Cada classe no ritmo dela.** A **bicicleta** anda a um quinto do carro (~35 km/h) e custa a engrenar; a **moto** corre um pouco mais que o carro e arranca bem antes dele; o **carro** é a régua. Aceleração, freio e atrito saem do teto do próprio veículo, então todos levam os mesmos segundos para chegar ao *seu* máximo — e como o teto encolhe com a lataria amassada, carro batido também fica mole no pé, de graça. A pista encolhe e estica na mesma proporção, então a viagem dura o mesmo de relógio: o que muda é a paisagem passando depressa ou devagar.
- **A estrada é larga o bastante para desviar.** Um carro ocupava 26% da meia-pista — a proporção de uma estrada de verdade, e apertada como uma: o desvio saía por três centésimos de pista e qualquer imprecisão era mato ou contramão. Como a pista ocupa a tela inteira, alargar a estrada e diminuir o carro são a mesma coisa, então o carro encolheu um quinto e a estrada passou a caber quase cinco carros de ponta a ponta — a proporção de jogo de corrida. As faixas ficam onde as **duas** coisas cabem: acostamento largo o bastante para fugir de quem está parado na frente, e mão contrária longe o bastante para cruzar com ela em paz. (Os tamanhos relativos entre carro, moto e bicicleta não mudaram: todos saem da mesma régua.)
- **O percurso é seu.** Antes de mandar o carro, o mestre escolhe **o tamanho da viagem** no mesmo pedido: *Logo ali* (3 km), *Do outro lado da cidade* (12 km), *Estrada afora* (34 km), *Outra cidade* (80 km) ou **Personalizado**, digitando os números na mão. A escolha amarra as três coisas de uma vez — a **distância** que aparece no painel do minigame e vai descendo enquanto se dirige, o **tamanho da pista** (de 13 a 80 segundos de estrada montada) e o **tempo de relógio** que a viagem cobra (de 8 a 110 minutos, que passam na fome e na sede). Ir mais longe custa mais, mesmo quando o mestre pula o minigame. O que ficou marcado no pedido vira o padrão da próxima viagem, e dá para trocar o padrão na seção **Exploração → Viagem de carro**.
- **A beira da estrada tem volume, perspectiva e variação.** As peças eram chapadas, repetidas e pequenas; foram refeitas do zero como **geradores** em vez de desenhos fixos. Um tronco é um cilindro (barriga clara em 72% da largura, as duas quinas escuras), uma copa é um amontoado de bolhas com o alto à direita na luz e a borda picotada, uma pedra tem facetas, e **o que é caixa mostra a face lateral e o topo** — placa, casa, prédio, outdoor, silo, caixa d'água. Cada peça tem **três variantes** guardadas, e cada instância ainda sorteia espelho, escala e um degrau de tom: uma fileira de árvores deixou de ser o mesmo carimbo. Elas também ganharam o dobro de resolução e mais tamanho no mundo, então quando passam rente à câmera varrem o quadro. E a sombra de contato virou uma **elipse** pontilhada no chão, em vez de um risco.
- **Marco de estrada é marco.** O sorteio da beira é **pesado**: mato, arbusto, cerca e árvore saem quase sempre; silo, prédio, casa, outdoor, caixa d'água e torre saem raramente. Sorteando por igual, um trecho de oito peças punha silo em uma de cada quatro posições e a estrada de terra virava um pátio de silos. (O sorteio continua gastando **um** número do gerador, porque o trânsito divide o mesmo gerador e precisa nascer onde nascia.)
- **O campo tem dono.** Enfeitar a beira não resolvia o que estava atrás dela: um pasto chapado até o horizonte. O que enche um campo de verdade não é mais enfeite, é ele ter **dono** e ter **fundo**:
  - **Talhões** — a cada tantos metros o campo de cada lado muda de lavoura, e com ela de tom. É a colcha de retalhos que se vê da estrada.
  - **Sulcos de plantação** — linhas paralelas à pista, num mesmo afastamento do eixo. Como a largura da pista encolhe com a distância, elas **convergem sozinhas** para o ponto de fuga: profundidade sem gastar um sprite.
  - **Coisas compridas que correm junto** — cerca de arame com mourão, carreador de terra, valeta alagada, cerca-viva, muro, meio-fio e calçada. Cada uma no seu afastamento, contínua até o horizonte.
  - **Campo distante** — logo acima da linha do horizonte, uma faixa de talhões com mata de divisa e telhado de sítio (o *distant ground graphic* do Lotus). O relevo dela é liso e o tom é por talhão: se o recorte também fosse por talhão, o fundo virava uma fila de caixas marrons.
  - **E o contraste morre com a distância.** A neblina já lavava o *tom* de cada pixel, mas talhão e sulco são **diferença** de tom, e diferença lavada pela metade continua sendo diferença: as listras de lavoura ficavam tão fortes no fundo quanto na frente, e corriam atravessadas na profundidade — o olho lia faixas de cor, não chão que se afasta. Agora o desenho do talhão perde força junto com a distância, que é o que a vista faz.
  - **Cada coisa com o seu material.** Na serra ao entardecer, o pasto, a cerca-viva, a colina e o campo distante eram todos o mesmo verde escuro, e a tela virava uma mancha só. O pasto ganhou material próprio: a cerca-viva voltou a ser uma linha escura atravessada no campo claro, que é o que ela é, e a serra se descolou do chão.
- **A estrada FAZ coisas.** Uma estrada longa que nunca muda é um corredor. Sete acontecimentos aparecem ao longo do percurso, sempre em reta (para dar tempo de ver) e nunca colados um no outro: **cruzamento** (a via que cruza, placas de PARE nas quatro esquinas e **um carro atravessando** de um lado ao outro), **entroncamento** (a esquina: o asfalto abre num triângulo para um lado só, com a seta da saída), **ponte** (o campo dá lugar à água, com tabuleiro de concreto e guarda-corpo dos dois lados), **passagem de nível** (trilhos e estrado de madeira atravessando, com a cruz de Santo André e as lanternas), **viaduto** (o pórtico que passa por cima e por baixo do qual se atravessa), **pedágio** (praça com ilhas e cabines de cancela) e **acostamento largo** (um lugar para encostar). Cada trecho tem os seus: não há pedágio em estrada de terra.
- **A estrada tem uma frota.** O modelo de cada veículo do trânsito era sorteado com peso igual entre *todos* os modelos do jogo. Com três carros isso dava três carros; com três motos e uma bicicleta no catálogo, virou quase metade de moto e uma bicicleta a cada sete — numa rodovia. Agora a frota é do **trecho**: na rodovia o que passa é carro (moto ~13%, bicicleta nenhuma), na estrada de terra e na beira da cidade há muito mais duas rodas, e é só ali que uma bicicleta faz sentido. O peso é por **classe** e dividido entre os modelos dela, então acrescentar uma quarta moto ao jogo não dobra a quantidade de moto na estrada. Nunca houve ligação entre o que o jogador pilota e o que vem na estrada — o que faltava era a estrada ter frota. Cada veículo também ganhou **a sua cor** (uma fila de sedãs idênticos lê como adesivo repetido) e **o seu passo** (a bicicleta do trânsito não vem a setenta por hora).
- **O piloto automático chega vivo.** Metade das cinemáticas sem ninguém no comando acabava em pane, por duas razões que nada tinham a ver com dificuldade: ele ia a oitenta por cento contra a traseira de quem estava na frente (o trânsito já casava velocidade entre si; só o *nosso* carro não), e, quando não havia outra faixa para onde ir, desviava **para o meio da estrada** — que numa via de mão dupla é a contramão, a poucos metros de quem vinha de lá. Agora ele segura atrás do carro da frente, enxerga quem vem de frente três vezes mais cedo (dois se aproximam com a soma das velocidades), tira o pé quando o contravolante já come o volante inteiro — o que faz chuva, terra e lataria torta pedirem para desacelerar sozinhas — e sai pelo **acostamento da mão dele**.
- **Dentro do acontecimento, a beira sai da frente.** Árvore no meio do cruzamento, poste em cima da ponte e mato na cancela fariam o acontecimento não ser lido — ali só entram as peças dele.
- **A beira tem camadas.** As peças nascem em duas faixas de profundidade — uma rente ao acostamento e outra bem atrás — e são desenhadas de longe para perto, então uma passa na frente da outra. Entre elas entra o miudinho (arbusto, pedra, capim, balizador), que é o que tira a sensação de objetos espaçados numa linha só.
- **Trânsito de verdade, não obstáculo.** Cada carro da pista tem uma **faixa alvo** separada da posição em que está: a decisão muda o alvo, o movimento persegue o alvo devagar, e a faixa ocupada **veta** o movimento em vez de empurrar — é o que tira o tremor de quem fica mudando de ideia. Com isso eles **fazem fila** (copiam a velocidade de quem está na frente, nunca a distância), **desviam** de quem está parado, **ultrapassam** quando há espaço e **freiam** quando não há. Uma mudança de faixa começada vai até o fim, senão o carro fica balançando no meio da pista.
- **Cada trecho corre no tipo de via dele.** Rodovia, noite e cidade são **pista dupla**: duas faixas na nossa mão, e quem vem de frente está longe, do outro lado do canteiro — que agora é pintado, com o asfalto e a faixa da contramão à vista. Serra, terra, chuva e neblina são **mão dupla**: uma faixa de cada lado, e ultrapassar é invadir a contramão de propósito, com o risco que isso tem. Ninguém mais anda nas duas vias ao mesmo tempo.
- **Eles batem, não atravessam.** A colisão separa os dois carros em profundidade (o nosso volta atrás do outro, nunca por cima), tira velocidade proporcional à **velocidade de fechamento**, empurra de lado, solta **faíscas** no ponto do contato e deixa o carro **de través por uns sete décimos de segundo** — durante a derrapagem o volante não responde e o acelerador não pega, e a traseira gira junto porque o ângulo do modelo 3D muda. Quem levou a batida **reage**: freia, guina para o lado contrário, se estraga e se afasta. Duas batidas em sentidos opostos se cancelam, então ninguém fica preso num pinball.
- **Profundidade nos carros que vêm de frente.** Cada carro do trânsito é desenhado com o **ângulo** que a posição dele pede (calculado do deslocamento lateral e da guinada, arredondado a passos de 0,12 rad para não tremer), espelhado conforme o lado, com **sombra de contato** no asfalto embaixo dele e a névoa do trecho aplicada por cima — é isso que faz um carro pequeno lá na frente parecer longe, e não pequeno.
- **Quatro rodas, não duas.** Os modelos de carro tinham roda só de um lado: agora cada eixo gera as duas rodas e os dois poços de roda, então no minigame — que é justamente onde se vê a traseira inteira — o carro tem as quatro.

- **A cinemática fica com a tela inteira.** Os botões de **bolsa** e **guarda-roupa** moram nos dois cantos de baixo da cena — exatamente onde o minigame põe o velocímetro e a dica de comando. Como ninguém abre a mala no meio de uma ultrapassagem, eles saem de cena enquanto uma cinemática roda, junto com o crachá de saúde, e voltam sozinhos quando ela acaba. Os atalhos de teclado continuam valendo para quem insistir.
- **É sempre opcional.** Quem decide é o mestre: a cada viagem, no pedido, ou de uma vez na preferência *Minigame: escolho a cada viagem / sempre / nunca · ir direto* da seção **Exploração → Viagem de carro**, onde também ficam o trecho fixo, a duração, quantos minutos do relógio a viagem custa, se a batida machuca e um botão **Ver o minigame agora** para você olhar sem viajar.

### O som da estrada

Som sintetizado na hora, sem um arquivo de áudio no projeto — como o resto do som do jogo. Quem liga é o minigame; quem manda é o mestre.

- **O motor é o do carro.** A nota do escape não é inventada: sai da conta de verdade de um motor quatro tempos — `explosões por segundo = rotação / 60 × cilindros / 2`. Por isso o **sedã oficial** (seis cilindros) soa mais cheio e mais agudo que o **hatch velho** (quatro pequeno, filtro mais aberto, mais chiado de admissão) e a **picape** (diesel: quatro cilindros girando baixo, muito ruído, sub pesado e um tremor de marcha lenta de propósito). Quatro osciladores por motor — corpo, batimento levemente desafinado, harmônica e sub — passando por um passa-baixa que abre com a carga: acelerando o som abre, aliviando o pé ele fecha.
- **Caixa de cinco marchas.** A rotação sobe dentro da marcha e **cai na troca**, com um estalo seco do câmbio — é isso que faz soar como carro e não como sirene subindo. Da primeira à quinta, a faixa vai de 900 a 5.600 rpm, e cada modelo estica de um jeito.
- **Pneu, vento e canto.** Ruído marrom filtrado para o rolamento (grave no asfalto, **agudo e alto no cascalho** quando o carro sai da pista), ruído branco em banda para o vento, que só aparece de verdade em velocidade, e um canto de pneu estreito que entra na guinada forte ou na freada.
- **Sete trilhas, uma por trecho**, no mesmo formato das músicas do mapa do mestre: *Rodovia* (rock de viagem, 138 bpm), *Serra* (96, mais aberta), *Terra* (112, seca), *Noite* (124, sintética), *Chuva* (88, pesada), *Neblina* (72, um drone que nunca resolve) e *Cidade* (150, baixo sincopado e bateria cheia). Elas entram na lista de músicas do mapa do mestre como qualquer outra.
- **Ajustável no mapa do mestre.** Seção **Som → SOM DA ESTRADA**: liga e desliga tudo, escolhe a trilha (*combinar com o trecho*, uma fixa, ou **silêncio**) e regula em separado **motor**, **pneus e vento**, **efeitos** (batida, cascalho, buzina) e **música da viagem**. Tem um botão **Ouvir o motor** para testar o timbre de cada carro sem viajar. A escolha fica salva na sessão. Quando a viagem acaba, a música que estava tocando na mesa **volta sozinha**.

### O carro se estraga, e a velocidade é que manda

A lataria é **um número de 0 a 100** e tudo o mais sai dele — o que se vê, o que atrapalha dirigir e a hora em que o carro simplesmente não liga. É um número e não uma lista de peças quebradas porque, na mesa, o que se pergunta é “dá para ir com esse carro?”.

- **O que machuca não é bater, é a velocidade com que se bate.** Na batida, o jogo calcula a **velocidade de fechamento** (a diferença entre os dois carros; de frente, a soma) e ela decide tudo. Três faixas bem separadas: **ROÇOU** (até um quarto do máximo: um susto, tinta arranhada, nenhum ferimento), **BATIDA** e **BATIDA FEIA**. Encostar num carro que vai quase junto custa 1 ou 2 pontos de lataria; jogar o carro contra um de frente, no talo, custa quase quarenta — e de frente pesa mais 35%. Nenhuma batida sozinha destrói o carro: sempre sobra o que consertar.
- **E no personagem também.** Só impactos acima do limiar viram ferimento, e a força do hematoma sai da força da batida. Acima de 85% de fechamento já não é hematoma: **corta**. Um passeio de raspadinhas não machuca ninguém. (O mestre continua podendo desligar isso.)
- **Aparece no carro**: riscos na lataria a partir de 12, chapa cedida a partir de 28, **farol estourado** aos 35 (e o carro deixa de jogar luz no chão), para-brisa trincado aos 50, ferrugem no fundo dos amassados aos 60 e **fumaça saindo do capô** aos 70. Nada disso é ruído: o amassado é um relevo de ondas nas coordenadas do modelo, e o dano é o nível do mar — por isso o estrago de um carro é sempre o mesmo, só cresce, e o mesmo shader serve para a cena, a miniatura do painel e a traseira dentro do minigame.
- **Atrapalha dirigir**: menos aderência, menos velocidade máxima e uma **puxada constante para um lado** (a geometria torta), que é sempre o mesmo lado para o mesmo carro. Cascalho em alta também castiga o carro, devagar.
- **Aos 90, acabou**: a chave gira, o motor rateia e morre — e a viagem não sai. Se ele chegar aos 90 **no meio da estrada**, a viagem para onde está (ver *a pane*, adiante). Só volta se alguém consertar.
- **O mestre manda**: cursor **Lataria** no bloco CARROS da seção Exploração, com o estado escrito ao lado (*Inteiro · sem uma marca*, *Amassado · chapa cedida, um farol estourado*…), e um botão **Consertar**. Quem está na mesa conserta com o **kit de reparo** (adiante).

### O porta-malas

Guardar coisas no carro é duas grades lado a lado e arrastar — sem menu, sem botão “transferir”.

- **Abre pelo carro**: botão **PORTA-MALAS** no painel de dentro do carro (ou pelo bloco CARROS do mapa do mestre, que mostra quanta coisa tem dentro). A bolsa abre junto, encostada ao lado — as duas grades à vista é o que torna o arrasto óbvio.
- **Três caminhos para a mesma coisa**: arrastar de uma grade para a outra (nos dois sentidos, com o mesmo fantasma verde/vermelho da bolsa), **dois toques** no item para mandá-lo para o outro lado, e dentro do porta-malas o item se arruma como na bolsa (<kbd>R</kbd> gira, <kbd>Esc</kbd> cancela).
- **Cada modelo leva o que leva**: o hatch velho tem 6×4, o sedã oficial 8×5 e a picape uma **caçamba** de 10×6.
- **O que está em uso não entra**: a roupa vestida, o taco na mão, o suprimento no meio de um curativo — o porta-malas recusa e diz por quê.
- **A carga mora no carro, não na janela**: ela fica nos dados da pista do veículo, então é salva com a sessão, sobrevive a trocar de cena e **viaja junto** quando o carro vai para outra cena.

### O kit de reparo

Consertar deixou de ser só um botão do mestre: virou uma coisa que o personagem **faz**, com as mãos, ao lado do carro.

- **É um item da bolsa** (2×2, pilha de 2, tipo *Peça*): caixa de ferramentas com chaves, fita e uma lata de massa. Quem entrega é o mestre, pela seção **Itens** do mapa do mestre, como qualquer outro item.
- **Só perto do carro, na cena.** O menu do item só oferece *Consertar o carro* quando há um carro a menos de 170 px do personagem; fora disso ele explica o porquê. O personagem **anda até o carro**, se ajoelha, encaixa a chave e trabalha.
- **O tempo depende do estrago.** A animação tem uma volta de chave a cada meio segundo, e o número de voltas sai da lataria: um arranhado sai em poucos segundos, um carro batido leva mais de vinte. É tempo de animação, não do relógio do mestre — a pane já custou o que tinha de custar.
- **Um kit, um conserto**: o kit é gasto na confirmação e tira 40 pontos de lataria. Um carro morto (90) volta a andar; um carro destruído precisa de dois.

### A moto, e o personagem pilotando

Três motos entram no jogo pela mesma porta dos carros: **Moto de rua** (naked, com bauleto e carenagem baixa), **Moto de trilha** (roda grande, bico alto, protetor de mão, postura em pé) e **Moto cargueira** (baú de entrega quadrado, a silhueta mais pesada das três). Elas têm cor, placa, sujeira, faróis, pisca, lataria de 0 a 100, manejo, e **baú 4×3** como porta-malas — tudo pelo mesmo sistema, sem nada em paralelo.

- **O piloto é o personagem, e está DENTRO da geometria.** A moto é traçada por raio, como os carros; o piloto foi modelado junto, em sólidos (coxa, canela, bota, tronco, braço com o cotovelo para fora, luva, pescoço, cabeça). Por isso ele ganha de graça a perspectiva do minigame, a luz do trecho, a névoa da distância e a sujeira — nada disso precisou ser imitado à mão. Um piloto colado por fora erraria em todas.
- **Quem está em cima é o personagem modular, não um boneco parecido com ele.** O guarda-roupa entrega duas coisas ao veículo, e não uma: as **cores** com que o personagem está pintado agora e a **forma** do que ele está vestindo. As cores redefinem as rampas do piloto em tempo de execução (foi preciso ensinar a paleta a refazer uma rampa sem perder o id nem as variantes de luz). A forma **reconstrói o corpo dele**: cada troca de roupa joga fora a geometria das motos e monta outra.
  - **O cabelo é o do personagem**, com volume por penteado — raspado não desenha nada, o cacheado engorda a cabeça, o comprido e a trança **caem por fora das costas** (por dentro elas ficariam enterradas no tronco e não apareceriam), o rabo sai atrás, o coque sobe.
  - **O que ele veste aparece**: chapéu de aba, boné, gorro, coroa de flores; capuz **caído na nuca** (levantado só na capa e no manto, senão qualquer moletom apagava a cabeça do personagem); capa que voa aberta; mochila com alças por cima dos ombros; ombreiras; cachecol; e vestido, saia ou batina, que trocam as duas pernas por uma barra de pano.
  - **De regata, o braço é pele**; de colete sobre a regata também. Quem dá manga é o casaco, se tiver; senão a blusa; senão ninguém.
  - Tudo isso é **sólido dentro da geometria da moto**, não adesivo colado depois — por isso ganha a mesma perspectiva, a mesma luz e a mesma névoa que o resto.
- **A moto nasce SEM capacete.** O que ela tem de diferente é mostrar o personagem do jogador, e uma casca lisa por padrão jogaria isso fora. O capacete continua a um clique no mapa do mestre, moto por moto — e aí cabelo e chapéu somem debaixo dele.
- **A moto deita na curva, para o lado de quem guia.** Carro guina; moto **inclina**. A geometria ganhou um segundo giro, em torno do eixo do comprimento e da linha onde o pneu toca o chão — então a moto e o piloto se deitam como um corpo só, e o pneu continua no asfalto em vez de a moto flutuar. Quem manda na inclinação é o volante; a curva da pista entra por cima, com teto. O sinal é convenção interna (rol negativo deita para a direita, porque o z cresce para a esquerda da câmera) e convenção é o que se inverte sem ninguém notar — foi o que aconteceu: guiando para a direita ela deitava para a esquerda. Agora os testes **medem o desenho**, e não o sinal: o topo da moto está à direita ou à esquerda do pé dela?
- **Moto parada não tem ninguém em cima.** Na cena, a mesma moto é desenhada sem o piloto — quem pilota está andando pelo cenário.
- **Por dentro é outra interface.** Em vez de para-brisa, capô, volante e rádio, quem sobe na moto vê o **céu aberto** com a pista fugindo, os dois **espelhos**, o **guidão** atravessado com os punhos e as manetes, o **painel redondo** (velocímetro grande, giro pequeno, as luzes de bateria, óleo, farol e pisca) e o **tanque** entre os joelhos, na cor da moto, com a placa gravada na tampa. Os controles são os mesmos: dar a partida, partir, faróis, pisca, buzina, baú.
- **A estrada é a mesma, e o tamanho também.** Todo veículo é desenhado pela **distância** — a mesma projeção da pista —, com uma única régua convertendo unidade de modelo em unidade de estrada. Antes o enquadramento de cada classe saía de uma conta própria (a moto pela altura, o carro pela largura) e ela chegava gigante ao lado dos carros do trânsito. Agora os tamanhos relativos saem certos sozinhos, inclusive para qualquer veículo que o jogo ganhe depois.
- **A pane sabe o nome de quem parou.** Uma bicicleta furava o pneu e a tela anunciava que *o carro* parou. Cada modelo diz como se chama, com artigo e flexão (`a moto`, `da bicicleta`, `o carro quebrado`), e os avisos do minigame, os recados da viagem e o painel do destino usam isso.

### A bicicleta, e o que a batida faz com quem não tem lataria

Um modelo só, e ele **pedala**. A bicicleta entra pela mesma porta das motos — enquadra pela altura, deita na curva, leva o personagem modular em cima, tem painel de guidão — e é diferente no que precisa ser.

- **A pedalada é geometria, não um sprite trocado.** É o único veículo do jogo cuja forma muda com o tempo: o pedivela gira, e a perna deixa de ser uma pose fixa para virar uma corrente — quadril (fixo no selim) → joelho → **pé em cima do pedal, onde quer que ele esteja agora**. O joelho sai da lei dos cossenos e dobra para a frente. Oito fases por volta, cada uma construída uma vez e guardada.
- **Ela anda com a DISTÂNCIA, não com o relógio.** Quem é lento pedala devagar; quem para de andar para com o pé onde estava. A cadência sai em ~80 pedaladas por minuto na velocidade de cruzeiro, que é cadência de gente.
- **O corpo balança.** Vista de trás, a perna que sobe e a que desce são espelho uma da outra: meia volta de pedal dava o desenho idêntico e a pedalada aparecia com metade da cadência. Quem pedala de verdade rola o corpo para o lado da perna que empurra — dois pixels de balanço quebram a simetria *e* são o que faz a pedalada parecer esforço.
- **Devagar sem ser chata, e devagar de verdade.** Ela anda a ~35 km/h em vez de 180 — um quinto do carro, e bem abaixo da moto —, e a **pista encolhe junto**: mesma duração de tela, mesmo número de acontecimentos, só que devagar e com menos chão vencido. Quem conta as horas da viagem é o mapa do mestre, não o minigame. O empurrão também é o dela: aceleração e freio saem do teto do próprio veículo, senão era um motor de carro aplicado a um quinto da velocidade e a bicicleta saltava ao máximo em meio segundo, sem peso nenhum na perna. Guiar, não: a toda ela é tão ágil quanto o carro a toda — lenta basta.
- **Sem motor.** Não tem chave (o botão é *PÉ NO PEDAL*), não tem placa, o porta-malas é a **cesta** (3×2), e o som não tem ronco nenhum: fica o pneu, o vento e o **tique da corrente**, um por volta de pedal.

**Os modelos batidos.** Num carro a batida é pintura: a chapa cede e enferruja. Numa moto ou numa bicicleta quase não há chapa — o que a batida faz é **torcer o que é fino e arrancar o que é pendurado**, e isso é geometria. Três faixas (inteira até 34, batida até 69, acabada acima disso), para o estrago ler como estrago e não como tremedeira:

| | batida | acabada |
|---|---|---|
| **Moto** | guidão torto, espelho da direita pendurado, escapamento no lugar | espelho da direita **arrancado**, o da esquerda pendurado, guidão muito torto, ponteira caída, roda de trás empenada |
| **Bicicleta** | guidão torto, cesta amassada, paralama tortos, selim de lado | guidão muito torto, uma manete quebrada, aro em **oito**, cesta esmagada, refletor perdido |

*(De quebra: o dano não entrava na chave do cache da vista girada. O carro amassado na cena aparecia inteiro na estrada — agora não mais.)*

**E dói mais.** Num carro quem bate primeiro é a lataria: o para-choque amassa, o cinto segura, e o corpo leva o que sobra. De moto e de bicicleta não há lataria nenhuma — quem bate é a pessoa, e ela ainda cai e desliza no asfalto. O mesmo impacto vale **1,75×** de moto e **2,1×** de bicicleta, a ordem das partes atingidas muda (a canela e o braço vêm antes do tronco), e acima de meia força entra a **raspada no asfalto** como ferimento à parte. O **capacete** desconta a cabeça, e só ela: é exatamente para isso que ele serve, e é o que faz valer a pena o mestre marcar aquela caixinha.

### Quando o carro morre na estrada: a pane e as sete beiras

Se a lataria bate no limite **no meio da viagem**, a viagem não chega: ela **para onde estava**.

1. **Na pista**, o motor engasga três vezes e morre (som próprio), o volante fica solto, o carro **rola até parar** e escorre para o acostamento, soltando fumaça. A tela escurece só depois que ele para de vez: *O CARRO PAROU · A viagem acaba aqui, na beira da estrada*.
2. **No mapa do mestre** abre um **pedido de pane**, no mesmo lugar dos outros pedidos — mas aqui não se escolhe para onde ir, e sim **onde eles ficaram parados**. O pedido diz em que trecho foi e quanto do percurso eles venceram (*“Quebrou em neblina de madrugada · venceram 43% do percurso”*), e não tem botão de desistir: o carro já parou.
0. **Os cantos da cena, em mapa aberto.** Numa cena montada, as pontas da tela caem **fora** do mapa — a perspectiva encolhe a sala, e quem cobre aquele pedaço é a parede lateral. Numa beira de estrada não há parede, e aquele canto ficava com o **quadro anterior**: quem chegasse vindo do escritório via uma tira do assoalho de madeira dele no canto da estrada. Num mapa aberto o chão agora **continua** — a linha é repetida para os lados até encher a tela, que é o que o campo faz de verdade além do fim do mapa.
3. **As sugestões são sete beiras de estrada novas**, uma para cada trecho do minigame, e **a do trecho em que eles estavam vem primeiro** — depois as outras seis e, por último, a oficina. Um clique cria a cena, leva o personagem para lá e **estaciona o carro quebrado do lado dele**, com a lataria acabada, o motor desligado e o que estava no porta-malas.
4. **O relógio cobra só o pedaço que eles andaram**, e as batidas do caminho doem igual.

| A beira | O que tem nela |
| --- | --- |
| **Beira de rodovia** (rodovia ao sol) | campo aberto até o horizonte, defensa metálica com olhos de gato, placa de destino e marco de quilômetro |
| **Curva da serra** (serra ao entardecer) | serra em camadas contra o céu de fim de tarde, barranco de corte com sulcos de enxurrada, pinheiros, pedra caída e a defensa amassada de quem não fez a curva |
| **Estrada de terra** | chão batido com sulcos de pneu, cerca de arame com mourão torto, porteira de sítio, árvore seca |
| **Rodovia à noite** | um poste de sódio e o resto no escuro, olhos de gato acesos na defensa, placa de destino que só se lê no farol |
| **Rodovia na chuva** | pista molhada com poça refletindo o céu, defensa enferrujada, e a cena **já nasce chovendo** |
| **Estrada na neblina** | madrugada sem luz, pinheiros que aparecem em cima da hora, cerca molhada, poste antigo piscando |
| **Entrada da cidade** | muro pichado, primeiro poste do bairro, ponto de ônibus e os prédios começando no fundo |

Cada beira é uma **cena montável de verdade** (`mestre/cenas-estrada.js`), com as peças novas de estrada (`mestre/modulos-estrada.js`): horizonte que abre o céu, pista no chão, defensa (de longe e perto da câmera), placa de rodovia, marco de quilômetro, cerca de arame, mato do acostamento, mato na frente da câmera, árvore de beira, pedra de barranco e barranco de corte. A estrada **continua para os dois lados**, com passagem de cada lado, então dá para sair da pane a pé — e a placa, o marco e a defensa se examinam, cada um com o que contam. O mestre pode editar tudo no montador, como qualquer outra cena.

## Ficha da mesa

O sistema de ficha de "O Céu tem Fome": cinco atributos em cartas de tarô, vinte e oito perícias, vitalidade ligada ao corpo do jogo, uma vela de sanidade que queima para sempre e um d20 animado. A folha usa Canvas 960×540; a árvore de habilidades tem interface HTML responsiva e pixel art por código em resolução própria.

Ela abre em dois lugares, com a mesma tela:

- **No jogo**, com **C** (ou o botão *Abrir as fichas*). A ficha ocupa a janela inteira numa camada própria e **o HUD sai da frente** — nenhum botão, painel ou barra do jogo fica por cima. **Esc** ou **C** fecha e tudo volta.
- **Na página do jogador**, `ficha.html`. É a página que o mestre manda para a mesa. O botão *Ficha para os jogadores* abre uma cópia; `pixel_art/tools/build_ficha_solo.js` gera **`Claude outputs/ficha-do-jogador.html`**, um arquivo único com tudo dentro, que se manda por Discord, e-mail ou pendrive. Abre com dois cliques, sem a pasta do jogo, sem servidor e sem internet.

### Árvore de perícias

Em **Perícias**, clique em uma perícia para abrir a árvore radial. São **28 nós visuais**, um por perícia, em quatro setores: **Cosmo** azul, **Senso** vermelho, **Substância** verde e **Máquina** dourada. O olho violeta central é decorativo. Taumaturgia continua na ficha e não possui setor de perícias.

Cada nó tem uma ilustração própria de **64×64**, desenhada por código, dentro de uma moldura de **96×96**. As três marcas indicam Treinada, Veterana e Expert. A planta mede 1200×1200, com centro em 600×600, raios de 360 e 510 e seis graus entre setores. As ramificações são decorativas; perícias diferentes não dependem umas das outras.

A visão geral se ajusta à janela. **Aproximar**, **Afastar** e **Ver tudo** controlam quatro distâncias; arraste o fundo para explorar. Tab percorre os controles, as setas selecionam nós e Esc fecha a busca ou retorna à ficha. A busca oferece 28 resultados possíveis, sem repetir graus. A piscada do olho respeita movimento reduzido.

O painel mostra descrição, bônus atual e requisitos do próximo grau. **Aprender/Aprimorar** custa um ponto por grau, exige o grau anterior e atributo de pelo menos 1, 2 ou 3. **Devolver um grau** recupera um ponto sem afetar outras perícias. Expert mostra **Grau máximo**. Uma perícia aprendida continua acesa quando o próximo grau está bloqueado. **Gerenciar árvore** permite redistribuir tudo com confirmação; o mestre ajusta a reserva, que começa em 18 pontos.

Arte em `mestre/ficha-pericias-arte.js`, rasterização e molduras em `mestre/ficha-icones.js`, apresentação em `mestre/ficha-arvore-dom.js` e `.css`, regras em `ficha.js`. Não usa bibliotecas, fontes remotas ou imagens externas.

- `node pixel_art/tools/build_ficha_solo.js` atualiza `Claude outputs/ficha-do-jogador.html`, com todos os módulos e artes embutidos.
- `node pixel_art/tools/build_pericias_gallery.js` gera a prancha comparativa e os 28 SVGs em `pixel_art/generated/skill-tree/`.
- Testes: `node tests/ficha.test.js`, `node tests/arvore.test.js`, `node tests/browser-ficha.test.js` e `node tests/browser-skill-tree.test.js`. Os testes de navegador usam Playwright/Chrome; `PLAYWRIGHT_MODULE` aceita o caminho da instalação local.
- Capturas desktop, celular, zoom, jogo e pranchas 64×64/128×128 ficam em `pixel_art/generated/skill-tree/`.

### Os cinco atributos

Cada um é uma carta, com o naipe, a cor e a moldura do baralho do jogo. Clicar na carta rola o d20 daquele atributo.

| Carta | O que é | Naipe |
| --- | --- | --- |
| **TAUMATURGIA** (TMG) | a arte de realizar milagres | roxo · *o milagre* |
| **COSMO** (CSM) | inteligência e percepção | azul · *a mente* |
| **SENSO** (SNS) | carisma e vontade | vermelho · *a vontade* |
| **SUBSTÂNCIA** (SBT) | destreza e vigor | verde · *o corpo* |
| **MÁQUINA** (MQN) | força e constituição | ouro · *a força* |

**Compra de pontos:** cada atributo começa em **1** e o jogador tem **4 pontos** para distribuir. **Deixar um atributo em 0 devolve 1 ponto** — sacrificar uma parte de si é como se compra o resto. O **pico é 7**. Ao lado de cada carta a ficha escreve a consequência do número: `CD 11 · 50%`.

**Resolução:** rola-se **1d20** e cada ponto do atributo **tira 1 da dificuldade**. A **dificuldade base é do mestre** (padrão 14: atributo 0 acerta 35%, atributo 7 acerta 70% — ninguém fica seguro, ninguém fica inútil); ele ajusta na própria ficha, de 6 a 20, e o valor viaja para as páginas dos jogadores. **20 é triunfo** e **1 é desastre** — e um desastre cobra da vela.

**Perícias:** as vinte e oito, agrupadas pelos atributos novos, na segunda página (botão *PERÍCIAS* ou **Tab**). Cada uma tem quatro graus — destreinada, treinada, veterana e expert — e **cada grau tira mais 1 da dificuldade**. TAUMATURGIA não tem perícia: quem faz milagre não treina, paga.

### O que o corpo sofre

- **VITALIDADE** nasce do **vigor de SUBSTÂNCIA**: `10 + SBT×2`. Não é uma segunda barra de vida — ela **conversa com o sistema de saúde por região**: a ficha lê a condição do corpo que já existe, e o vigor **muda quanto cada região aguenta**. A régua tem dois pregos, e os dois são escolha de mesa: **SBT 1**, o ponto que todo mundo tem de graça, é o **corpo inteiro (100%)**, e **SBT 7**, o pico do atributo, **fecha em 300%** — o triplo. Entre eles a reta sobe **um terço por ponto**, e desce até o único ponto abaixo do padrão: quem **zera** SUBSTÂNCIA para comprar outra coisa fica com **67%** — o sacrifício custa um terço de si.

| SBT | 0 | **1 (padrão)** | 2 | 3 | 4 | 5 | 6 | **7 (pico)** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Quanto cada região aguenta | 67% | **100%** | 133% | 167% | 200% | 233% | 267% | **300%** |

  Isso muda o **teto**, e não a saúde: um corpo de 300 inteiro está tão sadio quanto um de 100 inteiro — só tem três vezes mais o que perder. Por isso **tudo que lê o corpo lê em fração**: a condição (o crachá, a barra, a ficha e a lista do elenco) é quanto deste corpo ainda está de pé; o mancar começa quando a perna cai abaixo de **45% dela**; a visão é a porcentagem do próprio olho; e o piso da fome é os **%** que o painel promete. Régua fixa num teto que deixou de ser fixo é bug silencioso: um `< 100` chegou a pintar de cego o olho de quem nunca levou um arranhão, e a atrasar a perna de quem estava inteiro. O pico, note, só se alcança **sacrificando** outros dois atributos até zero — o corpo de 300 é de quem abriu mão de ser outra coisa.

- **SANIDADE** é uma **vela de seis pontos**, com a chama em quatro estágios (alta, baixa, bruxuleando, apagada). Quando apaga, o personagem **não morre**: ganha uma **MARCA** permanente, o **teto da vela cai 1 para sempre** e ela reacende pela metade. As marcas ficam escritas na ficha e nunca saem.
- **CORRUPÇÃO** sobe com o **milagre**, que cobra dos dois lados: um ponto de vela agora e um ponto de corrupção para sempre. A corrupção pilota o renderizador — grão, scanlines, a carta de TAUMATURGIA tremendo — e, no alto, **a ficha passa a mentir**: números trocam por um instante.

### O d20

O número é sorteado **antes** da animação: a animação é encenação, não mecânica, e por isso o clique pode **pular** sem trapaça. São ~61 quadros — antecipação, arremesso com troca de face a cada dois quadros, desaceleração com esperas crescentes, dois quiques, assentamento, três quadros de congelamento com clarão e a revelação com o número passando do tamanho e voltando. O dado é um hexágono com o triângulo do meio de ponta para baixo e três faces em volta — a silhueta fica parada e só a repartição de claro e escuro muda, que é o que o olho lê como rotação. O número é **contornado**, e não chapado: ele cai sobre facetas claras e escuras conforme o dado gira, e só o contorno o deixa legível nas duas. A sombra embaixo encolhe e se esgarça quando ele sobe. Sucesso é seco; falha é suja e treme a tela.

### A arte

Nove cores e nada mais, tiradas das cartas do baralho pixel a pixel: seis da moldura magenta, iguais em todo naipe, e três do naipe. As figuras são desenhadas numa tela **três vezes maior** e trazidas de volta por um **filtro de maioria com peso no centro, na luz e na raridade** — detalhe fino sobrevive, pixel solto é descartado e nenhuma cor fora da paleta é inventada.

Desenhar grande e diminuir só funciona com três regras, e foi o que custou:

**Espessura é em pixels da tela grande.** Uma linha de 1 px desenhada em triplo vira um terço de pixel na redução: some, ou pior, vira chuvisco. Por isso todo traço, anel e cápsula recebe a espessura em `F` — `F` é um pixel no resultado, `2F` são dois. A faixa de meio-tom do sombreamento e a espessura do contorno e da oclusão também crescem com `F`, senão em triplo a figura vira só claro e escuro sem meio.

**Sobre o breu, a escada de tons é invertida.** O tom escuro de cada naipe é quase preto: ele serve de sombra *dentro* de uma forma acesa e nunca de traço solto no escuro — raiz, arco ou cinta desenhada nele simplesmente não existe na carta. Então a silhueta nasce no tom **vivo**, o brilho é a faixa estreita que a luz pega e o meio é a sombra. Pintar a silhueta no meio, como se pinta no claro, afunda a figura no preto da janela.

**A silhueta primeiro, e o vão é vazio.** Cada figura se desenha na ordem: a forma inteira num tom só, o volume de uma luz só (cima à esquerda, terminador ondulado), os vãos **cavados depois do volume** — e cavados de verdade, em vazio, não pintados de preto, senão a luz de borda não acha a silhueta e os quatro dedos voltam a ser um bloco —, a gravura, e a luz de borda por último, numa camada à parte para não acender o que está atrás. No máximo quatro acentos, cada um com corpo: acento fino demais não é acento, é sujeira.

**As cinco figuras são animadas.** Cada uma tem um ciclo de dezesseis quadros: a auréola da TAUMATURGIA respira e o olho da palma pisca; o olho de COSMO fecha inteiro por um instante, a íris gira e o poço ondula; o coração de SENSO **bate duas vezes** — a segunda mais fraca, como coração de verdade —, a chama da vela treme e a gota escorre; a planta de SUBSTÂNCIA balança e uma seiva acesa desce de vértebra em vértebra; e no punho de MÁQUINA um reflexo atravessa o metal acendendo o nó e o rebite por onde passa, com as brasas subindo do pulso. Os cinco correm em **compassos diferentes** de propósito, e a corrupção acelera todos.

Isso custa quase nada: cada quadro nasce uma vez, passa pelo pipeline de 3× e fica guardado. Como só **um desenho novo por quadro de tela** é permitido, os oitenta quadros nascem espalhados ao longo do primeiro ciclo e o pior quadro fica em 10 ms, com folga nos 16 que os 60 fps dão.

O resto também se mexe: as cartas são **dadas na mesa** quando a ficha abre, **levantam** com o cursor em cima, **viram** quando o valor muda e **piscam** quando são roladas; a cinza desce no ar, uma lanterna atravessa a mesa e a corrupção corrói o que estiver na tela.

### Compatibilidade das perícias

A API conserva os identificadores `grau:<pericia>:<nivel>`: são **84 estados lógicos** agrupados em **28 nós visuais**. Os graus I, II e III reduzem respectivamente a dificuldade do teste em 1, 2 e 3. A mesma ilustração identifica a perícia em todos os graus.

Fichas antigas mantêm seus graus e a reserva configurada pelo mestre. Compras de brotos, veredas, marcos, milagres, enxertos, Quedas e Coroas deixam de contar como gasto. A devolução ocorre pelo recálculo do saldo: a migração não acrescenta pontos à reserva e pode rodar várias vezes sem duplicar créditos. Exportação, recarga e códigos compartilhados preservam as perícias. As outras funções da ficha, incluindo os milagres de Taumaturgia, continuam separadas.

### Do jogador para o mestre

O jogador preenche e clica em **COPIAR CÓDIGO**: sai um texto de ~340 caracteres que sobrevive a qualquer mensageiro. O mestre cola com **COLAR FICHA** e a ficha entra na mesa — se já existir, atualiza no lugar. Quem chega nunca toma o palco: o **EM CENA** continua sendo escolha do mestre. E se jogador e mestre estiverem no mesmo navegador, a ficha aparece lá sozinha, sem código nenhum.

## O elenco da mesa

Cada ficha é uma **pessoa**, e cada pessoa tem **corpo**. A mesa deixou de ter uma ficha e um personagem: agora o mestre monta o elenco, põe em cena quem participa e **assume o controle** de qualquer um deles clicando com o **botão direito** no personagem, dentro da cena.

### Uma ficha, uma pessoa

Além dos atributos e das perícias, cada ficha passa a guardar o que faz dela alguém dentro do cenário:

| | |
| --- | --- |
| **Onde está** | a posição e o lado para onde olha, **por cena** — quem ficou no Escritório não aparece na estrada |
| **A aparência** | o guarda-roupa dela: cabelo, roupa, pele, olhos. Um personagem novo nasce **vestido**, com uma cara tirada do id da ficha — a mesma ficha é sempre a mesma pessoa em qualquer navegador, e duas fichas nunca saem gêmeas |
| **As feridas** | o corpo dela, região por região, com os cortes, as fraturas, o sangue, a infecção e os membros que faltam |
| **A fome e a sede** | o metabolismo dela; o ritmo e as regras continuam sendo da mesa |

**Só um desses corpos é simulado**: o do personagem **controlado**. Ele é o corpo do jogo — ragdoll, bolsa, tratamento, exploração, saúde, fome, tudo o que já existia. Os outros são **figurantes**: esqueleto próprio, respiração própria, roupa própria, de pé na mesma linha do chão, sem física e sem custo de simulação.

### Assumir o controle

Clique com o **botão direito** num personagem, dentro da cena:

- **Assumir o controle** — o corpo do jogo passa a ser o dele
- **Abrir a ficha** — a ficha dele, em tela cheia
- **Trazer para perto** — ele vem para o lado de quem você controla
- **Virar de lado** · **Tirar de cena**

Assumir é uma **troca**, e não um teletransporte: o que está no corpo agora (posição, lado, roupa, feridas, fome) vai para o registro de quem sai, e o registro de quem entra veste o corpo. Quem saiu **continua lá, de pé, onde estava** — agora como figurante, com a mesma roupa e as mesmas feridas. É por isso que dá para ir e voltar quantas vezes a cena pedir sem ninguém perder nada no caminho. O vigor de **SUBSTÂNCIA** de quem entrou passa a valer no mesmo instante: a ficha muda de dono **antes** do corpo, porque é ela que manda na resistência de cada região.

Um personagem que nunca foi jogado chega **inteiro**. Arraste qualquer um pela cena para posicioná-lo. O nome aparece acima da cabeça **só para o mestre**, e o menu também: os dois são desenhados depois do quadro que vai para a tela dos jogadores — eles veem a pessoa, não a plaquinha com o nome dela.

### A seção ELENCO no mapa do mestre

Uma linha por pessoa, com o **retrato** — o mesmo desenho que está no cenário, pelo mesmo rasterizador, para a lista nunca mentir sobre quem é quem —, o nome, onde ela está, a condição do corpo e os botões que o mestre aperta no meio de uma cena: **Assumir**, **Pôr/Tirar de cena**, **Trazer**, **Ficha** e **Excluir** (com confirmação, porque não volta). O campo do alto cria a ficha e já põe em cena.

Excluir quem está sendo controlado **não deixa o corpo órfão**: o elenco passa o corpo para outra ficha antes de apagar o registro. O limite da mesa continua sendo **doze fichas**.

Na ficha em tela cheia, o botão que dizia *POR EM CENA* agora diz o que faz — **ASSUMIR** — e ao lado aparece **+ EM CENA** para quem não está no corpo. Na página do jogador (`ficha.html`) nada disso existe: lá não há elenco, e a ficha continua sendo só a dele.

### O que custa, e por que deixou de custar

Desenhar um figurante custa ~10 ms. Cinco pessoas em cena derrubavam o jogo de 50 para **17 quadros por segundo** — inaceitável para uma mesa ao vivo. Então **o quadro é guardado por assinatura de pose**: tudo que muda o desenho — onde cada osso está, o desvio da roupa, o piscar, o olhar — vira uma chave em passos de um pixel, e dois quadros com a mesma chave reusam o mesmo desenho. Como a respiração é um ciclo, a partir da segunda volta o figurante praticamente não desenha mais nada: repete o que já tem guardado. Some-se a isso que quem está **fora do enquadramento** não anima nem desenha, e que figurante **não tem física de cabelo** — é ela que faria o desenho depender do tempo, e não só da pose. Com as três coisas, cinco pessoas em cena rodam nos mesmos quadros por segundo de uma.

A **luz**, essa sim, é aplicada a cada quadro e nunca guardada junto com o desenho: o mestre muda a luz ao vivo, e todo mundo escurece com a sala no mesmo instante.

### Arquivos e testes do elenco

- `mestre/elenco.js` — o elenco: registros, figurantes, desenho, etiquetas, teste de clique pelo alfa do desenho, a troca de corpo e o menu do botão direito. Não conhece o documento nem o canvas do jogo: quem desenha passa um contexto, e quem troca de corpo passa um adaptador (`ler()` e `vestir()`), que é o que deixa o elenco rodar em node
- `mestre/elenco-painel.js` · `mestre/elenco.css` — a seção ELENCO do mapa do mestre e o menu sobre a cena
- `app.js` — as duas metades da troca (`ler()` e `vestir()`): a única parte que conhece o corpo do jogo por dentro
- `wardrobe-ui.js` — `look()` e `vestirLook()`: a **pessoa** inteira (cabelo, barba, corpo, pele, olhos e roupa), e não só a trouxa de roupa que cabe na bolsa
- `node tests/elenco.test.js` — a mesa sem navegador: criar, pôr em cena sem pisar em ninguém, assumir e voltar com as feridas de cada um, arrastar, a parede da sala, excluir sem deixar corpo órfão, o limite de doze e a sessão que volta
- `node tests/browser-elenco.test.js` — no Chrome: a seção ELENCO e o retrato, a etiqueta acendendo sob o cursor, o menu do botão direito, assumir o controle, andar com a pessoa nova, machucá-la, voltar e conferir que o corte ficou com ela, tirar de cena, excluir com confirmação, cinco pessoas em cena acima de 30 fps e o elenco de volta depois de recarregar. Capturas em `pixel_art/generated/elenco/`

## Fome e sede na aba de saúde

Fome e sede deixaram de ser um medidor à parte: elas são o **metabolismo do corpo**, e a aba de saúde (<kbd>H</kbd>) mostra isso num bloco próprio, **NUTRIÇÃO E HIDRATAÇÃO**, com as duas barras, o estágio, quanto falta em minutos do relógio para piorar e o que a falta está fazendo no corpo agora. Nos dois sentidos:

| Fome e sede → corpo | |
| --- | --- |
| **Cicatrização** | corte fechando, osso colando e hematoma sumindo passam pelo metabolismo: com fome vão a 40%, no último estágio **param** |
| **Defesa** | desnutrida, a infecção avança até **duas vezes** mais rápido |
| **Sangue** | o corpo **repõe** o volume perdido (~1,2% por minuto) — mas só com água e comida; desidratada, não repõe nada |
| **Último estágio** | a sede tira volume de sangue e castiga os **rins**; a fome consome o corpo e o **fígado** sente primeiro — tudo com piso e desligável |

| Corpo → fome e sede | |
| --- | --- |
| **Febre** (infecção e necrose) | dá sede, e um pouco de fome |
| **Sangramento** e sangue a repor | dão **muita** sede: o corpo quer repor o volume |
| **Suspender piora** (aba de saúde) | para a fome e a sede junto |
| **Morte** | para as duas |

O estado da aba de saúde passa a dizer *Faminta*, *Sedenta*, *Desidratada* ou *Faminta e desidratada* quando é a falta que manda, e o bloco lista em uma linha cada coisa que está acontecendo (“Sem água, o corpo não repõe o sangue perdido”, “Defesa baixa: infecção avança 60% mais rápido”, “O corpo pede mais água (febre, sangue a repor): sede 84% mais rápida”).

## Comida, água e cozinhar

39 itens novos (pão francês, pão de queijo, coxinha, bolacha, paçoca, banana, laranja, goiaba, manga, ovo, queijo, presunto, leite, miojo, marmita, milho de pipoca, pó de café, açúcar, sal, óleo, boldo, suco, água de coco, garrafa PET…), cada um com ícone próprio na bolsa e com o que faz pela fome e pela sede — e as bebidas que já existiam agora matam a sede de verdade.

- **Água**: 13 fontes com interface própria — pia de banheiro, pia de cozinha, bebedouro de pressão, bebedouro de galão, torneira, filtro de barro, chafariz, bica, poço com manivela, córrego, cocho, chuveiro e **privada**. Cada uma tem qualidade (potável, duvidosa, contaminada): a duvidosa pode dar dor de barriga, a contaminada infecção intestinal, e a privada mata a sede mas dá enjoo e risco que cresce a cada gole. Dá para **encher a garrafa** (3 goles, guardando a qualidade da água) e **ferver** para limpar.
- **Cozinhar**: fogão, fogareiro, chapa, fogueira, cafeteira, micro-ondas, sanduicheira, chaleira e bancada, cada uma desenhada de perto, com o caderno de receitas ao lado, a bandeja de ingredientes vinda da bolsa, verbos grandes por passo e a **barra de ponto** CRU → NO PONTO → QUEIMADO. 11 receitas: café coado, café com leite, ovo frito, pão na chapa, misto quente, miojo, marmita no micro-ondas, pipoca, chá de boldo, água fervida e soro caseiro. Sai ★, ★★ ou ★★★ — e às vezes sai **gororoba**.
- **Conseguir comida**: geladeiras e armários com comida de verdade, carrinho de pipoca e de água de coco, estufa de lanchonete, balcão de padaria, mesa do cafezinho e ambulantes (pagos em moedas), árvores frutíferas que acabam e rebrotam com o tempo do jogo.

### Comer e beber, animado

`consumo.js` anima **28 jeitos** de levar algo à boca, e o item só sai da bolsa na hora do contato — mexer antes cancela sem gastar nada. Comer de pacote, barra, fruta, sanduíche, salgado, prato, tigela e pipoca; beber de lata (com o “pssht”), garrafa, copo, xícara (soprando antes), caixinha e coco; beber no bebedouro, na torneira com as mãos em concha, do balde do poço e **da privada** (com hesitação, nojo e ânsia); encher a garrafa; colher fruta no alto e no chão. E as reações: barriga roncando, boca seca, enjoo, vômito, tontura e arrepio. Tudo com o objeto desenhado na mão diminuindo a cada mordida, farelos, água, vapor e 26 sons feitos na hora.

### Cada coisa com a sua interface

Toda peça do jogo foi auditada para que **nada abra a interface de outra coisa** — a pia do banheiro abria como caixa de papelão, e agora abre como pia, com cuba, torneira, espelho e o armário embaixo. Oito interfaces novas entraram em `mestre/interacoes-moveis.js`: **estante** (cinco estilos, revistada prateleira por prateleira), **copiadora** (tampa, varredura, cópias, atolamento), **relógio de ponto** (cartões e o carimbo da hora), **caixa registradora** (teclas, bobina e a gaveta que salta), **leito hospitalar** (manivela, prontuário, embaixo da cama), **monitor cardíaco** (seis ritmos e alarme), **negatoscópio** (chapas de raio-X e a lupa) e **jukebox** (moeda, braço mecânico e o disco girando). Dezoito peças do montador foram apontadas para a interface certa.

### Arquivos desta fase

| Arquivo | Função |
| --- | --- |
| `mestre/cenas-prefeitura.js` | Corredor do 2º andar, Escadaria do 1º andar e Saguão do térreo |
| `mestre/cenas-prefeitura-salas.js` | Sala do arquivo, Banheiro dos funcionários e Copa |
| `mestre/cenas-jorge-predio.js` | Corredor, Porta da frente, Copa e Banheiro do prédio do Jorge |
| `mestre/cenas-ruas.js` | Praça da Prefeitura e Rua do prédio (exteriores com carro) |
| `mestre/cena-campo.js` · `mestre/cena-estrada.js` | Campo de ruínas em perspectiva e a Estrada de terra |
| `mestre/veiculos.js` | Carros em perspectiva: 3 modelos, cache, luz, sombra, a pista `veiculo` e o gancho `Veiculos.aoUsar` |
| `comidas.js` | 39 itens de comida e bebida, efeitos no corpo, garrafas e a máquina de preparo |
| `mestre/interacoes-comida.js` | Fontes de água, cozinha, servir, vendedores e árvores frutíferas, cada um com a sua interface |
| `mestre/interacoes-moveis.js` | Estante, copiadora, relógio de ponto, caixa registradora, leito, monitor cardíaco, negatoscópio e jukebox |
| `consumo.js` | Comer, beber, encher garrafa, colher e as reações do corpo: pose, objeto na mão, partículas e sons |
| `necessidades.js` | Fome e sede: estágios, automático com prazo, condições, perda de vida com piso e sessão |
| `mestre/painel-necessidades.js` | Seção **Fome e sede** do mapa do mestre e os dois ícones na tela |
| `mestre/viagem-carro.js` | Interface do carro por dentro, a saída do mapa, o pedido de destino e a chegada com o carro junto |
| `mestre/minigame-estrada.js` | O minigame de estrada em pseudo-3D: pista por segmentos, sete trechos, trânsito e clima |
| `mestre/som-estrada.js` | O som da viagem: motor por modelo com caixa de marchas, pneu, vento, as sete trilhas e o mixer do mestre |
| `porta-malas.js` | A segunda grade: a janela do porta-malas e o arrasto entre ela e a bolsa |
| `mestre/modulos-estrada.js` | As peças da beira: horizonte, pista no chão, defensa (longe e perto), placa de rodovia, marco de km, cerca de arame, mato, árvore, pedra e barranco |
| `mestre/cenas-estrada.js` | As sete beiras de estrada, uma por trecho do minigame, para as cenas de pane |
| `mestre/veiculos.js` (motos) | Os três modelos de moto, o piloto modelado em sólidos, a inclinação na curva, e as cores **e a forma** do piloto vindas do guarda-roupa |
| `mestre/veiculos.js` (bicicleta) | O quadro em tubos, a roda de raios, o pedivela girando e as pernas presas ao pedal; as três faixas de avaria de moto e bicicleta |
| `wardrobe.js` (`formaDoPiloto`) | Traduz a roupa do personagem no que se vê dele de costas: volume do cabelo, chapéu, capuz, capa, mochila, ombreiras, cachecol, saia, luvas, braço nu |

`node tests/cenas-prefeitura.test.js`, `tests/cenas-prefeitura-salas.test.js`, `tests/cenas-jorge-predio.test.js`, `tests/cenas-ruas.test.js` e `tests/cenas-campo.test.js`: cada cena nova em todas as luzes e climas, sem cinza neutro, sem buraco de parede fora das janelas, chão sem falha, arte determinística, textos desenháveis e as passagens do contrato ligadas nos dois sentidos. `node tests/veiculos.test.js`: os três modelos em salas e câmeras diferentes, a lateral com a largura projetada, a ponta trocando de lado, cache e sombra. `node tests/comidas.test.js`: itens, receitas, o preparo passo a passo, garrafas, as 13 fontes e o risco da privada. `node tests/consumo.test.js`: os 28 estilos, o item gasto só no contato, nenhum ângulo fora dos limites do rig e a mão chegando à boca. `node tests/necessidades.test.js`: os quatro estágios, o automático cumprindo o prazo, o relógio parado, os efeitos no corpo com piso e a sessão de ida e volta. `node tests/interacoes-moveis.test.js`: as oito interfaces novas desenhadas em todos os estados. `node tests/minigame-arte.test.js`: a arte do minigame nos sete trechos — a tela fecha sem buraco, **nenhuma cor fora da paleta**, o céu clareia na direção do horizonte, o campo distante perde contraste sem virar céu, quase nada de cinza neutro, os sete trechos visualmente distintos, cada peça com silhueta e três tons, e o quadro dentro do orçamento de 30 fps. `node tests/necessidades-saude.test.js`: o metabolismo escrito no corpo, a reposição de sangue só com água, a cicatrização e a infecção passando pela nutrição, a febre e o sangramento dando sede, a piora suspensa parando as duas e a ficha clínica da aba de saúde. `node tests/dano-carro.test.js`: a escada de estados da lataria, o limite em que o motor não pega mais, a lataria mudando de verdade na tela (com ferrugem só no fim e sem cinza neutro), a batida pesando pela **velocidade do impacto** e não pelo fato de bater (e de frente pesando mais que por trás, com o mesmo fechamento), o estrago tirando velocidade e puxando o carro para um lado numa reta, e o porta-malas de cada modelo. `node tests/browser-porta-malas.test.js`: no Chrome, o porta-malas abrindo ao lado da bolsa, o item indo e voltando arrastando entre as duas grades, os dois toques nos dois sentidos, o que está em uso sendo recusado, a carga morando no carro (e sobrevivendo a trocar de cena e a viajar), e o cursor da lataria, o motor que não pega e o conserto no painel do mestre. `node tests/percurso-viagem.test.js`: os quatro atalhos de percurso crescendo juntos em quilômetros, pista e relógio, o “Personalizado” respeitando os limites do minigame (e aceitando zero minuto de propósito), a escolha do pedido tendo a última palavra sobre o padrão do mestre, e a pista, os km e os minutos chegando inteiros no minigame. `node tests/som-estrada.test.js`: as sete trilhas registradas no mapa do mestre e bem formadas, o motor com as cinco marchas na ordem e a rotação caindo nas quatro trocas, a frequência de explosão batendo com a conta de cada modelo e saindo num oscilador de verdade, o cascalho mais alto fora da pista, e o mixer do mestre mandando em motor, pneus, efeitos, trilha e liga/desliga. `node tests/browser-viagem.test.js`: no Chrome, entrar no carro, girar a chave, o carro saindo do mapa, o pedido de destino no mapa do mestre com as sugestões, o percurso escolhido no pedido montando uma estrada mais longa e cobrando mais relógio (e o curto, menos, mesmo sem minigame), o minigame rodando com o modelo certo e obedecendo às setas, a chegada com o carro estacionado na cena nova, o tempo cobrado na fome, o bloco **SOM DA ESTRADA** na seção Som (trilhas, carros, cursores e a escolha ficando salva) e o bloco de nutrição na aba de saúde. `node tests/moto.test.js`: as três motos no mesmo sistema dos carros (cor, placa, dano, baú 4×3, manejo), o piloto dentro da geometria e ausente na moto parada, o capacete decidido pelo mestre mudando o desenho, as cores do personagem virando as rampas do piloto **sem tocar na tinta da moto**, a moto deitando em torno do ponto em que o pneu toca o chão (e o carro continuando sem inclinar), e o minigame inclinando com o volante e endireitando quando se solta. `node tests/browser-moto.test.js`: no Chrome, a moto no catálogo do mestre, parada sem piloto, o painel de quem está em cima dela, as cores do personagem indo para o piloto, o minigame com a moto deitando na curva e a chegada com ela junto. `node tests/transito-estrada.test.js`: o trânsito do minigame — cada trecho declarando em que tipo de via corre, ninguém andando fora de faixa nem na contramão sem motivo, a fila atrás de um carro lento, o desvio de quem está parado, a ultrapassagem que começa e termina, a freada quando não dá, e a colisão que separa em profundidade em vez de deixar um sprite por cima do outro. `node tests/pane-estrada.test.js`: o carro morrendo no meio da corrida (e a corrida parando onde estava, com `quebrou` e o quanto andaram no relatório), uma beira de estrada para cada trecho respeitando a luz, o fundo e as peças do seu mapa, a chuva nascendo chovendo, e as sugestões do pedido de pane começando pela beira do trecho certo. `node tests/browser-pane.test.js`: no Chrome, a viagem que não chega, o pedido de pane no mapa do mestre com o trecho e a porcentagem escritos, a beira daquele trecho como primeiro cartão, o carro quebrado (com a carga) estacionando lá junto com o personagem, e o kit de reparo consertando na beira. `node tests/browser-fase2.test.js`: no Chrome, a travessia do Escritório até a praça e de volta, os três carros com a dica e o gancho, beber no bebedouro, comer da bolsa (com o cancelamento preservando o item), o último estágio no corpo, o relógio do mestre comandando a fome, a pia abrindo como pia, o ícone de vida saindo da frente das interfaces e o fogão cozinhando.

### Pesquisa desta fase

- Carro em perspectiva de um ponto: a lateral perto em escala, o teto visto de cima e a ponta visível mudando de lado com a câmera — a mesma geometria dos cenários 2.5D de arcade dos anos 90.
- Comer e beber em pixel art: a sequência olhar → levar à boca → morder → mastigar → engolir → voltar, com o item encurtando a cada mordida (*Stardew Valley* come em ~2,5 s e bebe em ~2 s).
- Fome e sede com estágios e efeitos que o jogador sente antes de morrer: *Don't Starve*, *The Long Dark* e *Project Zomboid* — e a decisão de deixar o mestre no comando, como nas mesas de RPG.
- Cozinhar como minijogo curto com janela de ponto e nota no fim: a barra de ponto das fritadeiras e chapas dos jogos de restaurante.
- Água duvidosa, fervura e doença intestinal como consequência com tempo de incubação, em vez de dano imediato.
- **Pixel art profissional**: matiz deslocando entre sombra e luz, rampas de valor, paleta limitada como restrição criativa, pontilhado para degradê (e nunca em objeto pequeno ou pele), silhueta legível antes do detalhe, contorno selecionado, textura por material e leitura em 1× ([Pixnote](https://pixnote.net/en/learn/tips/), [drububu](https://drububu.com/tutorial/pixel-art-and-dithering.html)).
- **Moto em jogo de estrada com câmera atrás** (Hang-On e Super Hang-On, na Super Scaler da Sega): a leitura da curva vem quase toda da **inclinação** do conjunto moto+piloto, não da guinada; o piloto de verdade ainda se desloca para dentro da curva e mantém a cabeça mais em pé que a moto. Daí a decisão de dar à geometria um giro em torno do comprimento em vez de desenhar quadros de moto inclinada à mão.
- **Perspectiva atmosférica e camadas** ([SLYNYRD, *Landscape Pixeling*](https://www.slynyrd.com/blog/2018/11/16/pixelblog-11-landscape-pixeling) e *Plant Life*): o que está longe perde saturação e contraste e sobe na direção do horizonte; o que dá profundidade é a **sobreposição** entre planos; folhagem se abstrai em cachos com propósito, nunca folha por folha — desenhar todas vira ruído.
- **Trânsito em jogo de estrada** (OutRun e o que se escreveu sobre ele): faixa alvo separada da posição, janela de proximidade multiplicativa em z, bits de lado **vetando** o movimento em vez de empurrar, compromisso com a faixa começada para matar o tremor, carro seguindo o da frente copiando a **velocidade** (nunca a distância), e a colisão resolvida com perda de velocidade proporcional ao fechamento + separação em z + derrapagem lateral **com duração** (o `skid_counter` do OutRun) e perda de controle.
- **Pseudo-3D de estrada** (Rad Racer, OutRun, Enduro): z-map por linha de varredura, curva por acúmulo de deltas, ladeira pela altura real do segmento entrando na projeção, `maxy` escondendo o que está atrás do morro, sprites escalados por `1/z` e neblina exponencial pontilhada.
- **Fome e sede como metabolismo**, e não como um segundo medidor de vida: em *Project Zomboid* e *The Long Dark* a falta mexe na cura, na defesa e no sangue — foi esse caminho que ligou as necessidades à aba de saúde.

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
| `ficha-arvore-dados.js` | Catálogo dos quatro setores e descrições específicas das 28 perícias |
| `ficha-grafo.js` | Monta os 84 graus das 28 perícias; dependências apenas entre graus da mesma perícia |
| `ficha-planta.js` | Planta de 1200×1200 com 28 nós em dois arcos alternados, quatro setores e espaçamento livre |
| `ficha.js` | Ficha: 5 atributos 0–7 por compra de pontos, 28 perícias, vela de sanidade, corrupção, d20, o motor da carta (estados, requisitos com motivo, investimento dentro e fora, cascata, poda) e o código que vai para o mestre |
| `mestre/ficha-ui.js` | A tela da ficha em 960×540: layout, digitação, animação das cartas e o glitch da corrupção |
| `mestre/ficha-arte.js` | A arte por código: plotador de 9 cores, cartas de tarô, ícones, d20 e o redutor que guarda o detalhe |
| `mestre/ficha-dado.js` | A encenação do d20: 61 quadros, quique, congelamento e revelação, com pulo |
| `mestre/ficha-arvore.js` | O desenho da carta: 28 glifos de perícia, as formas dos oito tipos em quatro estados, as seis cartas em miniatura, o olho animado do miolo, as fatias e as arestas |
| `mestre/ficha-pagina.js` / `ficha.html` / `ficha.css` | A página que o jogador abre sozinho, e a camada da ficha dentro do jogo |
| `mestre/elenco.js` | O elenco da mesa: um registro por ficha (onde está, roupa, feridas, fome), os figurantes com esqueleto próprio, o desenho guardado por assinatura de pose, as etiquetas só do mestre, o clique pelo alfa e a troca de corpo |
| `mestre/elenco-painel.js` / `mestre/elenco.css` | A seção ELENCO do mapa do mestre, com retrato por pessoa, e o menu do botão direito sobre a cena |
| `pixel_art/tools/build_ficha_solo.js` | Monta `Claude outputs/ficha-do-jogador.html`, o arquivo único que se manda para a mesa |
| `assets.js` | Pixels dos PNGs embutidos para funcionar até por `file://` |
| `wardrobe.js` | Guarda-roupa: 85 peças (cabelos, barbas, corpo, chapéus, roupas, acessórios), tons de pele, rampas de cor, fios das peças soltas e 25 conjuntos, 14 deles os personagens das imagens |
| `itens-cena.js` | Itens soltos no cenário: física, paredes, clique/carregar/arremessar, golpe no corpo |
| `armas.js` | O taco: empunhado no ombro, golpe com E, alcance do golpe |
| `treatment-motion.js` | O gesto de usar um item: inclinar, agachar, sentar; IK dos dedos com limites; o braço que sobra |
| `pixel_art/tools/audit_treatment.js` / `audit_treatment_sheet.py` | Auditoria dos 207 gestos de tratamento com os ângulos contra os limites |
| `wardrobe-ui.js` / `wardrobe.css` | A janela do guarda-roupa em pixel art, com o personagem viva na prévia |
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

**A queda** (`png/Dead`) foi medida, não inventada: o ângulo entre o quadril e o peito de cada desenho da folha vai de 10° no primeiro a 85° no último, e essa curva está em `FALL_PITCH`. O giro é dividido entre dobrar na cintura e girar o corpo inteiro: no começo os pés ainda estão no chão e o personagem se dobra sobre eles; quando os pés saem, a raiz assume o giro e as pernas ficam para trás. Os pés que ainda sustentam peso são resolvidos por IK e não saem do lugar — o pé próximo sai no quarto desenho e o distante no sexto, como na referência. A cabeça gira menos que o peito para o rosto continuar legível até o fim.

### A batida no chão

A queda não termina quando a animação termina. O impulso do impacto é **medido**, não escolhido: o clipe são 15 desenhos segurados, então a velocidade do corpo é o que muda de um desenho para o outro, e o quadro em que o chão mata essa velocidade é a aterrissagem. Derivar a pose segurada daria um trem de picos e nada útil, por isso a medida é por desenho.

O que sai dali se espalha, cada parte no seu próprio ritmo:

- as costelas **cedem** contra o chão e voltam — cerca de um pixel, mola dura e bem amortecida, porque mais que isso deixa de parecer carne contra o piso e passa a parecer o piso engolindo;
- o corpo **desliza** e a fricção o para (≈1,7 px), e ele fica onde parou — escorregar para a frente e voltar não é como chão funciona;
- os membros **tremem** em frequências diferentes umas das outras, senão o sprite inteiro balança como um objeto só;
- o **cabelo** leva a maior parte, porque é a coisa mais solta nela: um impulso de verdade (velocidade, não força) na mecha simulada, com peso maior na ponta. Pico de 4,6 px na batida, 0,5 px depois de assentar — de bruços no chão o cabelo fica no chão, e brisa não levanta o que o chão segura;
- **a respiração perde o fôlego**: para no meio, volta curta e irregular — o próprio comprimento de cada respiração varia — e só recupera o ritmo ao longo de uns quatro segundos.

Números conferidos: nos 15 desenhos de cada clipe, nada sai da tela e nada atravessa o chão; em 900 quadros de simulação com física do cabelo, os dois clipes mantêm o cabelo inteiro e **0 pixels transparentes cercados**; o impacto dispara exatamente uma vez por queda.

Prévias: `generated/run.gif`, `generated/fall.gif`, `generated/fallcycle.gif` (queda, espera e levantar) e as folhas `generated/run_contact_sheet.png` e `generated/fall_contact_sheet.png`.

## Escolher as cores

Uma fileira de oito amostras redondas, cada uma já pintada com a cor que ela define, com o nome embaixo: **Cabelo, Olho esq., Olho dir., Faixas, Camiseta, Short, Botas, Manto**. Não há nada para ler antes de usar, a fileira dobra em duas linhas no celular em vez de virar um painel, e **escolher a cor de uma roupa veste a roupa** — escolher cor de algo invisível e não ver nada acontecer é o tipo de coisa que faz uma interface parecer quebrada.

**Como o tingimento funciona.** Uma peça não é uma cor, é uma rampa: quatro ou cinco tons que carregam o sombreamento dela, às vezes com um segundo matiz dentro — o forro quente do manto é de outra cor que o manto. Então a cor nova é aplicada como a **diferença** entre a cor escolhida e a base da rampa, em matiz, saturação e luminosidade, e todos os tons se movem por essa mesma diferença. Cada tom mantém o seu lugar no sombreamento e o segundo matiz viaja junto com o primeiro em vez de ser achatado nele. Substituir os tons por uma rampa gerada jogaria fora justamente o sombreamento com que a arte foi desenhada, que é a razão de ela ler.

**Os olhos são um pixel cada**, então são pintados um a um, não por rampa. A cor segue a íris quando o olhar a move para o outro lado da órbita — é o mesmo olho olhando para o outro lado, não outro olho —, e piscar continua fechando os dois. Tudo isso está no teste.

**Nenhuma rampa encosta no corpo.** Era o contrário no começo: o short usava `denim_light`, que é a cor da íris, e as botas usavam o couro e um tom de pele. Tingir o short teria mudado a cor dos olhos. Agora cada rampa tem os seus próprios tons, e a validação reprova se alguma voltar a dividir um índice com o corpo — a única exceção é o cabelo, que é parte do corpo por desenho.

Junto veio uma regra que faltava: **duas entradas de paleta não podem ter a mesma cor**. Todo PNG aqui é a fonte de verdade dos próprios pixels, e o *baker* volta de pixel para índice comparando a cor; duas entradas com o mesmo hex são a mesma entrada, uma delas vence em silêncio, e uma rampa construída sobre a perdedora nunca pode ser tingida. Foi exatamente o que aconteceu quando as botas pegaram emprestado o couro do rosto: uma bota tingia e a outra não. A validação agora reprova duplicatas.

Restaurar tudo é um clique em **Cores originais**, e o teste confere que devolver a cor devolve a arte pixel por pixel.

## As faixas

Um slot, `wraps`, que enfaixa o corpo do pescoço para baixo — pescoço, tronco, abdômen, quadril, braços, antebraços, coxas e canelas —, deixando livres só as mãos, os pés e a cabeça. Sem esse detalhe o personagem vira múmia; com ele lê como alguém enfaixado.

**Por baixo de tudo.** Cada roupa é pintada sobre a pele do osso em que ela pendura; as faixas também, mas **meio passo mais abaixo** (`z` do osso + 0,25 contra + 0,5 das outras). Então camiseta, short, botas e manto passam por cima delas exatamente como pano passa por cima de um curativo. O teste diz isso de forma exata: **vestir as faixas só pode substituir pele nua** — qualquer pixel que já pertencia a outra roupa tem de sair do composto sem mudar, com a camiseta, com o kit inteiro e com o manto por cima.

**Não é um desenho à parte.** As faixas são geradas a partir da silhueta de cada peça do corpo, então acompanham o membro, terminam onde ele termina e se movem com ele sem rigging nenhum a mais. O que elas acrescentam é o enfaixamento: uma tira dando voltas num membro, vista de lado, é uma sequência de faixas macias separadas pela linha sombreada onde cada volta monta sobre a anterior.

A fase de cada volta é medida nas coordenadas da folha, não a partir da borda esquerda de cada linha — uma tira enrolada no corpo é uma coisa só, então as faixas têm de bater do braço para as costelas para o quadril. Medir a partir de uma borda que muda linha a linha foi o que transformou tudo em camuflagem na primeira tentativa. A inclinação é pequena de propósito: faixas perfeitamente horizontais leem como blusa listrada, e inclinadas demais voltam a virar ruído. Passo de três pixels, uma linha de monta, e uma sujeirinha rara nas voltas que não pegam luz — pano sujo por igual lê como cor suja, pano sujo em pontos lê como pano.

A validação confere que cada pixel de faixa cai dentro da silhueta do próprio membro, que nenhuma delas encosta em mão, pé ou cabeça, e que toda roupa que pendura no mesmo osso tem `z` maior.

## O manto com capuz

Um slot de roupa novo, `cloak`, com duas camadas: `cloak_hood`, soldado à cabeça do mesmo jeito que o cabelo — mesma âncora, mesma transformação, então não tem como escorregar um pixel contra o rosto — e `cloak_body`, que pende do peito e é **simulado**.

**Fica por cima de tudo.** Até aqui toda roupa era desenhada logo atrás do osso em que ela pendura, que é onde as outras devem ficar. O manto carrega um `z` próprio e entra na mesma ordem das peças do corpo, acima da camada mais alta — sem isso o cabelo e a camiseta sairiam por cima dele. Há um teste que, com o personagem em repouso (nada girado, nada balançando), exige que **cada pixel opaco do desenho do manto** chegue intacto ao raster final.

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

O coração sobre o personagem acompanha a posição dele. Clique nele ou pressione **H** para abrir o painel; **Esc** fecha. O mapa frontal possui 19 regiões selecionáveis (incluindo os dois olhos) e mantém direita/esquerda anatômicas quando o sprite vira. Passe o mouse ou foque uma região para consultar seus ferimentos; clique para fixar a seleção e tratar. Os olhos têm branco lilás, pupila e rótulos D/E próprios.

- **Hematomas:** impactos acima de 65 unidades/s na física do ragdoll. Não provocam sangramento por si só.
- **Cortes:** impactos acima de 145 unidades/s; causam marcas na pele, gotas/manchas no cenário e perda progressiva de sangue.
- **Bandagem:** trata somente a região selecionada, estanca o sangramento e permite que o corte cicatrize lentamente. O jogo continua enquanto o painel está aberto. **Pausar saúde** congela a progressão fisiológica; pausar a animação não interrompe o relógio de saúde.
- **Desmembramento:** impactos extremos acima de 330 unidades/s em extremidades podem separar a peça atingida e seus descendentes. A ligação é removida do ragdoll, as articulações internas do membro continuam funcionando e a peça pode ser arrastada separadamente. A lesão aberta fica na região que permaneceu ligada ao corpo. Cabeça, braços, antebraços, mãos, coxas, canelas e pés podem ser separados.
- **Consequências:** lesões não fatais preservam a vida. O personagem anda mais devagar com lesões nas pernas e não pula com fraturas. Após perder partes das pernas, ou com múltiplas fraturas nas pernas sem tala, permanece em ragdoll ativo e pode se arrastar com A/D ou setas; os membros separados não recebem força dos controles. Decapitação, cérebro destruído e sangue zerado causam morte imediata. Zerar cabeça, pescoço ou tórax inicia falência progressiva, com janela crítica e agonia. Trocar de animação e restaurar a aparência não cura nem recria membros. Não há regeneração de membros; recarregue a página para iniciar outra sessão intacta.

Em **Ferramentas do mestre**, é possível aplicar hematoma, corte ou desmembramento diretamente para experimentar o sistema. Os valores são regras desta simulação, não dados médicos. Há um intervalo de proteção por região para que várias iterações do mesmo contato não multipliquem o dano. Sangue e ferimentos pertencem à sessão local; não há armazenamento entre recarregamentos.

A referência de Project Zomboid é a organização de lesões, sangramento e bandagens por parte do corpo, integrada à condição geral: [BodyPart, documentação oficial](https://projectzomboid.com/modding/zombie/characters/BodyDamage/BodyPart.html) e [BodyDamage, documentação oficial](https://projectzomboid.com/modding/zombie/characters/BodyDamage/BodyDamage.html). Hematomas por impacto, volume de sangue em porcentagem e separação física de membros são decisões deste protótipo; não são uma reprodução de todas as regras do Zomboid.

Validação: `node tests/health.test.js`. O teste de navegador `tests/browser-health.test.js` usa a mesma instalação temporária de Playwright do teste de arrastar e verifica mapa, sangue, curativo, espelhamento, desmembramento, interação com o membro separado, morte e layout móvel. As capturas ficam em `pixel_art/generated/health/`.

### HUD em pixel art, ossos e visão

Arraste o HUD pela faixa superior **ARRASTE AQUI**. O painel permanece onde foi colocado ao fechar/abrir e é limitado à janela; também pode ser movido em passos de 8 pixels com as setas quando o cabeçalho está focado. O ícone de coração continua ligado ao personagem.

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
- **Levantar era a queda de trás para a frente.** O corpo flutuava a 60° com as pernas atrás e nada embaixo. O clipe `levantar` (1,5 s) é um movimento com apoio: as mãos deslizam até embaixo dos ombros e empurram, o peito sobe, o corpo vem de quatro, um pé desce atrás e vem para a frente, os dois pés ficam embaixo do corpo num agachamento com as mãos ainda no chão, e o personagem se ergue. Os quadros de contato são resolvidos por IK no próprio rig na primeira vez em que o clipe toca, e um teste garante que nenhum pixel rígido passa do chão em nenhum instante.
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

**As peças** (85, em dez categorias). As 49 originais: cinco penteados além do original — chanel, rabo de cavalo, coque, curtinho, trança — que copiam pixel a pixel a franja, a têmpora e a mecha da bochecha desenhadas (esse é o rosto do personagem) e trocam só a massa de trás, na paleta do próprio cabelo, então a cor do cabelo tinge todos; chapéu de aba, boné, gorro, bandana, óculos, coroa de flores, tapa-olho; camiseta, regata, camisa com botões, blusa listrada, suéter de gola alta, moletom com capuz, vestido, top esportivo, armadura de couro, túnica; manto com capuz, jaqueta de couro, colete, sobretudo, capa, poncho; short, calça jeans, calça cargo, calça de moletom, legging, bermuda, saia, saia longa; botas, tênis, sandálias, botas altas, sapatilhas; faixas, cachecol, mochila, cinto, luvas, colar, ombreiras, bolsa a tiracolo. Oito tons de pele (a rampa de cinco tons da própria pele, tingida do meio-tom) e a cor dos olhos.

**As peças novas, para os personagens das imagens enviadas**: cortes masculinos pintados do zero sobre o crânio (raspado com degradê, curto social, mullet com a massa de trás no fio do rabo, cacheado curto, careca), uma categoria de **barba** (rala, cheia, cavanhaque, bigode, longa trançada — com fio de física — todas na paleta do cabelo, então a cor do cabelo tinge a barba), uma categoria de **corpo** (*forte*: ombros, peito e braços mais largos, pintados na rampa da pele, então o tom de pele tinge junto), máscara de borboleta (asas maiores que a cabeça, nervuras, o corpo sobre os olhos), elmo com chifres, óculos escuros (óculos e tapa-olho passaram para os extras, para empilhar com chapéus), scrubs de gola V, macacão de presídio com o remendo, batina com colarinho e faixa, armadura de placas com ombreiras de espigões e a gema, mortalha de fantasma (capuz, corpo, barra que pinga e some, pernas escondidas), paletó aberto no V da camisa, jaqueta militar de botões dourados, jaqueta aberta com gola contrastante, calça social, grevas de placas, gravata (com fio), corrente com cruz, coldre, luvas sem dedos, arnês de tiras, braçadeira, tatuagens, crachá, estetoscópio, cinto de ferramentas, faixa no braço. Catorze conjuntos novos no grupo **Personagens** reproduzem as imagens: Veterano, Taco rosa, Cavaleiro negro, Fantasma, Anão, Borboleta, Chapéu vermelho, Jaqueta verde, Presidiário, Regata azul, Forte, Couro vermelho, Médico e Padre.

**Roupa colada ao corpo, pano solto balançando.** Tudo o que é pintado sobre o corpo — camisas e mangas, calças, a barra das blusas, jaquetas, paletó, macacão, armaduras, luvas e correias — acompanha o osso em que está em todo quadro, pixel a pixel, sem atraso e sem fio de física. Só balança o que pende solto: saia e vestido, saia longa e batina, abas do sobretudo, capa e manto, poncho, cachecol, gravata, barba longa e a cauda da mortalha, cada um num fio preso a um ponto que segue o corpo (`CLOTH` em `wardrobe.js` guarda os fios compartilhados da barba, da gravata e da mortalha; os outros vêm com a peça). Os punhos, as barras, as dobras do cotovelo e do joelho e o vinco das costuras continuam refinados nas peças.

**Física nas peças soltas.** Saia, vestido, saia longa, sobretudo, capa, poncho, cachecol, rabo de cavalo e trança carregam um fio verlet próprio (`strands` na definição da peça), com rigidez, arrasto, dobra e vento próprios, entregue ao rasterizador como deslocamento por linha — o mesmo mecanismo do cabelo e do manto. `HairSway` aceita perfis embutidos e vento por fio, então uma peça nova não precisa mexer em `motion.js`. Um vestido esvazia a categoria das pernas (`excludes`); um penteado esconde as camadas do cabelo desenhado (`covers`); o poncho esconde os braços dentro dele.

**A janela** (`wardrobe-ui.js`) é um painel de 320×248 desenhado a 1× e mostrado ampliado, na tinta roxa do HUD, com as categorias em duas fileiras, três fileiras de ladrilhos com paginação (‹ ›) e os conjuntos em dois grupos (CONJUNTOS e PERSONAGENS): à esquerda o personagem vivo — respirando, piscando, com o cabelo e o pano se mexendo — que pode andar no lugar para julgar a física; à direita as categorias, as peças como ladrilhos recortados das próprias peças sobre uma silhueta apagada, uma fileira de cores por peça (mais um seletor livre e "original"), e os conjuntos prontos: Original, Expedição, Cidade, Inverno, Verão, Noite, Festa, Estrada, Sobrevivente, Campo e Batalha, mais os catorze personagens. SORTE sorteia. O que foi vestido fica salvo neste navegador; na primeira visita o personagem começa vestido com o conjunto Original, e a roupa vestida aparece na bolsa como um item (veja *Bolsa de suprimentos*). **G** abre, **Esc** fecha, **Restaurar aparência** despe.

Prévias: `generated/roupas.gif` (os 25 conjuntos parados, andando e correndo), `generated/roupas_contact_sheet.png`, `generated/peles.gif` (tons de pele e penteados). Validação: `node tests/guarda-roupa.test.js` (cada peça renderiza e deixa o corpo em paz, os penteados mantêm a franja pixel a pixel, tingir e destingir é exato, tom de pele não toca as roupas, vestido exclui pernas, conjuntos válidos, peças em todos os clipes e num arremesso, saia, cachecol e rabo balançam e assentam; camisa e jeans sem fio, gravata e barba longa com fio), `node tests/roupa-acompanha-corpo.test.js` (a roupa segue o corpo pixel a pixel em todo quadro) e `node tests/browser-wardrobe.test.js` (Chrome: abre em G, conjunto veste, vestido tira a calça, tinge e destinge, cabelo, pele, olhos, extras um a um, prévia andando com física, Esc, vestida na corrida, lembrada ao recarregar, sorteio e limpar; capturas em `pixel_art/generated/wardrobe/`).

"# O-Ceu-tem-fome." 
