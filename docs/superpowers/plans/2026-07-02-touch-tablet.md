# Suporte a Touch/Tablet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o posicionamento/arraste/rotação de pins na planta baixa funcionar com touch (tablet), aumentar o alvo de toque dos pins, e ajustar o layout pra não quebrar em telas de tablet.

**Architecture:** Um único arquivo (`claudefiles/index.html`, HTML+CSS+JS vanilla, sem build). Os handlers de drag trocam de Mouse Events para Pointer Events (unifica mouse/touch num código só). O layout ganha breakpoints `@media` que reorganizam a sidebar e os formulários em telas estreitas.

**Tech Stack:** HTML/CSS/JS vanilla, sem framework, sem bundler. Pointer Events API (nativa do navegador, sem lib).

## Global Constraints

- Projeto ainda não tem repositório git (usuário vai configurar depois) — os passos de "commit" do template padrão são substituídos por "salvar o arquivo" apenas. Não rodar `git commit` neste plano.
- Não há framework de testes automatizados (ferramenta client-side de arquivo único, sem servidor). A verificação de cada task é **manual**: abrir `index.html` direto no navegador e testar o fluxo, incluindo emulação de tablet via DevTools (Ctrl+Shift+M / Cmd+Shift+M, escolher um device tipo "iPad Air").
- Escopo definido no spec (`docs/superpowers/specs/2026-07-02-touch-tablet-design.md`): sem pinch-to-zoom, sem redesenho geral pra celular, sem menu hambúrguer.
- Todas as mudanças ficam em `claudefiles/index.html` — nenhum arquivo novo é criado.

---

### Task 1: Pointer Events para posicionar/arrastar/girar pins na planta

**Files:**
- Modify: `claudefiles/index.html:333-355` (criação do DOM do handle de rotação e do ícone do pin, dentro de `afterPlantaRender`)
- Modify: `claudefiles/index.html:360-415` (`startPinDrag`, `startRotateDrag`, `onPointerDrag`, `endPointerDrag`)

**Interfaces:**
- Consumes: `state.planta.pins[pi]` (`{tipoId, label, qtd, x, y, direcao, fotoLocal, fotoView}`), `typeById(id)`, `dragState`/`suppressNextClick` (globais já existentes, linha 313-314)
- Produces: mesmo comportamento de antes (arrastar pin, girar câmera), agora disparado também por `pointerdown/pointermove/pointerup` em vez de só mouse. Nenhuma função nova é exposta; `startPinDrag`, `startRotateDrag`, `onPointerDrag`, `endPointerDrag` mantêm os mesmos nomes e assinaturas (recebem `PointerEvent` no lugar de `MouseEvent`, que tem os mesmos campos `clientX`/`clientY` usados hoje).

- [ ] **Step 1: Trocar o listener do handle de rotação e adicionar `touch-action:none`**

Em `afterPlantaRender` (linha ~345), o handle de rotação:

```js
        handle.style.cssText = `position:absolute;left:calc(${p.x}% + ${hx}px);top:calc(${p.y}% + ${hy}px);width:16px;height:16px;border-radius:50%;background:#fff;border:2.5px solid ${t.color};transform:translate(-50%,-50%);cursor:grab;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.45);touch-action:none;`;
        handle.onpointerdown = (e)=>startRotateDrag(e, pi);
```

(mudanças: `touch-action:none;` adicionado ao fim do `cssText`; `onmousedown` → `onpointerdown`)

- [ ] **Step 2: Trocar o listener do ícone do pin e adicionar `touch-action:none`**

Na mesma função (linha ~352), o ícone do pin:

```js
      pin.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:3;cursor:grab;touch-action:none;`;
      pin.innerHTML = ICONS[t.id] + `<span style="position:absolute;top:-7px;right:-7px;background:#111;color:#fff;font-size:9px;font-weight:800;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${pi+1}</span>`;
      pin.onpointerdown = (e)=>startPinDrag(e, pi);
