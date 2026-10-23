# Numeração por tipo + Estrutura sincronizada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada tipo de equipamento numerado 1..n (contínuo entre plantas) em todo o app/PDF, e a Estrutura gerada vira uma seção viva agrupada por tipo, sincronizada com a planta.

**Architecture:** Um módulo novo `js/numeracao.js` é a única fonte de numeração (calcula de `state.plantas` na hora). Pins e cercas ganham `id` estável. A seção gerada da Estrutura é UMA entrada marcada em `state.estrutura` (`{gerado:true, descs:{}}`) que guarda só as descrições por `id`; aba e PDF a expandem em grupos por tipo na hora de renderizar.

**Tech Stack:** HTML/CSS/JS puros (ES modules, sem build); html2canvas 1.4.1 + jsPDF; `test-harness.html` em Chrome headless.

**Spec:** `docs/superpowers/specs/2026-10-23-numeracao-por-tipo-design.md` (binding; contexto em `CLAUDE.md`).

## Global Constraints
- Sem build, sem dependência nova, sem `npx`. Commits direto na `master`, pt-BR, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Numeração **por `tipoId` exato**, **contínua entre plantas** (ordem `state.plantas`, depois ordem de `pins`). Só o número aparece (sem letra/prefixo).
- Ordem dos tipos = ordem de `EQUIP_TYPES`.
- Título da ficha: `{label do tipo} — Ponto N`.
- Cabeçalho do grupo gerado: ícone do tipo + `NNx {label do tipo}` com 2 dígitos (`03x Câmera Bullet`); NN = soma de `qtd` dos pins do tipo.
- Linha do ponto: `Ponto N — {rótulo do pin}` (+ `: {descrição}` no PDF); multi-planta: `{nome da planta} — Ponto N — {rótulo}`; `(2x)` quando `qtd ≥ 2`.
- Cercas: grupo `NNx Cerca / Concertina` (ícone de cerca), linhas `Trecho N — {rótulo}` (contínuo entre plantas; prefixo da planta quando multi).
- PDF: sem `clip-path`/`object-fit`/SVG de forma em código novo do PDF (o SVG dos `ICONS` dentro de bolinha colorida já é usado na legenda e pode ser reaproveitado igual).
- Grupos manuais (`{titulo, itens}`) continuam iguais.

## Como testar
Servidor (fora do repo; se a porta 8765 já responde, já está no ar):
`node "C:/Users/Alex/AppData/Local/Temp/claude/c--sk8-SGP-Projetos-claudefiles/d48355dc-2214-4c1c-891f-84970d23291b/scratchpad/serve.js" C:/sk8/SGP-Projetos/claudefiles 8765`
Harness: `"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --window-size=1400,900 --dump-dom --virtual-time-budget=15000 http://localhost:8765/test-harness.html 2>/dev/null | grep -E "^(PASS|FAIL|ERRO)"` — passou = nenhuma linha FAIL/ERRO. Hoje: 39 PASS.

## Review Focus
1. **Trocar o tipo de um pin pela lista** (select) — números dos dois tipos se ajustam e a descrição digitada vai junto para o grupo do novo tipo (Task 2).
2. **`.json` antigo** (pins/cercas sem `id`, grupos "Equipamentos Mapeados" antigos) — abre sem erro, ids são gerados, grupos antigos viram manuais (Tasks 1 e 2).
3. **Clicar "Gerar a partir da planta" duas vezes** — nunca duplica a seção gerada (Task 2).
4. **Excluir pin no meio da sequência** — números seguintes do mesmo tipo descem, outros tipos não mudam, descrição de quem ficou continua no pin certo (Tasks 1 e 2).
5. **Projeto sem pins** / seção gerada com zero pins — Estrutura, PDF e validação não quebram nem mostram cabeçalho vazio (Task 2).

---

### Task 1: Numeração por tipo + ids estáveis (editor, Mapeamento, fichas)

**Files:**
- Create: `js/numeracao.js`
- Modify: `js/state.js` (remover uso de `pinOffsetGlobal` ou deixá-lo morto → remover se ninguém usa), `js/persistence.js` (`normalizarProjeto`: gerar `id` para pins/cercas sem), `js/tabs/planta.js` (badge + número da lista; `id` em pin/cerca novos), `js/tabs/equipamentos.js` (título/ordem das fichas), `js/pdf.js` (badge no Mapeamento; título e ordem das fichas — `pinsGlobais` passa a ordenar por tipo/número)
- Test: `test-harness.html`

