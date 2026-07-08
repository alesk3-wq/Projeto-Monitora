# Múltiplas Plantas — Implementation Plan

> Execução inline pelo controlador (refactor acoplado — cada etapa depende da mesma mudança de modelo), commits sequenciais verificados + review final por subagente. Spec: `docs/superpowers/specs/2026-07-08-multiplas-plantas-design.md`.

**Goal:** N plantas por projeto, cada uma com pins/cercas/áreas próprios; numeração global contínua dos pontos; uma página de Mapeamento por planta no PDF; Estrutura única com um grupo por planta no "Gerar a partir da planta".

## Constraints

- Alias `state.planta` (getter não-enumerável → planta ativa) é a espinha do refactor — código da planta ativa NÃO muda.
- Sem dependências novas; html2canvas-safe no pdf.js; funções inline no `window` via main.js; pt-BR.
- `.json` antigos migram no import; export sai só no formato novo.
- Cada commit deixa o app funcionando (verificado com node smoke + headless).

## Tasks

### MP-1 — Núcleo (js/state.js, js/persistence.js)
- state.js: `novaPlanta(nome)` (factory com todos os defaults), `attachPlantaAlias(obj)` (defineProperty getter não-enumerável, configurable), `pinOffsetGlobal(plantaIdx)`; estado inicial `plantas:[novaPlanta('Planta 1')], plantaAtiva:0` + attach.
- persistence.js (import): migração `loaded.planta → loaded.plantas=[loaded.planta]` (+ delete), defaults por planta (nome, zoom, pins, cercas, areas, selectedTipo, selectedAreaCat), clamp de `plantaAtiva`, `attachPlantaAlias(state)` após `setState`. Remove a normalização antiga de `state.planta.*`.
- Verificar: node importa state.js e `JSON.stringify(m.state)` NÃO contém `"planta"` singular mas contém `"plantas"`; `m.state.planta.pins` acessível; headless 7 navbtns.

### MP-2 — Seletor + numeração global no editor (js/tabs/planta.js, css/style.css, js/main.js)
- tplPlanta: acima do input de upload, mini-abas `.planta-tabs` (uma `.planta-tab` por planta, `active` na ativa, `onclick="selectPlanta(i)"` + botão `+ Nova planta`); linha com input do nome (`oninput` grava, `onchange` re-renderiza) e "Excluir planta" (`state.plantas.length>1`).
- Funções: `selectPlanta(i)` (cancela traçado, seta plantaAtiva, render), `addPlanta()` (push novaPlanta('Planta N+1'), ativa, render), `removePlanta(i)` (confirm quando tem conteúdo; nunca deixa 0 plantas; clamp plantaAtiva).
- Numeração: `const off = pinOffsetGlobal(state.plantaAtiva)` em tplPlanta e afterPlantaRender; badge do pin e `<b>` da linha viram `off+pi+1`.
- CSS `.planta-tabs`/`.planta-tab` (+estado active) no padrão visual dos type-btn.
- main.js: expor selectPlanta/addPlanta/removePlanta.

### MP-3 — Fichas multi-planta (js/tabs/equipamentos.js, js/pdf.js ponto de chamada)
- `generateCropDataURL(pin, planta)` — usa `(planta||state.planta).imagem`; default mantém compatibilidade até MP-4.
- tplEquipamentos: itera `state.plantas`; quando multi, subtítulo com nome da planta; ids `cropPreview-${li}-${pi}` / `cropSlider-${li}-${pi}`; handlers `handleEquipPhoto(event, li, pi, campo)` e `setCropFrac(li, pi, val)` (assinaturas mudam, nomes no window inalterados); número exibido `off+pi+1`.
- afterEquipamentosRender: por planta (sync do slider com a largura da imagem daquela planta + previews).

### MP-4 — PDF multi-planta (js/pdf.js)
- `pinsGlobais()` → `[{p, pl, li, pi}]` na ordem global.
- `pageMapeamento(pl, dims, titulo, off)`: internals usam `pl.*`; badge `off+pi+1`; título parametrizado.
- `equipamentoLegend(pl)` por planta; pageEstrutura: legenda + áreas agrupadas por planta com subtítulo do nome quando multi; vazio geral → mensagem atual.
- `gerarPDF`: crops e fichas a partir de `pinsGlobais()` (ficha usa índice global); uma página de Mapeamento por planta (pula planta totalmente vazia quando multi; single sempre emite, como hoje); `loadImageDims` por planta.
- `itemDoPonto`/`pageEquipamento` inalterados (índice já é global).

### MP-5 — Estrutura + validação + contadores (js/tabs/estrutura.js, js/validacao.js, js/tabs/gerar.js)
- importFromPlanta: um grupo por planta com itens `… — Ponto ${off+pi+1}` + cercas da planta; título com nome da planta quando multi; toast de vazio só se nenhum grupo criado.
- validacao: planta anexada = `state.plantas.some(pl=>pl.imagem)`; fichas sem foto somadas em todas.
- gerar.js: totalPins/totalFichas via `state.plantas.flatMap(pl=>pl.pins)`.

### MP-6 — CLAUDE.md + review final (fable) + push + deploy

## Verificação por task
Node smoke (`import state/nav/pdf`), headless (7 navbtns), greps direcionados; checklist manual do spec ao final (usuário/controlador via headless onde possível).