```

(mudanças: `touch-action:none;` adicionado ao `cssText`; `onmousedown` → `onpointerdown`)

- [ ] **Step 3: Trocar `mousedown`/`mousemove`/`mouseup` por `pointerdown`/`pointermove`/`pointerup` nas funções de drag**

```js
function startPinDrag(e, pi){
  e.preventDefault(); e.stopPropagation();
  dragState = {type:'move', index:pi};
  const el = document.getElementById('pinicon-'+pi);
  if(el) el.style.cursor = 'grabbing';
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
function startRotateDrag(e, pi){
  e.preventDefault(); e.stopPropagation();
  dragState = {type:'rotate', index:pi};
  const el = document.getElementById('rothandle-'+pi);
  if(el) el.style.cursor = 'grabbing';
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
```

(`onPointerDrag` no corpo continua igual — já usa `e.clientX`/`e.clientY`, que `PointerEvent` também tem. Não precisa mudar.)

- [ ] **Step 4: Trocar os `removeEventListener` em `endPointerDrag` para os mesmos nomes de evento**

```js
function endPointerDrag(){
  if(dragState){
    suppressNextClick = true;
    setTimeout(()=>{ suppressNextClick = false; }, 80);
  }
  const wasIndex = dragState ? dragState.index : null;
  dragState = null;
  document.removeEventListener('pointermove', onPointerDrag);
  document.removeEventListener('pointerup', endPointerDrag);
  if(wasIndex!==null){
    const pinEl = document.getElementById('pinicon-'+wasIndex);
    const handleEl = document.getElementById('rothandle-'+wasIndex);
    if(pinEl) pinEl.style.cursor = 'grab';
    if(handleEl) handleEl.style.cursor = 'grab';
  }
  syncPinRowControls();
}
```

- [ ] **Step 5: Verificação manual — regressão com mouse**

Abrir `claudefiles/index.html` num navegador desktop. Ir na aba "03 · Planta / Mapeamento", enviar uma imagem qualquer como planta, selecionar um tipo de equipamento tipo câmera (`bullet`), clicar na planta pra criar um pin. Confirmar:
- Arrastar o ícone do pin com o mouse reposiciona ele
- Arrastar o ponto branco ao redor gira o cone de direção
- Depois de soltar o arraste, um clique isolado na planta não cria um pin extra sem querer (checar `suppressNextClick` ainda funciona)

- [ ] **Step 6: Verificação manual — touch via DevTools**

No Chrome/Edge, abrir DevTools (F12) → toggle device toolbar (Ctrl+Shift+M) → selecionar um device tipo "iPad Air". Repetir o mesmo teste do Step 5 usando clique simulado de touch (o DevTools converte cliques do mouse em eventos de toque nesse modo). Confirmar que tocar cria pin, arrastar o pin reposiciona, e arrastar a alça gira a direção — sem a página rolar durante o arraste.

- [ ] **Step 7: Salvar o arquivo** (sem commit — repositório git ainda não configurado neste projeto)

---

### Task 2: Aumentar o alvo de toque do pin e da alça de rotação

**Files:**
- Modify: `claudefiles/index.html:339` (constante `R` dentro de `afterPlantaRender`)
- Modify: `claudefiles/index.html:345` (cssText do handle, já editado na Task 1 — só troca de tamanho)
- Modify: `claudefiles/index.html:352` (cssText do pin, já editado na Task 1 — só troca de tamanho)
- Modify: `claudefiles/index.html:428` (constante `R` dentro de `updatePinDOM`)

**Interfaces:**
- Consumes: nenhuma interface nova — só valores de tamanho/raio usados internamente por `afterPlantaRender` e `updatePinDOM`
- Produces: mesmo comportamento visual, com pin de 36px (era 30px) e alça de rotação de 20px (era 16px), raio de posicionamento da alça de 58px (era 55px)

- [ ] **Step 1: Aumentar o raio `R` em `afterPlantaRender` (linha ~339)**

```js
        const R = 58;
```

- [ ] **Step 2: Aumentar o tamanho do handle de rotação (linha ~345, editado na Task 1)**

```js
        handle.style.cssText = `position:absolute;left:calc(${p.x}% + ${hx}px);top:calc(${p.y}% + ${hy}px);width:20px;height:20px;border-radius:50%;background:#fff;border:2.5px solid ${t.color};transform:translate(-50%,-50%);cursor:grab;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.45);touch-action:none;`;
```

- [ ] **Step 3: Aumentar o tamanho do ícone do pin (linha ~352, editado na Task 1)**

```js
      pin.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:3;cursor:grab;touch-action:none;`;
```

- [ ] **Step 4: Aumentar o raio `R` em `updatePinDOM` (linha ~428)**

```js
  if(handleEl){
    const R = 58;
    const rad = (pin.direcao||0) * Math.PI/180;
    const hx = R*Math.sin(rad), hy = -R*Math.cos(rad);
    handleEl.style.left = `calc(${pin.x}% + ${hx}px)`;
    handleEl.style.top = `calc(${pin.y}% + ${hy}px)`;
  }
```

- [ ] **Step 5: Verificação manual**

Abrir `claudefiles/index.html`, ir na aba "03 · Planta / Mapeamento", posicionar um pin de câmera. Confirmar visualmente que o ícone do pin (36px) e a alça de rotação (20px, um pouco mais afastada do centro) ficaram maiores que antes, mas ainda proporcionais — a alça não deve parecer "flutuando" longe demais do pin nem colada nele. Girar a direção pelo slider da lista de pins e confirmar que o cone/alça acompanham corretamente (testa que `R` bate nos dois lugares onde é usado).

- [ ] **Step 6: Salvar o arquivo** (sem commit)

---

### Task 3: Layout responsivo para tablet

**Files:**
- Modify: `claudefiles/index.html:71` (inserir bloco `@media` novo logo antes de `</style>`, linha 72)

**Interfaces:**
- Consumes: seletores CSS já existentes (`#app`, `#sidebar`, `.brand`, `#navBtns`, `.navbtn`, `#sidebar-footer`, `#content`, `.row`) — nenhuma mudança de HTML/JS, só CSS novo dentro de `@media`
- Produces: nenhuma interface nova; layout se reorganiza sozinho conforme a largura da tela

- [ ] **Step 1: Inserir o breakpoint de tablet (`max-width: 1024px`) antes do `</style>`**

Local exato: depois da linha `.hint{font-size:12.5px;color:var(--text-mid);margin-top:-8px;margin-bottom:16px;}` (linha 71) e antes de `</style>` (linha 72), inserir:

```css
  @media (max-width: 1024px){
    #app{flex-direction:column;}
    #sidebar{width:100%;height:auto;position:static;flex-direction:row;flex-wrap:wrap;align-items:center;padding:14px 16px;}
    #sidebar .brand{border-bottom:none;border-right:1px solid var(--ui-line);margin-bottom:0;padding:0 16px 0 0;flex-shrink:0;}
    #navBtns{display:flex;flex-direction:row;flex:1;overflow-x:auto;gap:2px;}
    .navbtn{width:auto;white-space:nowrap;margin-bottom:0;}
    #sidebar-footer{margin-top:0;padding-top:0;border-top:none;flex-direction:row;flex-shrink:0;gap:8px;}
    #content{max-width:none;padding:20px 18px;}
  }
  @media (max-width: 640px){
    .row{flex-direction:column;gap:0;}
  }
```

- [ ] **Step 2: Verificação manual — tablet (1024px e abaixo)**

No Chrome/Edge DevTools, toggle device toolbar (Ctrl+Shift+M), selecionar "iPad Air" (820×1180) e depois um device menor tipo "iPad Mini" (768×1024). Confirmar:
- A sidebar aparece como barra horizontal no topo (não mais coluna lateral fixa), com os botões de navegação em linha; se não couberem todos, aparece scroll horizontal na barra
- O conteúdo principal (`#content`) ocupa a largura toda da tela, sem sobra de espaço em branco à direita nem scroll horizontal da página
- Trocar de aba pelos botões da barra horizontal continua funcionando

- [ ] **Step 3: Verificação manual — formulários em coluna (abaixo de 640px)**

Reduzir a largura simulada para algo como 600px (ex: "Galaxy S8+" no DevTools, ou digitar uma largura customizada). Ir na aba "Dados do Projeto" (usa `.row` pra campos lado a lado) e confirmar que os campos empilham em coluna única, sem espremer.

- [ ] **Step 4: Verificação manual — regressão desktop**

Redimensionar a janela (ou tirar o device toolbar) pra uma largura desktop normal (ex: 1400px) e confirmar que o layout volta ao original: sidebar fixa de 230px à esquerda, conteúdo com `max-width:1000px`.

- [ ] **Step 5: Salvar o arquivo** (sem commit)

---

## Self-Review Notes

- **Cobertura do spec:** as 3 seções do spec (`2026-07-02-touch-tablet-design.md`) mapeiam 1:1 pras 3 tasks acima — Pointer Events (Task 1), tamanho dos alvos de toque (Task 2), layout responsivo (Task 3).
- **Sem placeholders:** todo step tem o código exato a ser escrito, sem "TODO"/"similar ao anterior".
- **Consistência:** `R` é alterado nos dois lugares onde existe (`afterPlantaRender` linha 339 e `updatePinDOM` linha 428) — checado na Task 2. Os nomes de função (`startPinDrag`, `startRotateDrag`, `onPointerDrag`, `endPointerDrag`) não mudam entre tasks, só o tipo de evento escutado.
- **Fora do escopo (confirmado no spec):** pinch-to-zoom, redesenho pra celular, menu hambúrguer — nenhuma task tenta isso.
