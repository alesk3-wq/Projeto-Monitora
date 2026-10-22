# Etiquetas, Sensor de Porta, Rolagem estável e Planta larga no PC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba Planta: rolagem que não volta ao início, área da planta ocupando a tela no PC, novo equipamento "Sensor de Abertura de Porta" e etiquetas de texto com seta (editor + PDF).

**Architecture:** App vanilla JS com ES modules nativos, sem build. Estado global em `js/state.js`; cada aba é um template + `after*Render` que monta overlays absolutos (posições em % da imagem) dentro de `#plantaWrap`. Etiquetas ganham módulo próprio `js/tabs/etiquetas.js` (precedente: `js/tabs/areas.js`), e `planta.js`/`pdf.js` delegam.

**Tech Stack:** HTML/CSS/JS puros; html2canvas 1.4.1 + jsPDF 2.5.1 (PDF); teste via `test-harness.html` em Chrome headless.

**Spec:** `docs/superpowers/specs/2026-10-22-etiquetas-sensor-scroll-design.md` (ler inteiro; contexto geral em `CLAUDE.md`).

## Global Constraints

- Sem build, sem dependência nova, sem `npx` (rede corporativa quebra TLS).
- Commits direto na `master`, mensagens em pt-BR no estilo do `git log`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tudo que vai para o PDF: **sem `clip-path`, sem `object-fit`, sem SVG inline para formas** (html2canvas 1.4.1 ignora). Linhas = `<div>` rotacionada; triângulos = técnica de bordas transparentes.
- Posições na planta sempre em **% da imagem**; tamanhos de overlays em px fixos.
- Textos de UI em pt-BR. Rótulos exatos: botão **"Etiqueta"**, texto padrão **"Nova etiqueta"**, tipo **"Sensor de Abertura de Porta"**.
- Sensor: `{id:'sensor_porta', label:'Sensor de Abertura de Porta', color:'#E60000', cameraLike:false}`, antes de `outro`.
- Etiqueta (estilo): caixa `#FFF4C2` com borda `#E0A800`, texto escuro, ~12px, `max-width` ~180px; linha e seta `#333`.
- Mobile/tablet (≤1024px) sem mudança de layout.

## Como testar (todas as tarefas)

Servidor estático (já existe, fora do repo):
```bash
node "C:/Users/Alex/AppData/Local/Temp/claude/c--sk8-SGP-Projetos-claudefiles/d48355dc-2214-4c1c-891f-84970d23291b/scratchpad/serve.js" C:/sk8/SGP-Projetos/claudefiles 8765   # rodar em background; se a porta já estiver em uso, já está no ar
```
Rodar o harness:
```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --window-size=1400,900 --dump-dom --virtual-time-budget=15000 http://localhost:8765/test-harness.html 2>/dev/null | grep -E "PASS|FAIL|ERRO|AGUARDANDO"
```
Passou = nenhuma linha `FAIL`/`ERRO`/`AGUARDANDO` (a palavra `AGUARDANDO` aparecendo só dentro do `<pre>` significa que o script do harness não rodou). Novas asserções vão em `test-harness.html`, como blocos numerados novos **antes** do bloco `// 10.` (que exclui uma planta), ou num bloco final que reseta o que precisar. Para testes que precisam de imagem na planta, gerar no próprio harness um dataURL de canvas 2000×2000 (fundo branco) e esperar o `load` de `#plantaImg` antes de medir.

## Review Focus

1. **Imagem ainda não decodificada no re-render** — a rolagem restaurada não pode virar 0 só porque `#plantaWrap` tem altura 0 no instante do restore; reaplicar no `load` (Task 1).
2. **Arrastar etiqueta/ponta não pode criar pin ao soltar** — o `click` que segue o `pointerup` em cima da imagem deve ser suprimido, como já acontece com pins (Task 3).
3. **Texto com `"`, `<`, `&` e quebras de linha na etiqueta** — não pode quebrar a lista, a caixa nem a página do PDF (Tasks 3 e 4).
4. **`.json` antigo sem `etiquetas`** e **upload de nova imagem/PDF de planta** — tem que importar com `etiquetas:[]` e limpar as etiquetas no re-upload (Task 3).
5. **Ponta da seta em cima da caixa (distância ~0)** — `atan2(0,0)` e linha de comprimento 0 não podem gerar `NaN` no CSS nem erro no PDF (Tasks 3 e 4).

