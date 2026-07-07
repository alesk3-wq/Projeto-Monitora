# Design — Demarcadores de Área na Planta

**Data:** 2026-07-07
**Status:** aprovado pelo usuário (brainstorming em plan mode)

## Contexto

Retângulos coloridos semi-transparentes desenhados com clica-e-arrasta sobre a planta baixa, para demarcar zonas de risco/função. Cada retângulo tem uma categoria (6 pré-definidas + "Outro" com texto livre). Decisões do usuário:

- **PDF:** retângulos sobre a planta na página de Mapeamento + legenda "Áreas Demarcadas" (cor + descrição) na página de Estrutura, junto à legenda de equipamentos.
- **Edição:** arrastar o corpo move; alça no canto inferior-direito redimensiona; ✕ na lista exclui.
- **Cores:** gradiente semântico de criticidade, definidas pelo assistente (abaixo).

## Categorias (`AREA_CATS` em `js/constants.js`)

| id | label | descrição padrão | cor |
|---|---|---|---|
| area1 | Área 1 | Área da Oficina | `#2D9CDB` |
| area2 | Área 2 | Área de livre circulação | `#27AE60` |
| area3 | Área 3 | Materiais de altíssimo valor, mas de difícil transporte e comercialização | `#9B51E0` |
| area4 | Área 4 | Materiais de fácil transporte, alto giro, mas baixo valor | `#F2C94C` |
| area5 | Área 5 | Materiais de alto valor, alto giro, mas de difícil transporte | `#F2994A` |
| area6 | Área 6 | Área crítica (prateleiras/porta-pallets com peças de alto giro, alto valor, fácil transporte e fácil comércio) | `#C0392B` (distinto do `#EB5757` da cerca) |
| outro | Outro | *(vazio — usuário digita)* | `#828282` |

## Modelo de dados

```js
state.planta.areas = [ { catId, descricao, x, y, w, h } ]  // % da imagem
state.planta.selectedAreaCat = 'area1'                      // categoria armada na paleta
```
- `descricao` pré-preenchida com a desc da categoria ao criar/trocar categoria; editável (para `outro`, placeholder "Descreva a área").
- Import de `.json` antigo defaulta `areas:[]` e `selectedAreaCat:'area1'`; trocar a planta (upload) zera `areas` junto com pins/cercas.

## Editor

- **Módulo novo `js/tabs/areas.js`** (planta.js já está grande): desenho, render, mover/redimensionar, paleta, linhas da lista. Sem ciclo de import (areas.js importa state/constants/utils/nav; planta.js importa de areas.js e delega).
- **Ferramenta:** botão "▧ Demarcar Área" na toolbar após os tipos → `selectTipo('area')` (mesmo mecanismo especial da cerca). Armada, mostra paleta de 7 chips coloridos (`selectedAreaCat`).
- **Desenhar:** pointerdown na planta inicia, pointermove mostra preview ao vivo (borda tracejada), pointerup conclui; descarta se largura ou altura < 1.5%. No touch, um dedo desenha (`#plantaScroll.modo-area{touch-action:none}` só nesse modo); pinch de 2 dedos continua (guarda `areaDragAtivo()` no touchstart do pinch).
- **Render:** `<div class="area-rect">` no `#plantaWrap`, left/top/width/height em % (invariante ao zoom/pinch), `background: cor+'38'`, borda 2px sólida, etiqueta com o label da categoria no canto. z-index 1 (abaixo dos pins).
- **Não bloquear pins:** fora do modo área, `.area-rect` tem `pointer-events:none` — pins podem ser criados/arrastados por cima. Interação com retângulos só no modo área.
- **Mover/redimensionar:** drag próprio do módulo (pointer events, mesmo padrão dos pins), clamps 0–100 e mínimo 1.5%; alça maior em `@media (pointer:coarse)`.
- **Lista:** abaixo das linhas de cerca: bolinha da cor, select de categoria (trocar re-preenche a descrição padrão), input de descrição, ✕.
- **Guardas:** `img.onclick` retorna cedo no modo área (senão criaria pin "outro"); não há estado em progresso ao trocar de ferramenta/aba (desenho é gesto único).

## PDF

- `pageMapeamento`: retângulos em px do retângulo contain-fit (helpers existentes `containRect`/`loadImageDims`), fill translúcido + borda + etiqueta; emitidos **antes** de cercas e pins (por baixo).
- `pageEstrutura`: seção "Áreas Demarcadas" na caixa de legenda existente, só quando houver áreas: quadradinho da cor + "Área N — descrição".
- `areaCatById(id)` vai em `js/utils.js` (como `typeById`), usada por areas.js e pdf.js.

## Fora de escopo

- Validação (áreas são anotação opcional — sem pendência no checklist).
- Rotação de retângulos, formas não-retangulares, fichas por área.
- Escape de HTML em `descricao` (limitação pré-existente do app inteiro, documentada).

## Verificação (manual, como o resto do app)

Desenhar/mover/redimensionar/excluir com mouse e touch emulado; trocar categoria re-preenche descrição; "Outro" com texto livre; pin criado dentro de área fora do modo área; zoom/pinch mantém retângulos; PDF com planta de proporção diferente mostra retângulos no lugar certo + legenda; export/import `.json` novo e antigo.
