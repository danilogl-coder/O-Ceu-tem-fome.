# Pesquisa aplicada — anatomia e pose

Consultado em 10/09/2026. As referências foram usadas para estudar construção, não como imagens a incorporar ao personagem.

- [SLYNYRD — Human Anatomy, Pixelblog 17](https://www.slynyrd.com/blog/2019/5/21/pixelblog-17-human-anatomy): construir gesto/esqueleto, depois volumes, depois acabamento. Proporções estilizadas podem favorecer leitura em sprites pequenos.
- [SLYNYRD — Realistic Human Anatomy, Pixelblog 49](https://www.slynyrd.com/blog/2024/3/25/pixelblog-49-realistic-human-anatomy): análise lateral por segmentos e comparação de alinhamentos; cotovelo próximo da altura do umbigo e punho próximo do quadril ajudam a conferir comprimentos.
- [SLYNYRD — Human Walk Cycle, Pixelblog 50](https://www.slynyrd.com/blog/2024/5/24/pixelblog-50-human-walk-cycle): estudar contato, descida, passagem e avanço; coordenar membros opostos e deslocamento vertical do corpo.

## Aplicação ao personagem

| Região | Mudança |
| --- | --- |
| Cabeça e cabelo | Arquivos preservados; cabeça passa a seguir o osso do pescoço |
| Pescoço | Peça própria, conexão da mandíbula às clavículas |
| Tórax | Volume lateral, ombro arredondado e sombreamento sem linha de camiseta |
| Abdômen | Peça própria; transição gradual entre costelas, cintura e quadril |
| Quadril | Volume arredondado, removendo o antigo retângulo do short |
| Braços | Ombro e cotovelo reposicionados; comprimentos comparados com o tronco |
| Antebraços | Afunilamento em direção ao punho; sobreposição no cotovelo |
| Mãos | Palma relaxada, polegar compacto e grupo de dedos pendente; punhos independentes |
| Coxas | Variação de espessura até o joelho e sobreposição oculta no quadril |
| Canelas | Panturrilha e tornozelo diferenciados; linha de corte do joelho suavizada |
| Pés | Perfil descalço, calcanhar/arco/ponta; ambos na mesma linha de apoio |
| Pose | Apoio principal sob o corpo e perna distante levemente avançada |

V1 corrigiu volumes e articulações. V2 deslocou a mão para evitar fusão com a coxa. V3 reduziu linhas internas excessivas, separou os pés e aplicou pequenos acentos de oclusão. A caminhada recebeu alvos de tornozelo centrados sob os quadris e menor deslocamento vertical.

## Verificação e limites

O PNG permanece RGBA 64×96 com alfa 0/255 e cores da paleta. Não há aumento ou redução da fonte. A arte mantém a escala nativa pequena da referência; dedos são um cluster legível, sem tentar articular cada falange em um punhado de pixels. Ambas as mãos são PNGs e ossos independentes dos antebraços.

`articulation_sheet.png` apresenta as 19 peças e seus pivôs. `anatomy_comparison.png` apresenta o antes e as revisões. Os testes verificam reconstrução, comprimentos ósseos, giro independente dos punhos, apoio dos pés, paleta e limites da tela.