---

### Task 1: Rolagem estável + planta larga no PC + harness de volta a funcionar

**Files:**
- Modify: `js/tabs/plantaPdf.js:9-10` (guarda `pdfjsLib`)
- Modify: `js/nav.js` (`renderContent`)
- Modify: `js/tabs/planta.js` (`zoomPlanta`, `resetZoom`, listener `load` em `afterPlantaRender`)
- Modify: `css/style.css` (`#content.wide`, altura do `#plantaScroll` em tela larga)
- Test: `test-harness.html`

**Interfaces:**
- Produces: nenhum export novo obrigatório. Opcional: helper interno em `nav.js` para salvar/restaurar rolagem.

- [ ] **Step 1: Destravar o harness.** Em `plantaPdf.js`, só configurar `pdfjsLib.GlobalWorkerOptions.workerSrc` se `window.pdfjsLib` existir; nas funções que usam PDF.js, se `pdfjsLib` não existir mostrar `showToast('Não foi possível carregar o leitor de PDF. Verifique a conexão e recarregue a página.')` e sair. Rodar o harness → as 14 asserções antigas devem dar PASS (prova que o harness voltou a rodar).

- [ ] **Step 2: Escrever os testes que falham** (bloco novo no harness):
  - `rolagem preservada ao adicionar pin`: com imagem 2000×2000 carregada, `state.planta.zoom=200`, `switchTab('planta')`, aguardar load, setar `#plantaScroll.scrollLeft=500; scrollTop=400`, chamar `window.selectTipo('dome')` (re-renderiza), aguardar um frame → `scrollLeft===500 && scrollTop===400` (tolerância ±2).
  - `rolagem zera ao trocar de planta`: com 2 plantas, setar scroll, `window.selectPlanta(outro índice)` → `scrollLeft===0 && scrollTop===0`.
  - `zoom ancora no centro`: com scroll setado, guardar a fração do centro visível `fx=(scrollLeft+clientWidth/2)/wrap.offsetWidth` (idem `fy`), chamar `window.zoomPlanta(20)` → a nova fração do centro difere menos de 0.01 da anterior.
  - `content largo só na Planta`: `switchTab('planta')` → `#content` tem a classe `wide`; `switchTab('projeto')` → não tem.

- [ ] **Step 3: Rodar o harness** → esses 4 FAIL.

- [ ] **Step 4: Implementar.**
  - `renderContent()`: guardar a aba e o `plantaAtiva` do último render (variáveis de módulo). Se a aba atual é `planta` **e** é a mesma do último render **e** `plantaAtiva` não mudou: antes do `innerHTML`, ler `scrollLeft/scrollTop` do `#plantaScroll` e `window.scrollY`; depois de `afterPlantaRender()`, reaplicar. Se `#plantaImg` não estiver `complete`, reaplicar também no `load` da imagem. Em qualquer outro caso, não restaurar.
  - `renderContent()` aplica `#content.classList.toggle('wide', currentTab==='planta')`.
  - `zoomPlanta(delta)` / `resetZoom()`: antes de mudar o zoom, calcular a fração do centro visível de `#plantaScroll` (como no teste); depois do `renderContent()`, setar `scrollLeft = fx*wrap.offsetWidth - clientWidth/2` (idem top). Se a imagem não estiver carregada, fazer isso no `load`.
  - CSS: `#content.wide{max-width:none;}`; e para telas largas (`@media (min-width:1025px)`), `#plantaScroll{max-height:max(560px, calc(100vh - 140px));}`. O breakpoint mobile (`max-width:1024px`) segue como está.

- [ ] **Step 5: Rodar o harness** → todos PASS.

- [ ] **Step 6: Smoke visual** — `chrome --headless=new --window-size=1600,900 --screenshot=<scratchpad>/planta-wide.png` em `http://localhost:8765/` não exercita a aba (abre em Dados do Projeto); basta confirmar que o `index.html` ainda renderiza os 7 `class="navbtn"` via `--dump-dom`.

