# Ornamentos do HUD

`decor_transparente/` e `9slice_frame/` são cópias dos recortes enviados pelo usuário em `hud_saude_separado`. Os originais permanecem intactos. O HUD usa os PNGs como decoração passiva, sem textos ou controles incorporados.

`divider.svg` foi desenhado manualmente em coordenadas inteiras: luas e cruz central. Substitui o recorte do divisor, que também continha fragmentos da legenda da imagem.

Os mapas corporais, marcadores e ícones dos órgãos são desenhados em SVG/matrizes de pixels nos scripts; barras, valores e controles são elementos HTML dinâmicos. Não existe dependência de serviço externo ou carregamento de fontes remotas.

## Bolsa de couro

`bag-interior.svg`, `bag-open.svg` e `bag-closed.svg` são artes vetoriais locais desenhadas em coordenadas inteiras, com `shape-rendering="crispEdges"`. O interior usa um desenho de 224 × 184 pixels; o forro interativo começa em (32, 48) e mede 160 × 96 pixels. `bag.css` mantém a grade HTML alinhada a essa área em qualquer tamanho de tela. A arte não incorpora textos nem controles.

Os PNGs antigos de mochila foram preservados, mas o inventário usa os novos SVGs de bolsa.

A bolsa mantém o couro marrom. A moldura externa e os controles usam a paleta roxa da saúde, com os mesmos ornamentos locais de luas, cruz e laterais. O forro, a grade e os tamanhos dos itens permanecem iguais.