**Interfaces (Produces):**
- `novoId() -> string` em `js/utils.js` — único por sessão e entre imports (ex.: `Date.now().toString(36)+Math.random().toString(36).slice(2,8)`).
- Pin: `{ id, tipoId, label, qtd, x, y, direcao, fotoLocal, fotoView, cropFrac }`; Cerca: `{ id, label, pontos }`.
- Em `js/numeracao.js`:
  - `numeroDoPin(plantaIdx:number, pinIdx:number) -> number` — número por tipo, contínuo entre plantas.
  - `pontosPorTipo() -> Array<{ tipo: <entrada de EQUIP_TYPES>, pontos: Array<{ pin, plantaIdx, pinIdx, numero }> }>` — só tipos com ≥1 pin, ordem de `EQUIP_TYPES`, pontos em ordem de número.
  - `trechosCerca() -> Array<{ cerca, plantaIdx, cercaIdx, numero }>` — numeração contínua das cercas entre plantas.

- [ ] **Step 1: Ajustar asserts antigos + novos testes (falham):**
  - Reescrever blocos 2–5 do harness: Térreo com pins `bullet, dome, bullet` e Galpão B com `bullet, fechadura`. Esperado na lista da aba Planta do Galpão B: números `3` e `1` (bullet continua do Térreo; fechadura começa em 1). Badges `#pinicon-0`/`#pinicon-1` do Galpão B com texto `3` e `1`.
  - `numeroDoPin`: Térreo → `[1,1,2]`.
  - `pontosPorTipo()` → tipos `['bullet','dome','fechadura']` nessa ordem; bullet com números `[1,2,3]`, o 3º no Galpão B.
  - Fichas: aba equipamentos contém `Câmera Bullet — Ponto 3` e **não** contém `Equipamento 4`; a ordem dos títulos na aba é Bullet 1, Bullet 2, Bullet 3, Dome 1, Fechadura 1.
  - Excluir o 1º pin do Térreo (bullet) → o outro bullet do Térreo vira 1, o do Galpão vira 2, dome continua 1.
  - Ids: pins criados por clique na planta têm `id` string não vazia e distintos; `normalizarProjeto` num objeto com pins/cercas sem `id` preenche ids distintos.
  - Bloco `// 10.` (excluir planta 2): ajustar a expectativa para os números por tipo.
  - (O bloco do Sensor que usa `importFromPlanta` e `'… — Ponto'` será reescrito na Task 2; nesta task, se quebrar, adaptar só o mínimo para continuar verificando que o sensor aparece num item gerado.)
- [ ] **Step 2: Rodar** → FAIL nos novos.
- [ ] **Step 3: Implementar** `novoId`, `numeracao.js`, ids na criação (pins em `img.onclick`, cercas em `cercaConcluir`) e no `normalizarProjeto`; trocar todos os `off+pi+1` / `pinOffsetGlobal` por `numeroDoPin`; fichas na aba e no PDF iteram na ordem de `pontosPorTipo()` (a ordem guardada em `pins` não muda); título da ficha na aba e no cabeçalho da página PDF (`pageHeader`) = número por tipo + `{tipo}{ — rótulo}` como hoje, com a numeração nova. Legenda da ficha no PDF (`itemDoPonto`) fica como está nesta task (Task 2 a substitui).
- [ ] **Step 4: Rodar** → todos PASS.
- [ ] **Step 5: Commit** — `Numeração por tipo de equipamento (contínua entre plantas) no editor, Mapeamento e fichas; ids estáveis em pins e cercas`

---

### Task 2: Estrutura sincronizada agrupada por tipo (aba + PDF + ficha + contadores)

**Files:**
- Modify: `js/tabs/estrutura.js`, `js/pdf.js` (`pageEstrutura`, legenda da ficha), `js/tabs/gerar.js`, `js/validacao.js`, `js/main.js` (expor handler novo), `css/style.css` (estilo do grupo gerado), `js/persistence.js` (se precisar normalizar `descs`)
- Test: `test-harness.html`

**Interfaces:**
- Consumes: `pontosPorTipo()`, `trechosCerca()`, ids da Task 1.
- Produces:
  - Entrada gerada em `state.estrutura`: `{ gerado:true, descs:{ [pinOuCercaId]: string } }` — no máximo uma.
  - `gruposGerados() -> Array<{ tipoId:string, titulo:string /* 'NNx Label' */, linhas: Array<{ id, texto /* 'Ponto N — rótulo' com prefixo de planta se multi e (Nx) se qtd≥2 */, desc }> }>` em `js/tabs/estrutura.js` (ou módulo próprio) — tipos de pin + grupo `cerca` por último se houver traçados; vazio se não houver nada.
  - `setDescGerada(id:string, valor:string)` exposto no `window`.