- [ ] **Step 7: Commit** — `Planta: rolagem preservada ao editar/zoom ancorado no centro, área da planta usa a tela inteira no PC; harness volta a rodar sem PDF.js`

---

### Task 2: Sensor de Abertura de Porta

**Files:**
- Modify: `js/constants.js` (`EQUIP_TYPES`, `ICONS`)
- Test: `test-harness.html`

**Interfaces:**
- Produces: tipo `sensor_porta` em `EQUIP_TYPES` e `ICONS.sensor_porta`.

- [ ] **Step 1: Testes que falham:**
  - `sensor na toolbar`: `switchTab('planta')` → existe `.type-btn` cujo texto contém `Sensor de Abertura de Porta`.
  - `sensor antes de Outro`: índice de `sensor_porta` em `EQUIP_TYPES` === índice de `outro` − 1.
  - `sensor gera item na Estrutura`: pin `{tipoId:'sensor_porta', label:'Sensor de Abertura de Porta', qtd:1, x:5, y:5}` numa planta, `window.importFromPlanta()` → algum item com nome contendo `Sensor de Abertura de Porta — Ponto`.

- [ ] **Step 2: Rodar** → FAIL.

- [ ] **Step 3: Implementar** — entrada exata das Global Constraints; SVG 16×16 `viewBox="0 0 24 24"`, `stroke="white"`, mesmo padrão dos outros: porta (retângulo vertical + maçaneta) + dois retângulos curtos lado a lado no batente (sensor magnético). Conferir com `grep` que nenhum outro arquivo lista tipos à mão.

- [ ] **Step 4: Rodar** → PASS.

- [ ] **Step 5: Commit** — `Novo equipamento: Sensor de Abertura de Porta (ícone vermelho)`

---

### Task 3: Etiquetas no editor (modelo, persistência, toolbar, desenho, arraste, lista)

**Files:**
- Create: `js/tabs/etiquetas.js`
- Modify: `js/utils.js` (`escHtml`), `js/state.js` (`novaPlanta`), `js/persistence.js` (default), `js/tabs/planta.js` (toolbar, clique, lista, `removePlanta`, upload), `js/tabs/plantaPdf.js` (limpar etiquetas no upload), `js/main.js` (expor funções no `window`), `css/style.css` (alvo de toque maior da ponta em `pointer: coarse`)
- Test: `test-harness.html`

**Interfaces:**
- Produces (usados pela Task 4):
  - `escHtml(s: any) -> string` em `js/utils.js` — escapa `& < > " '`; `null/undefined` → `''`.
  - Formato de dado: `planta.etiquetas: [{texto:string, x:number, y:number, ax:number, ay:number}]` — `x,y` canto sup.-esq. da caixa, `ax,ay` ponta da seta, tudo em % da imagem.
  - Em `js/tabs/etiquetas.js`:
    - `novaEtiqueta(ax:number, ay:number) -> {texto,x,y,ax,ay}` — texto `'Nova etiqueta'`, caixa em `x=clamp(ax+6, 0, 90)`, `y=clamp(ay-8, 0, 95)`.
    - `tplEtiquetaRows() -> string` — linhas da lista (classe `pinrow`, rótulo `E1..En`, `<input class="etiqueta-texto" id="etqtxt-{i}">` com `value` escapado e `oninput` que grava `texto` e atualiza a caixa via `textContent` sem re-render, botão ✕ → `removeEtiqueta(i)`).
    - `renderEtiquetas(wrap: HTMLElement) -> void` — remove e recria os elementos `.etq-*` da planta ativa.
    - `removeEtiqueta(i:number) -> void` (re-renderiza).
    - `etiquetaDragAtivo() -> boolean` (para o pinch ignorar, como `areaDragAtivo`).
    - Geometria compartilhada com o PDF: `etqGeom(boxX, boxY, boxW, boxH, tipX, tipY) -> {x1,y1,len,ang}` (px; linha do centro da caixa até a ponta; `len=0, ang=0` se coincidirem).

