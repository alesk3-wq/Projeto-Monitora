# Design — Múltiplas Plantas por Projeto

**Data:** 2026-07-08
**Status:** aprovado pelo usuário

## Decisões do usuário

- **Numeração global contínua** dos pontos, atravessando as plantas na ordem delas (Térreo: 1–4, Galpão B: 5–7). "Ponto N" continua o vínculo único entre editor → Estrutura → Mapeamento → ficha.
- **Plantas ilimitadas** ("+ Nova planta" sempre disponível; o tamanho do PDF é o limite prático).
- **"Gerar a partir da planta" cria um grupo por planta** ("Equipamentos Mapeados — Térreo", …) — a Estrutura continua sendo uma seção única (03) com lista única de materiais.

## Arquitetura: alias `state.planta` → planta ativa

`state.planta` (singular) permeia todos os módulos. Em vez de varrer tudo:

```js
state.plantas = [ { nome, imagem, zoom, pins, cercas, areas, selectedTipo, selectedAreaCat }, ... ]
state.plantaAtiva = 0
// state.planta vira GETTER não-enumerável → state.plantas[state.plantaAtiva]
```

- Todo código que opera "na planta ativa" (planta.js, areas.js, pinch, upload, drags) **continua usando `state.planta` sem mudança** — o alias resolve em tempo de acesso.
- Não-enumerável ⇒ `JSON.stringify(state)` exporta só `plantas` + `plantaAtiva` (sem duplicação).
- `setState` (import) precisa re-anexar o alias (`attachPlantaAlias(state)` exportado de state.js).
- `selectedTipo`/`selectedAreaCat` ficam **por planta** (cada planta lembra a ferramenta armada; efeito colateral aceito).

Mudam de verdade só os pontos que enxergam todas as plantas: fichas, PDF, importFromPlanta, validação, contadores.

## Comportamentos

- **Aba Planta:** mini-abas no topo (nome de cada planta + "+ Nova planta"); abaixo, input do nome da planta ativa + botão "Excluir planta" (só com ≥2 plantas; `confirm()` quando a planta tem conteúdo). Upload/zoom/pins/cercas/áreas operam na ativa. Trocar de planta cancela traçado de cerca em andamento.
- **Numeração:** `pinOffsetGlobal(plantaIdx)` = soma dos pins das plantas anteriores. Badge do pin no editor, linha da lista, itens "Ponto N", badge no Mapeamento do PDF e cabeçalho da ficha usam `offset + pi + 1`. Excluir pin/planta renumera os seguintes (comportamento já documentado no caso do pin).
- **Fichas (aba e PDF):** iteram todas as plantas em ordem; recorte usa a imagem da planta do pin (`generateCropDataURL(pin, planta)`); aba ganha subtítulo com o nome da planta quando há mais de uma.
- **PDF:** uma página de Mapeamento **por planta** (título "Mapeamento — {nome}" quando multi; plantas totalmente vazias são puladas quando multi); legenda da Estrutura agrupada por planta (subtítulo com o nome quando multi), incluindo a seção de áreas; fichas em sequência global; sumário inalterado.
- **Migração:** `.json` antigo (`planta` singular) importa como `plantas:[planta]` + defaults por planta; projeto novo nasce com "Planta 1". Export contém só o formato novo.
- **Validação:** "planta anexada" = alguma planta com imagem; fichas sem foto somadas em todas as plantas.

## Fora de escopo

- Reordenar plantas; mover pin entre plantas; escala/metragem; numeração com prefixo por planta (rejeitada — global contínua escolhida).

## Verificação

Smoke (node import + headless 7 navbtns); manual: criar 2ª planta, alternar, pins/cercas/áreas independentes por planta, números globais contínuos no editor, "Gerar a partir da planta" com um grupo por planta, PDF com 2 páginas de Mapeamento + fichas na ordem + legenda por planta, import de `.json` antigo migrando, export/import round-trip do formato novo.