- [ ] **Step 1: Testes que falham** (substituem os antigos de `importFromPlanta`, incluindo o do Sensor e o de etiquetas que filtra `estrutura`):
  - `importFromPlanta()` com o cenário da Task 1 → `state.estrutura` ganha exatamente 1 entrada `gerado:true`; chamar de novo → continua 1 (não duplica).
  - `gruposGerados()` → títulos `['03x Câmera Bullet','01x Câmera Dome','01x Fechadura Eletrônica']` (+ `'01x Cerca / Concertina'` quando há uma cerca); linha do 3º bullet = `Galpão B — Ponto 3 — {rótulo}`; com uma só planta, sem prefixo de planta.
  - Pin com `qtd:2` → cabeçalho soma (`04x …`) e a linha contém `(2x)`.
  - Descrição: `setDescGerada(id, 'Portaria')` → aparece na linha; trocar o `tipoId` desse pin para `dome` → a linha com `Portaria` agora está no grupo Dome; excluir o pin → nenhum grupo contém `Portaria`.
  - Aba Estrutura renderiza um `.icon-dot` com o ícone do tipo em cada cabeçalho gerado e um `input` de descrição por linha; grupos manuais continuam com qtd/nome/desc editáveis.
  - Sensor: pin `sensor_porta` → existe grupo `01x Sensor de Abertura de Porta`.
  - Etiquetas não aparecem em nenhuma linha gerada.
  - Ficha ↔ item: a legenda da página da ficha (função exportada que a gera, ex. `legendaFicha(pin) -> string`) contém o texto da linha e a descrição do pin via `id`; pin sem descrição → ainda mostra a linha; sem seção gerada → string vazia.
  - `.json` antigo com grupo `{titulo:'Equipamentos Mapeados', itens:[{qtd:1,nome:'Câmera — Ponto 7',desc:''}]}` → após `normalizarProjeto`, continua grupo manual e a aba renderiza sem erro.
  - Contadores (aba Gerar) e `validarProposta()`: com só a seção gerada e pins, "Estrutura com itens" fica OK e a contagem de grupos/itens reflete os grupos gerados expandidos.
  - Seção gerada sem nenhum pin/cerca → aba mostra uma dica ("Nenhum equipamento na planta") em vez de cabeçalhos; PDF não emite cabeçalho vazio.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar dados e geração** — `importFromPlanta()`: se não existe entrada `gerado`, insere no fim de `state.estrutura`; se existe, só re-renderiza e mostra toast "A Estrutura já está sincronizada com a planta."; em ambos troca para a aba Estrutura. `gruposGerados()` conforme Global Constraints. Descrições órfãs (id sem pin) são ignoradas na renderização (podem ficar no objeto).
- [ ] **Step 4: Implementar a aba** — a entrada gerada renderiza, no lugar dela na lista, um bloco por grupo: cabeçalho somente-leitura (`.icon-dot` com `ICONS[tipoId]` na cor do tipo + título) e linhas com o texto somente-leitura + `input` de descrição (`oninput` → `setDescGerada`, sem re-render). Um botão "Remover seção gerada" remove a entrada (com `confirm` se houver descrições). Grupos manuais como hoje.
- [ ] **Step 5: Implementar o PDF** — `pageEstrutura`: grupos gerados com ícone (bolinha 20px colorida + SVG, igual à legenda) + título em negrito; linhas recuadas `texto: desc`. Legenda da ficha usa `legendaFicha(pin)` por `id` (remover `itemDoPonto`).
- [ ] **Step 6: Contadores e validação** — `gerar.js` e `validacao.js` contam grupos/itens incluindo os grupos gerados expandidos.
- [ ] **Step 7: Rodar** → todos PASS.
- [ ] **Step 8: Commit** — `Estrutura: seção gerada sincronizada com a planta, agrupada por tipo (ícone + NNx), descrição por ponto; ficha casa pelo id`

---

### Task 3 (controlador): fechamento
- [ ] Review final da branch; fix wave se necessário.
- [ ] `CLAUDE.md`: numeração por tipo (`js/numeracao.js`), ids, Estrutura sincronizada (modelo de dados `gerado/descs`), fichas, limitações (retirar "Excluir renumera — grupos gerados não renumeram"; anotar que `.json` antigos mantêm grupos antigos como manuais e perdem a legenda da ficha até gerar de novo).
- [ ] Apagar spec/plano; commit; push; `firebase deploy --only hosting`.