- [ ] **Step 1: Testes que falham:**
  - `novaPlanta tem etiquetas`: `novaPlanta('X').etiquetas` é array vazio.
  - `escHtml`: `escHtml('a"<b>&\'') === 'a&quot;&lt;b&gt;&amp;&#39;'` e `escHtml(null)===''`.
  - `import sem etiquetas`: replicar o normalizador de `persistence.js` num objeto `{plantas:[{pins:[]}]}` → `etiquetas` vira `[]` (ou, melhor, extrair o normalizador para uma função exportada `normalizarProjeto(obj)` em `persistence.js` e testá-la direto — escolha do implementador; se extrair, o teste chama ela).
  - `botão Etiqueta na toolbar`: existe `.type-btn` com texto `Etiqueta`; `window.selectTipo('etiqueta')` → ele fica `.active`.
  - `clique cria etiqueta`: com imagem carregada e tipo `etiqueta`, disparar `click` em `#plantaImg` com `clientX/Y` no centro do rect → `state.planta.etiquetas.length===1`, `pins.length` inalterado, `ax≈50, ay≈50` (±1), texto `'Nova etiqueta'`, e `document.activeElement.id==='etqtxt-0'`.
  - `etiqueta renderiza`: há 1 elemento `.etq-box` em `#plantaWrap` com `textContent==='Nova etiqueta'`, e 1 `.etq-tip`.
  - `texto perigoso não quebra`: setar `texto='porta "fantasma" <x>'`, re-render → `#etqtxt-0.value` é exatamente esse texto e `.etq-box.textContent` também.
  - `etiqueta não vira equipamento`: após `importFromPlanta()`, nenhum item da Estrutura contém `Nova etiqueta`/`fantasma`; na aba Gerar, o contador de pontos não mudou; na aba equipamentos o número de fichas não mudou.
  - `ponta sobre a caixa`: `etqGeom(10,10,100,40, 60,30)` retorna números finitos e `len===0`.

- [ ] **Step 2: Rodar** → FAIL.

- [ ] **Step 3: Implementar dados e escape** — `escHtml`, `etiquetas:[]` em `novaPlanta`, default no import (`if(!pl.etiquetas) pl.etiquetas = []`), `etiquetas=[]` nos dois fluxos de upload (`handlePlantaUpload` e `plantaPdf.js`), `removePlanta` conta etiquetas no "tem conteúdo".

- [ ] **Step 4: Implementar toolbar, clique e lista em `planta.js`** — botão "Etiqueta" depois de "Demarcar Área" (mesma marcação, `icon-dot` com fundo `#E0A800` e um 🏷 ou SVG simples); no `img.onclick`, `selectedTipo==='etiqueta'` → `push(novaEtiqueta(x,y))`, `renderContent()`, depois `focus()` + `select()` no `#etqtxt-{novo índice}`; a mensagem "Nenhum equipamento posicionado ainda" considera `etiquetas`; `tplEtiquetaRows()` depois de `tplAreaRows()`; `afterPlantaRender` chama `renderEtiquetas(wrap)` por último; o pinch ignora o gesto quando `etiquetaDragAtivo()`.

- [ ] **Step 5: Implementar `etiquetas.js` (render + arraste)** — camadas `z-index` acima dos pins (pins usam 3/4; usar 6 para linha/seta, 7 para caixa, 8 para a bolinha da ponta). Caixa: `<div class="etq-box">` posicionada em `left:x%;top:y%`, texto via `textContent`, `white-space:pre-wrap`, `cursor:grab`, `touch-action:none`. Linha: `<div class="etq-line">` rotacionada a partir do centro da caixa (medir a caixa com `offsetWidth/Height` depois de anexar). Seta: triângulo por bordas transparentes `.etq-arrow` na ponta, girado no ângulo da linha. Bolinha `.etq-tip` (branca, borda `#333`, ~14px; 24px em `pointer: coarse`). Arraste com pointer events no `document` (padrão `startVertexDrag`): caixa move `x,y` mantendo o offset do ponto onde pegou e clamp 0–100; ponta move `ax,ay` com clamp 0–100; durante o arraste atualiza só os elementos da etiqueta (sem `renderContent`); ao soltar, suprime o próximo `click` na imagem (reusar/expor o `suppressNextClick` de `planta.js` ou equivalente dentro de `etiquetas.js` consultado pelo `img.onclick`). Arraste funciona em qualquer `selectedTipo`.

- [ ] **Step 6: Expor no `window`** (`main.js`) o que os templates chamam: `removeEtiqueta` e o handler de texto.

- [ ] **Step 7: Rodar** → todos PASS (antigos inclusive).

- [ ] **Step 8: Commit** — `Planta: etiquetas de anotação com seta (criar, arrastar caixa/ponta, editar texto, persistência)`

---

### Task 4: Etiquetas no PDF (página Mapeamento)

**Files:**
- Modify: `js/pdf.js` (`pageMapeamento`, checagem de planta vazia ~linha 278)
- Test: `test-harness.html`

**Interfaces:**
- Consumes: `escHtml` (utils), `etqGeom` (etiquetas.js), formato `planta.etiquetas` da Task 3.

- [ ] **Step 1: Testes que falham** — se `pageMapeamento` não for exportável sem efeito colateral, exportar uma função pura nova `etiquetasHtml(pl, rect) -> string` em `pdf.js` e testá-la:
  - `etiqueta no PDF`: com uma etiqueta `{texto:'porta "x" <b>', x:20,y:20,ax:40,ay:40}` e `rect={x:0,y:0,w:1000,h:500}`, o HTML contém `porta &quot;x&quot; &lt;b&gt;`, não contém `clip-path` nem `<svg`.
  - `ponta sobre a caixa no PDF`: etiqueta com `ax,ay` dentro da caixa → HTML não contém `NaN`.
  - `planta só com etiqueta não é pulada`: com 2 plantas, a segunda sem imagem/pins/cercas/áreas mas com 1 etiqueta → a condição de "pular" (extrair para `plantaVazia(pl) -> boolean` exportada, se necessário) retorna `false`.

- [ ] **Step 2: Rodar** → FAIL.

- [ ] **Step 3: Implementar** — em `pageMapeamento`, emitir `etiquetasHtml(pl, rect)` **depois** de `pinsHtml`. Posições em px: caixa em `rect.x + x/100*rect.w` etc.; a altura da caixa não é medida no PDF — estimar (ex.: 12px de fonte, `line-height` 1.35, `max-width:180px`, padding 6px 9px → altura ≈ `linhas*16+12`, com `linhas` estimado por `ceil(texto.length/26)` mais quebras `\n`) só para calcular o centro de onde sai a linha; a caixa em si é desenhada por cima, então um erro pequeno na estimativa não aparece. Linha = `<div>` rotacionada (como segmento de cerca), espessura 2px, `#333`. Seta = triângulo por bordas (`border-left/right` transparentes ~6px, `border-bottom` ~11px `#333`) centrado na ponta e rotacionado `ang+90` graus (o builder valida a orientação visualmente). Sem bolinha de arraste no PDF. Texto com `escHtml` e `white-space:pre-wrap`. Incluir `etiquetas` na checagem de planta vazia.

- [ ] **Step 4: Rodar** → PASS.

- [ ] **Step 5: Verificação visual** — gerar um PNG de uma página Mapeamento com html2canvas no próprio harness não é necessário; em vez disso, o revisor/controlador abre a ferramenta, cria 2 etiquetas (uma apontando para cima-esquerda, outra para baixo-direita) + 1 sensor, gera o PDF e confere seta apontando para o alvo, texto legível e camadas (etiqueta por cima dos pins). Se não houver como clicar (headless), registrar no relatório que a verificação visual fica para o usuário.

- [ ] **Step 6: Commit** — `PDF: etiquetas desenhadas no Mapeamento (caixa, linha e seta sem clip-path/SVG)`

---

### Task 5 (controlador, sem subagente): fechamento

- [ ] Review final da branch (todas as tarefas contra o spec).
- [ ] Atualizar `CLAUDE.md`: tipos (11 com sensor), modelo de dados (`etiquetas`), interações (etiqueta, rolagem preservada, zoom ancorado, `#content.wide`), PDF (etiquetas no Mapeamento por cima dos pins), harness, `pdfjsLib` opcional; remover limitação que deixar de valer; adicionar a nova (`escHtml` só nas etiquetas).
- [ ] Apagar spec e plano executados; commit; `git push`; `firebase deploy --only hosting`.
