# Melhorias: touch, cerca como traçado, fixes de PDF, validações e recorte adaptativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 6 itens do spec aprovado (`docs/superpowers/specs/2026-07-06-melhorias-touch-cerca-pdf-design.md`): fix dos pins deslocados no PDF, triângulos decorativos sem clip-path, validações pré-PDF, recorte adaptativo/ajustável das fichas, pinch-zoom + precisão touch na planta, e cerca/concertina como traçado de linha.

**Architecture:** App vanilla JS (ES modules nativos, sem build, sem framework). Estado global mutável em `js/state.js`; cada aba é um módulo em `js/tabs/` com template string + handlers expostos no `window` via `js/main.js` (handlers inline `onclick` exigem isso). PDF gerado por rasterização de divs 1414×1000 com html2canvas 1.4.1 + jsPDF.

**Tech Stack:** JavaScript ES modules, html2canvas 1.4.1, jsPDF 2.5.1 (CDN). Servido com `npx serve .`.

## Global Constraints

- **Sem dependências novas, sem build step.** Só ES modules nativos.
- **html2canvas 1.4.1 ignora `clip-path`, `object-fit` e tem suporte instável a SVG inline** — nada disso pode ser usado em markup que vá para `js/pdf.js`.
- **Toda função chamada em `onclick`/`oninput`/`onchange` inline PRECISA ser exposta no `window` em `js/main.js`** — esquecer isso quebra silenciosamente (ReferenceError só no console).
- **Coordenadas de pins e vértices de cerca são em % da imagem da planta** (`x`, `y` de 0–100), nunca px.
- **Textos de UI em pt-BR**, tom consistente com o existente.
- **Sem framework de teste**: cada tarefa termina com verificação manual (browser em `npx serve .`) e/ou checagem de função pura via console do DevTools usando `await import('./js/<arquivo>.js')`.
- **Compatibilidade com `.json` antigos**: nunca quebrar por chave ausente (`cercas`, `cropFrac`).
- Commits frequentes, um por tarefa, mensagens em pt-BR como no histórico do repo.

## File Structure

| Arquivo | Papel nesta feature |
|---|---|
| `js/pdf.js` (modificar) | Tasks 1, 2, 3, 7 — letterbox fix, triângulos, `solicitarGerarPDF`, cerca no mapeamento |
| `js/validacao.js` (**criar**) | Task 3 — `validarProposta()` + `CHECKS` |
| `js/tabs/gerar.js` (modificar) | Task 3 — checklist visual |
| `js/utils.js` (modificar) | Task 4 — `defaultCropFrac()` |
| `js/tabs/equipamentos.js` (modificar) | Task 4 — crop adaptativo + slider |
| `js/tabs/planta.js` (modificar) | Tasks 5, 6 — pinch-zoom, classes CSS, modo traçado |
| `js/state.js` (modificar) | Task 6 — `planta.cercas` |
| `js/persistence.js` (modificar) | Task 6 — default `cercas:[]` no import |
| `js/nav.js` (modificar) | Task 6 — cancelar traçado ao trocar de aba |
| `js/tabs/estrutura.js` (modificar) | Task 7 — cercas no "Gerar a partir da planta" |
| `js/main.js` (modificar) | Tasks 3, 4, 6 — expor funções novas no `window` |
| `css/style.css` (modificar) | Tasks 3, 5, 6 — modal, alvos coarse, cerca |

---

### Task 1: Fix — pins deslocados na página de Mapeamento do PDF (letterbox)

**Files:**
- Modify: `js/pdf.js` (função `pageMapeamento`, ~linhas 109–123; função `gerarPDF`, ~linhas 171–198)

**Interfaces:**
- Produces: `loadImageDims(src) → Promise<{w,h}|null>` e `containRect(imgW, imgH, boxW, boxH) → {x,y,w,h}` (px do retângulo efetivo do contain-fit), ambas em `js/pdf.js`. `pageMapeamento(dims)` passa a receber `dims = {w,h}|null`. **Task 7 reutiliza `containRect` e o `rect` dentro de `pageMapeamento`.**

- [ ] **Step 1: Adicionar helpers `loadImageDims` e `containRect` em `js/pdf.js`** (logo após os imports, antes de `pageShell`):

```js
function loadImageDims(src){
  return new Promise((resolve)=>{
    if(!src){ resolve(null); return; }
    const img = new Image();
    img.onload = ()=>resolve({w: img.naturalWidth, h: img.naturalHeight});
    img.onerror = ()=>resolve(null);
    img.src = src;
  });
}
// Retângulo efetivo onde background-size:contain desenha a imagem dentro da caixa
function containRect(imgW, imgH, boxW, boxH){
  const scale = Math.min(boxW/imgW, boxH/imgH);
  const w = imgW*scale, h = imgH*scale;
  return { x:(boxW-w)/2, y:(boxH-h)/2, w, h };
}
```

- [ ] **Step 2: Reescrever `pageMapeamento` para posicionar pins em px do retângulo da imagem.** Substituir a função inteira por:

```js
function pageMapeamento(dims){
  const BOX_W = PW - 128, BOX_H = 770; // container: left/right:64, height:770
  const rect = dims ? containRect(dims.w, dims.h, BOX_W, BOX_H) : {x:0, y:0, w:BOX_W, h:BOX_H};
  const pinsHtml = state.planta.pins.map(p=>{
    const t = typeById(p.tipoId);
    const left = rect.x + (p.x/100)*rect.w;
    const top = rect.y + (p.y/100)*rect.h;
    const cone = t.cameraLike ? `<div style="position:absolute;left:${left}px;top:${top}px;width:0;height:0;border-left:24px solid transparent;border-right:24px solid transparent;border-top:50px solid ${t.color}55;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(${p.direcao||0}deg);"></div>` : '';
    return `${cone}<div style="position:absolute;left:${left}px;top:${top}px;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">${ICONS[t.id]}</div>`;
  }).join('');
  return pageShell(`
    ${pageHeader('02','Mapeamento')}
    <div style="position:absolute;top:165px;left:64px;right:64px;height:770px;border-radius:8px;overflow:hidden;background:#F4F6F9;border:1px solid #E3E8EF;">
      ${state.planta.imagem ? `<div style="width:100%;height:100%;background-image:url('${state.planta.imagem}');background-size:contain;background-position:center;background-repeat:no-repeat;"></div>` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8FA3BF;font-size:14px;">Planta não anexada</div>`}
      ${pinsHtml}
    </div>
    ${footerBrand()}
  `);
}
```

- [ ] **Step 3: Em `gerarPDF`, carregar as dimensões e passar para `pageMapeamento`.** Trocar as linhas do array `pages`:

```js
  const plantaDims = await loadImageDims(state.planta.imagem);
  const pages = [
    pageCapa(), pageSumario(), pageObjetivo(), pageMapeamento(plantaDims), pageEstrutura(),
    ...state.planta.pins.map((p,i)=>pageEquipamento(p,i,equipCrops[i])),
    pagePremissas(), pageEncerramento()
  ];
```

- [ ] **Step 4: Verificar `containRect` no console.** Rodar `npx serve .`, abrir a URL, no console do DevTools — como `containRect` não é exportada, verificar via comportamento: prosseguir ao Step 5 (a verificação funcional cobre a matemática).

- [ ] **Step 5: Verificação funcional.** Anexar uma planta bem larga (ex: imagem 2000×600 — pode criar uma no Paint com um X desenhado em cada canto). Posicionar 1 pin exatamente sobre o X do canto superior-esquerdo e 1 sobre o X do canto inferior-direito. Gerar o PDF.
Expected: no PDF, os dois pins caem exatamente sobre os X (antes do fix, com imagem 2000×600 eles cairiam fora da imagem, na faixa cinza do letterbox).

- [ ] **Step 6: Commit**

```bash
git add js/pdf.js
git commit -m "PDF: corrige posição dos pins no mapeamento (letterbox do background-size:contain)"
```

---

### Task 2: Triângulos decorativos do PDF sem clip-path (quadrado rotacionado 45°)

**Files:**
- Modify: `js/pdf.js` (todas as 8 ocorrências de `clip-path:polygon(100% 0,100% 100%,0 100%)`)

**Interfaces:**
- Produces: `triDecor({size, right, top, bottom, background, opacity})` em `js/pdf.js` — devolve string HTML de um quadrado rotacionado 45° que reproduz exatamente o triângulo do antigo `clip-path:polygon(100% 0,100% 100%,0 100%)` com os mesmos `size`/`right`/`top|bottom`.

**Geometria (para o implementador):** o triângulo antigo é um quadrado N×N cortado pela diagonal de (0,100%) a (100%,0), mantendo a metade inferior-direita. Um quadrado de lado `L = N·√2` rotacionado 45° em torno do próprio centro, com o centro posicionado no canto inferior-direito do quadrado antigo, tem sua aresta superior exatamente sobre essa diagonal. Conversão de CSS: `right_novo = right_antigo − L/2`; `top_novo = top_antigo + N − L/2`; `bottom_novo = bottom_antigo − L/2`. **Degradês:** `rotate(45deg)` gira o gradiente junto; para o visual continuar `135deg`, o gradiente local deve ser `90deg` (135 − 45).

- [ ] **Step 1: Adicionar `triDecor` em `js/pdf.js`** (junto aos helpers da Task 1):

```js
// Triângulo decorativo compatível com html2canvas (clip-path é ignorado na rasterização):
// quadrado rotacionado 45° cuja aresta superior coincide com a hipotenusa do antigo
// clip-path:polygon(100% 0,100% 100%,0 100%). Passar os mesmos size/right/top|bottom do div antigo.
function triDecor({size, right, top=null, bottom=null, background, opacity=1}){
  const L = size*Math.SQRT2;
  const vert = top!==null ? `top:${top + size - L/2}px;` : `bottom:${bottom - L/2}px;`;
  return `<div style="position:absolute;right:${right - L/2}px;${vert}width:${L}px;height:${L}px;transform:rotate(45deg);background:${background};opacity:${opacity};"></div>`;
}
```

- [ ] **Step 2: Substituir as 8 ocorrências.** O gradiente `135deg` vira `90deg` (compensação da rotação):

Em `pageCapa()` (2 divs sólidos):
```js
      ${triDecor({size:760, right:-110, bottom:-160, background:BRAND.cor, opacity:.97})}
      ${triDecor({size:480, right:-30, bottom:-90, background:BRAND.corSecundaria, opacity:.9})}
```
Em `pageSumario()`:
```js
    ${triDecor({size:560, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.92})}
```
Em `pageObjetivo()`, `pageEstrutura()`, `pageEquipamento()` e `pagePremissas()` (mesmos parâmetros nos 4):
```js
    ${triDecor({size:420, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.85})}
```
Em `pageEncerramento()`:
```js
      ${triDecor({size:520, right:-100, top:-140, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.92})}
```

- [ ] **Step 3: Conferir que não sobrou `clip-path` em pdf.js.** Rodar: `grep -n "clip-path" js/pdf.js`
Expected: nenhuma ocorrência.

- [ ] **Step 4: Verificação visual.** Gerar um PDF (qualquer projeto mínimo). Conferir capa, sumário, objetivo, estrutura, uma ficha, premissas e encerramento.
Expected: em todas as páginas o canto decorado mostra um **triângulo com diagonal a 45°** (não mais um retângulo), e nos que têm degradê o verde→azul aparece na mesma direção do editor (135°, verde no canto superior-esquerdo do triângulo).

- [ ] **Step 5: Commit**

```bash
git add js/pdf.js
git commit -m "PDF: triângulos decorativos via quadrado rotacionado 45° (html2canvas ignora clip-path)"
```

---

### Task 3: Validações antes de gerar o PDF

**Files:**
- Create: `js/validacao.js`
- Modify: `js/tabs/gerar.js`, `js/pdf.js`, `js/main.js`, `css/style.css`

**Interfaces:**
- Produces: `validarProposta() → [{campo, msg}]` e `CHECKS = [{campo, label}]` em `js/validacao.js`; `solicitarGerarPDF()` em `js/pdf.js` (exposta no `window`, substitui `gerarPDF` como onclick do botão — `gerarPDF` continua exportada/exposta).

- [ ] **Step 1: Criar `js/validacao.js`:**

```js
import { state } from './state.js';

export const CHECKS = [
  {campo:'projeto', label:'Unidade preenchida'},
  {campo:'objetivo', label:'Problema & Solução preenchidos'},
  {campo:'planta', label:'Planta baixa anexada'},
  {campo:'estrutura', label:'Estrutura com itens'},
  {campo:'fichas', label:'Fichas com fotos completas'},
  {campo:'premissas', label:'Premissas cadastradas'},
];

export function validarProposta(){
  const pend = [];
  if(!(state.projeto.unidade||'').trim()) pend.push({campo:'projeto', msg:'Unidade/local não preenchida (aba Dados do Projeto)'});
  if(!(state.objetivo.problema||'').trim()) pend.push({campo:'objetivo', msg:'"Área a ser Monitorada" vazia (aba 01)'});
  if(!(state.objetivo.solucao||'').trim()) pend.push({campo:'objetivo', msg:'"Diretriz da Proposta" vazia (aba 01)'});
  if(!state.planta.imagem) pend.push({campo:'planta', msg:'Planta baixa não anexada (aba 02)'});
  const temItens = state.estrutura.some(g=>g.itens && g.itens.some(it=>(it.nome||'').trim()));
  if(!temItens) pend.push({campo:'estrutura', msg:'Nenhum equipamento na Estrutura (aba 03)'});
  const semFoto = state.planta.pins.filter(p=>!p.fotoLocal || !p.fotoView).length;
  if(semFoto>0) pend.push({campo:'fichas', msg:`${semFoto} equipamento(s) sem foto do local e/ou da visualização (aba 04)`});
  const temPremissa = state.premissas.some(p=>(p.titulo||'').trim() || (p.desc||'').trim());
  if(!temPremissa) pend.push({campo:'premissas', msg:'Nenhuma premissa cadastrada (aba 05)'});
  return pend;
}
```

- [ ] **Step 2: Verificar a função pura no console.** `npx serve .`, abrir a URL, no console:

```js
const v = await import('./js/validacao.js');
v.validarProposta();
```
Expected (estado inicial vazio): array com 6 pendências (projeto, objetivo×2, planta, estrutura, premissas — sem `fichas`, pois não há pins). Preencher `state.projeto.unidade='X'` no console e rodar de novo → 5 pendências.

- [ ] **Step 3: Adicionar `solicitarGerarPDF` + modal em `js/pdf.js`.** No topo, adicionar import: `import { validarProposta } from './validacao.js';`. Ao final do arquivo:

```js
export function solicitarGerarPDF(){
  const pend = validarProposta();
  if(pend.length===0){ gerarPDF(); return; }
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">Itens pendentes na proposta</div>
      <ul class="modal-list">${pend.map(p=>`<li>${p.msg}</li>`).join('')}</ul>
      <div class="modal-actions">
        <button class="btn ghost" id="modalVoltar">Voltar e completar</button>
        <button class="btn primary" id="modalGerar">Gerar mesmo assim</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#modalVoltar').onclick = ()=>ov.remove();
  ov.querySelector('#modalGerar').onclick = ()=>{ ov.remove(); gerarPDF(); };
}
```

- [ ] **Step 4: CSS do modal e da checklist** — adicionar ao final de `css/style.css`:

```css
  .modal-overlay{position:fixed;inset:0;background:rgba(10,20,35,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;}
  .modal-box{background:#fff;border-radius:12px;padding:24px 26px;max-width:480px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.3);}
  .modal-title{font-weight:800;font-size:16px;color:var(--text-dark);margin-bottom:12px;}
  .modal-list{margin:0 0 18px 18px;padding:0;font-size:13.5px;color:#7A5A1E;line-height:1.7;}
  .modal-actions{display:flex;gap:10px;justify-content:flex-end;}
  .check{font-size:13.5px;font-weight:600;padding:7px 0;border-bottom:1px solid #EEF1F5;}
  .check.ok{color:#2E7D32;}
  .check.bad{color:#B7791F;}
  .check-detail{font-weight:400;font-size:12.5px;color:#8A6D2B;margin-top:2px;}
```

- [ ] **Step 5: Checklist na aba Gerar Proposta.** Reescrever `js/tabs/gerar.js`:

```js
import { state } from '../state.js';
import { validarProposta, CHECKS } from '../validacao.js';

export function tplGerar(){
  const totalItens = state.estrutura.reduce((s,g)=>s+g.itens.reduce((s2,it)=>s2+(parseInt(it.qtd)||0),0),0);
  const totalPins = state.planta.pins.length;
  const totalFichas = state.planta.pins.filter(p=>p.fotoLocal && p.fotoView).length;
  const pend = validarProposta();
  const pendPorCampo = {};
  pend.forEach(p=>{ (pendPorCampo[p.campo] = pendPorCampo[p.campo]||[]).push(p.msg); });
  const checklist = CHECKS.map(c=>{
    const falhas = pendPorCampo[c.campo];
    return falhas
      ? `<div class="check bad">✗ ${c.label}<div class="check-detail">${falhas.join('<br>')}</div></div>`
      : `<div class="check ok">✓ ${c.label}</div>`;
  }).join('');
  return `
    <h1 class="pagetitle">Gerar Proposta</h1>
    <p class="pagesub">Revise o resumo e gere o PDF completo com a identidade Bracell · Segurança Patrimonial.</p>
    <div class="summary-grid">
      <div class="stat"><div class="n">${state.estrutura.length}</div><div class="l">Grupos de equipamento</div></div>
      <div class="stat"><div class="n">${totalItens}</div><div class="l">Itens quantificados</div></div>
      <div class="stat"><div class="n">${totalPins}</div><div class="l">Pontos na planta</div></div>
      <div class="stat"><div class="n">${totalFichas}/${totalPins}</div><div class="l">Fichas completas</div></div>
    </div>
    <div class="card">
      <div style="font-weight:700;margin-bottom:8px;">Checklist da proposta</div>
      ${checklist}
      <button class="btn primary" style="font-size:15px;padding:13px 22px;margin-top:18px;" onclick="solicitarGerarPDF()">⬇ Gerar PDF da Proposta</button>
    </div>
  `;
}
```

- [ ] **Step 6: Expor no `window`.** Em `js/main.js`, trocar o import de pdf e o Object.assign:

```js
import { gerarPDF, solicitarGerarPDF } from './pdf.js';
```
e na lista do `Object.assign(window, {...})`, trocar `gerarPDF,` por `gerarPDF, solicitarGerarPDF,`.

- [ ] **Step 7: Verificação funcional.** Recarregar a página. Aba Gerar Proposta com projeto vazio → checklist toda ✗ âmbar com detalhes. Clicar em Gerar PDF → modal lista as pendências; "Voltar e completar" fecha sem gerar; clicar de novo e "Gerar mesmo assim" → PDF baixa. Preencher tudo (unidade, problema/solução, planta, 1 pin com 2 fotos, 1 item de estrutura, 1 premissa) → checklist toda ✓ verde; Gerar PDF → gera direto sem modal.

- [ ] **Step 8: Commit**

```bash
git add js/validacao.js js/tabs/gerar.js js/pdf.js js/main.js css/style.css
git commit -m "Validações pré-PDF: checklist na aba Gerar + modal 'gerar mesmo assim'"
```

---

### Task 4: Recorte das fichas adaptativo + slider por ficha

**Files:**
- Modify: `js/utils.js`, `js/tabs/equipamentos.js`, `js/main.js`

**Interfaces:**
- Consumes: `generateCropDataURL(pin)` existente (também usada por `js/pdf.js`, que não muda: passa a herdar o novo comportamento automaticamente).
- Produces: `defaultCropFrac(naturalWidth) → number` em `js/utils.js`; `setCropFrac(pi, valorSlider)` em `js/tabs/equipamentos.js` (exposta no `window`); campo novo opcional `pin.cropFrac` (fração 0.10–0.60).

- [ ] **Step 1: Adicionar `defaultCropFrac` em `js/utils.js`:**

```js
// Fração da planta recortada na ficha: adaptativa à resolução
// (plantas grandes recortam fração menor = mais zoom; clamp 15%–50%)
export function defaultCropFrac(naturalWidth){
  return Math.min(0.50, Math.max(0.15, 800/naturalWidth));
}
```

- [ ] **Step 2: Verificar no console:**

```js
const u = await import('./js/utils.js');
[u.defaultCropFrac(1000), u.defaultCropFrac(4000), u.defaultCropFrac(500)];
```
Expected: `[0.8→0.5 (clamp), 0.2, 0.5]` — ou seja `[0.5, 0.2, 0.5]`.

- [ ] **Step 3: Usar em `generateCropDataURL`.** Em `js/tabs/equipamentos.js`, adicionar `defaultCropFrac` ao import de utils e trocar a linha `const cropFrac = 0.28;` por:

```js
      const cropFrac = pin.cropFrac || defaultCropFrac(cw);
```

- [ ] **Step 4: Slider na ficha.** Em `tplEquipamentos`, dentro do primeiro `<div>` da `.row` (o da localização automática), logo após a `<img id="cropPreview-${pi}" ...>`:

```html
            <label style="margin-top:8px;">Zoom do recorte</label>
            <input id="cropSlider-${pi}" type="range" min="10" max="60" step="1"
              value="${Math.round((p.cropFrac||0.28)*100)}"
              onchange="setCropFrac(${pi}, this.value)" style="width:100%;">
```

Nota: o slider mostra a fração como % **da planta recortada** — valor menor = recorte menor = mais zoom. O `value` inicial de pins sem `cropFrac` é corrigido no Step 5 quando a imagem carrega.

- [ ] **Step 5: `setCropFrac` + sincronizar slider com o default adaptativo.** Ainda em `js/tabs/equipamentos.js`:

```js
export function setCropFrac(pi, val){
  state.planta.pins[pi].cropFrac = parseInt(val)/100;
  generateCropDataURL(state.planta.pins[pi]).then(url=>{
    const el = document.getElementById('cropPreview-'+pi);
    if(el && url) el.src = url;
  });
}
```

E em `afterEquipamentosRender`, ajustar o slider de pins sem `cropFrac` para o default real (a largura natural só é conhecida após carregar a imagem):

```js
export function afterEquipamentosRender(){
  const sync = (naturalWidth)=>{
    state.planta.pins.forEach((p,pi)=>{
      if(!p.cropFrac){
        const s = document.getElementById('cropSlider-'+pi);
        if(s) s.value = Math.round(defaultCropFrac(naturalWidth)*100);
      }
    });
  };
  if(state.planta.imagem){
    const img = new Image();
    img.onload = ()=>sync(img.naturalWidth);
    img.src = state.planta.imagem;
  }
  state.planta.pins.forEach((p,pi)=>{
    generateCropDataURL(p).then(url=>{
      const el = document.getElementById('cropPreview-'+pi);
      if(el && url) el.src = url;
    });
  });
}
```

- [ ] **Step 6: Expor `setCropFrac` no `window`.** Em `js/main.js`, trocar `import { handleEquipPhoto } from './tabs/equipamentos.js';` por `import { handleEquipPhoto, setCropFrac } from './tabs/equipamentos.js';` e adicionar `setCropFrac,` no `Object.assign`.

- [ ] **Step 7: Verificação funcional.** (a) Planta grande (>3000px de largura): preview da ficha mostra recorte mais fechado que os 28% antigos; slider posicionado em ~20–26. (b) Mover o slider → preview atualiza ao soltar. (c) Gerar PDF → recorte da ficha no PDF idêntico ao preview. (d) Importar `.json` antigo (pins sem `cropFrac`) → nada quebra, default adaptativo aplicado.

- [ ] **Step 8: Commit**

```bash
git add js/utils.js js/tabs/equipamentos.js js/main.js
git commit -m "Fichas: recorte da planta adaptativo à resolução + slider de zoom por ficha"
```

---

### Task 5: Touch na planta — pinch-zoom, alvos maiores, higiene

**Files:**
- Modify: `js/tabs/planta.js`, `css/style.css`

**Interfaces:**
- Consumes: `#plantaScroll` (container com overflow), `#plantaWrap` (div com `width:%` = zoom), `state.planta.zoom` (60–400).
- Produces: classes CSS `.planta-pin` e `.planta-rothandle` (tamanhos saem do inline e vão pro CSS — Task 6 usa o mesmo padrão para `.cerca-vertex`); `id="zoomLabel"` no span do %; `attachPinchZoom()` interna chamada por `afterPlantaRender`.

- [ ] **Step 1: CSS — classes de tamanho + media coarse + higiene.** Ao final de `css/style.css`:

```css
  #plantaScroll{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:pan-x pan-y;}
  .planta-pin{width:36px;height:36px;}
  .planta-rothandle{width:20px;height:20px;}
  @media (pointer: coarse){
    .planta-pin{width:44px;height:44px;}
    .planta-rothandle{width:28px;height:28px;}
  }
```

- [ ] **Step 2: Usar as classes em `js/tabs/planta.js`.** Em `afterPlantaRender`:
  - No handle de rotação: `handle.className = 'planta-rothandle';` e **remover** `width:20px;height:20px;` do `cssText`.
  - No pin: `pin.className = 'planta-pin';` e **remover** `width:36px;height:36px;` do `cssText`.

- [ ] **Step 3: Dar id ao label de zoom.** Em `tplPlanta`, trocar o span do percentual por:

```html
        <span id="zoomLabel" style="font-size:13px;font-weight:700;min-width:44px;text-align:center;">${pl.zoom||100}%</span>
```

- [ ] **Step 4: Pinch-zoom.** Em `js/tabs/planta.js`, adicionar (junto de `dragState`):

```js
let pinch = null;

function touchDist(e){
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.hypot(dx, dy);
}

function attachPinchZoom(){
  const scroll = document.getElementById('plantaScroll');
  const wrap = document.getElementById('plantaWrap');
  if(!scroll || !wrap) return;
  scroll.addEventListener('touchstart', (e)=>{
    if(e.touches.length===2){
      pinch = {
        dist: touchDist(e),
        zoom: state.planta.zoom||100,
        midX: (e.touches[0].clientX+e.touches[1].clientX)/2,
        midY: (e.touches[0].clientY+e.touches[1].clientY)/2,
      };
    }
  }, {passive:false});
  scroll.addEventListener('touchmove', (e)=>{
    if(e.touches.length===2 && pinch){
      e.preventDefault(); // impede o zoom de página do navegador
      const z = Math.min(400, Math.max(60, pinch.zoom * (touchDist(e)/pinch.dist)));
      // âncora: mantém o ponto da planta sob o centro do gesto
      const r = scroll.getBoundingClientRect();
      const fx = (scroll.scrollLeft + pinch.midX - r.left) / wrap.offsetWidth;
      const fy = (scroll.scrollTop + pinch.midY - r.top) / wrap.offsetHeight;
      wrap.style.width = z + '%';
      scroll.scrollLeft = fx*wrap.offsetWidth - (pinch.midX - r.left);
      scroll.scrollTop  = fy*wrap.offsetHeight - (pinch.midY - r.top);
      state.planta.zoom = Math.round(z);
      const lbl = document.getElementById('zoomLabel');
      if(lbl) lbl.textContent = Math.round(z)+'%';
    }
  }, {passive:false});
  scroll.addEventListener('touchend', (e)=>{
    if(e.touches.length<2) pinch = null;
  });
}
```

E **chamar `attachPinchZoom();` como última linha de `afterPlantaRender`** (os listeners não duplicam: `#plantaScroll` é recriado a cada render).

- [ ] **Step 5: Verificação (DevTools).** `npx serve .`, DevTools → device toolbar (modo touch). Anexar planta, criar 2 pins.
  - Pinch (Shift+arrasta no Chrome emula 2 dedos): zoom muda suavemente entre 60–400%, label acompanha, o ponto pinçado fica ancorado (não "foge"), pins acompanham (são %).
  - 1 dedo: rola a planta sem criar pin; tap parado cria pin.
  - Arrastar pin e girar handle: continuam funcionando no touch.
  - Long-press na planta: não abre menu de salvar imagem, nada é selecionado.
  - Em modo coarse os pins ficam visivelmente maiores (44px).
  - Mouse normal (sem device toolbar): tudo como antes (clique, drag, zoom por botões).

- [ ] **Step 6: Verificação em campo (deploy).** Se o Firebase CLI estiver configurado, `firebase deploy` e testar pinch/drag num celular real. (Se não der agora, anotar para o teste de campo do usuário.)

- [ ] **Step 7: Commit**

```bash
git add js/tabs/planta.js css/style.css
git commit -m "Planta touch: pinch-zoom ancorado, alvos maiores em telas touch, bloqueio de long-press/seleção"
```

---

### Task 6: Cerca/concertina como traçado — modelo + desenho + edição no editor

**Files:**
- Modify: `js/state.js`, `js/persistence.js`, `js/tabs/planta.js`, `js/nav.js`, `js/main.js`, `css/style.css`

**Interfaces:**
- Consumes: mecânica de drag existente (`dragState`, `onPointerDrag`, `endPointerDrag`), `renderContent()`, padrão de classes da Task 5.
- Produces: `state.planta.cercas = [{label, pontos:[{x,y}]}]`; funções no `window`: `selectTipo(id)`, `cercaDesfazer()`, `cercaConcluir()`, `cercaCancelar()`, `removeCerca(ci)`; export `cancelarTraco()` de planta.js (usada por nav.js). **Task 7 consome `state.planta.cercas`.**

- [ ] **Step 1: Modelo.** Em `js/state.js`, linha da planta:

```js
  planta: { imagem:null, selectedTipo:'bullet', pins:[], zoom:100, cercas:[] },
```

- [ ] **Step 2: Compatibilidade no import.** Em `js/persistence.js`, após `if(state.planta.zoom===undefined) state.planta.zoom = 100;`:

```js
      if(!state.planta.cercas) state.planta.cercas = [];
```

E em `js/tabs/planta.js`, `handlePlantaUpload` (trocar a planta zera tudo):

```js
  state.planta.pins = [];
  state.planta.cercas = [];
```

- [ ] **Step 3: Modo traçado — estado do módulo + funções.** Em `js/tabs/planta.js` (junto de `dragState`):

```js
let tracoAtual = null; // [{x,y},...] durante o desenho de uma cerca; null = sem traçado

export function cancelarTraco(){ tracoAtual = null; }
export function selectTipo(id){
  if(state.planta.selectedTipo==='cerca' && id!=='cerca') tracoAtual = null;
  state.planta.selectedTipo = id;
  renderContent();
}
export function cercaDesfazer(){
  if(tracoAtual && tracoAtual.length) tracoAtual.pop();
  renderContent();
}
export function cercaConcluir(){
  if(!tracoAtual || tracoAtual.length<2){ tracoAtual = null; renderContent(); return; }
  state.planta.cercas.push({label:'Cerca / Concertina', pontos:tracoAtual});
  tracoAtual = null;
  showToast('Traçado de cerca adicionado.');
  renderContent();
}
export function cercaCancelar(){ tracoAtual = null; renderContent(); }
export function removeCerca(ci){ state.planta.cercas.splice(ci,1); renderContent(); }
```

Adicionar `showToast` ao import de utils em planta.js: `import { typeById, fileToDataURL, showToast } from '../utils.js';`

- [ ] **Step 4: Toolbar usa `selectTipo` e clique na planta adiciona vértice.** Em `tplPlanta`, no botão de tipo, trocar `onclick="state.planta.selectedTipo='${t.id}'; renderContent();"` por `onclick="selectTipo('${t.id}')"`. No `img.onclick` de `afterPlantaRender`, após calcular `x`/`y`, antes de criar pin:

```js
      if(state.planta.selectedTipo==='cerca'){
        tracoAtual = tracoAtual || [];
        tracoAtual.push({x, y});
        renderContent();
        return;
      }
```

- [ ] **Step 5: Barra flutuante do traçado.** Em `tplPlanta`, logo antes do `<div id="plantaScroll">` (só aparece com tipo cerca + planta anexada):

```js
      ${pl.selectedTipo==='cerca' && pl.imagem ? `
      <div class="cerca-bar">
        <b>Traçado de cerca:</b>
        <span>${tracoAtual ? tracoAtual.length : 0} ponto(s)</span>
        <button class="btn ghost small" onclick="cercaDesfazer()">↩ Desfazer último</button>
        <button class="btn primary small" onclick="cercaConcluir()">✔ Concluir</button>
        <button class="btn danger small" onclick="cercaCancelar()">✕ Cancelar</button>
        <span class="hint" style="margin:0;">Toque na planta para adicionar pontos (mín. 2). Concluir com menos de 2 descarta.</span>
      </div>` : ''}
```

(`tracoAtual` é variável do módulo — `tplPlanta` está no mesmo arquivo, acesso direto.)

- [ ] **Step 6: Renderizar segmentos e vértices.** Coordenadas dos segmentos em **%** com comprimento em % da largura do wrap — como o zoom escala o wrap uniformemente (aspecto fixo da imagem), a razão comprimento/largura é invariante, então os segmentos sobrevivem ao pinch sem re-render. Em `js/tabs/planta.js`:

```js
function cercaSegmentDiv(a, b, wrapW, wrapH){
  const dx = (b.x-a.x)/100*wrapW, dy = (b.y-a.y)/100*wrapH;
  const lenPct = Math.hypot(dx, dy)/wrapW*100;
  const ang = Math.atan2(dy, dx)*180/Math.PI;
  const d = document.createElement('div');
  d.className = 'cerca-seg';
  d.style.cssText = `position:absolute;left:${a.x}%;top:calc(${a.y}% - 2px);width:${lenPct}%;height:4px;border-radius:2px;background:#EB5757;transform-origin:0 2px;transform:rotate(${ang}deg);pointer-events:none;z-index:2;`;
  return d;
}

function renderCercas(wrap){
  wrap.querySelectorAll('.cerca-seg, .cerca-vertex').forEach(el=>el.remove());
  const wrapW = wrap.offsetWidth, wrapH = wrap.offsetHeight;
  state.planta.cercas.forEach((c,ci)=>{
    for(let i=0;i<c.pontos.length-1;i++) wrap.appendChild(cercaSegmentDiv(c.pontos[i], c.pontos[i+1], wrapW, wrapH));
    c.pontos.forEach((pt,vi)=>{
      const v = document.createElement('div');
      v.className = 'cerca-vertex';
      v.title = 'Arraste para ajustar o traçado';
      v.style.cssText = `position:absolute;left:${pt.x}%;top:${pt.y}%;transform:translate(-50%,-50%);background:#fff;border:2.5px solid #EB5757;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.35);cursor:grab;z-index:4;touch-action:none;`;
      v.onpointerdown = (e)=>startVertexDrag(e, ci, vi);
      wrap.appendChild(v);
    });
  });
  if(tracoAtual && tracoAtual.length){
    for(let i=0;i<tracoAtual.length-1;i++) wrap.appendChild(cercaSegmentDiv(tracoAtual[i], tracoAtual[i+1], wrapW, wrapH));
    tracoAtual.forEach(pt=>{
      const v = document.createElement('div');
      v.className = 'cerca-vertex';
      v.style.cssText = `position:absolute;left:${pt.x}%;top:${pt.y}%;transform:translate(-50%,-50%);background:#EB5757;border:2.5px solid #fff;border-radius:50%;pointer-events:none;z-index:4;`;
      wrap.appendChild(v);
    });
  }
}
```

Chamar `renderCercas(wrap);` dentro de `afterPlantaRender`, dentro do `if(wrap){...}`, **depois** do `forEach` dos pins.

- [ ] **Step 7: Drag de vértice.** Ainda em planta.js:

```js
export function startVertexDrag(e, ci, vi){
  e.preventDefault(); e.stopPropagation();
  dragState = {type:'vertex', ci, vi};
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
```

Em `onPointerDrag`, o corpo atual assume pin — reorganizar para tratar `vertex` antes: logo após obter `rect`, inserir:

```js
  if(dragState.type==='vertex'){
    const pt = state.planta.cercas[dragState.ci]?.pontos[dragState.vi];
    if(!pt) return;
    pt.x = Math.max(0, Math.min(100, ((e.clientX-rect.left)/rect.width)*100));
    pt.y = Math.max(0, Math.min(100, ((e.clientY-rect.top)/rect.height)*100));
    const wrap = document.getElementById('plantaWrap');
    if(wrap) renderCercas(wrap);
    return;
  }
```

(As linhas seguintes — `const pi = dragState.index; ...` — permanecem para move/rotate.) Em `endPointerDrag`, o bloco `if(wasIndex!==null){...}` usa `dragState.index`, que é `undefined` para vertex — já é tolerante (getElementById devolve null), nenhuma mudança necessária.

- [ ] **Step 8: Lista de traçados + CSS.** Em `tplPlanta`, dentro de `<div class="pinlist">`, após o `.map` dos pins:

```js
        ${pl.cercas.map((c,ci)=>`
          <div class="pinrow">
            <span class="icon-dot" style="background:#EB5757">${ICONS.cerca}</span>
            <b style="font-size:12px;color:var(--text-mid);width:24px;">C${ci+1}</b>
            <input type="text" style="flex:1;min-width:140px;" placeholder="Rótulo (ex: Perímetro norte)" value="${c.label}" oninput="state.planta.cercas[${ci}].label=this.value">
            <span style="font-size:11px;color:var(--text-mid);">${c.pontos.length} pontos</span>
            <button class="btn danger small" onclick="removeCerca(${ci})">✕</button>
          </div>`).join('')}
```

E ajustar a condição de lista vazia de `pl.pins.length===0 ?` para `(pl.pins.length===0 && pl.cercas.length===0) ?`.

CSS ao final de `css/style.css`:

```css
  .cerca-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#FDF3F2;border:1px solid #F0C7C0;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;}
  .cerca-vertex{width:14px;height:14px;}
  @media (pointer: coarse){
    .cerca-vertex{width:24px;height:24px;}
  }
```

- [ ] **Step 9: Cancelar traçado ao trocar de aba + expor funções.** Em `js/nav.js`: adicionar `import { cancelarTraco } from './tabs/planta.js';` e em `switchTab`:

```js
export function switchTab(id){ cancelarTraco(); currentTab = id; renderNav(); renderContent(); }
```

Em `js/main.js`, no import de planta.js adicionar as novas funções e expô-las:

```js
import { handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, removePin, selectTipo, cercaDesfazer, cercaConcluir, cercaCancelar, removeCerca } from './tabs/planta.js';
```
e no `Object.assign`: `selectTipo, cercaDesfazer, cercaConcluir, cercaCancelar, removeCerca,`.

- [ ] **Step 10: Verificação funcional.**
  - Selecionar "Cerca / Concertina" → barra do traçado aparece; cliques na planta criam vértices com preview de linha ao vivo; "Desfazer último" remove o último; "Concluir" com ≥2 pontos cria o traçado (toast) e ele aparece vermelho na planta + linha "C1" na lista.
  - "Concluir" com 1 ponto ou "Cancelar" → descarta.
  - Trocar para outro tipo na toolbar no meio do traçado → descarta o traçado em andamento (os já concluídos ficam).
  - Trocar de aba no meio do traçado e voltar → descartado.
  - Arrastar vértice de traçado concluído → linhas acompanham; excluir traçado remove tudo.
  - Zoom (botões e pinch) → traçado escala junto sem distorcer.
  - Exportar `.json`, recarregar página, importar → traçados voltam. Importar um `.json` antigo (sem `cercas`) → sem erro.
  - Pins normais: criar/arrastar/girar continuam intactos.

- [ ] **Step 11: Commit**

```bash
git add js/state.js js/persistence.js js/tabs/planta.js js/nav.js js/main.js css/style.css
git commit -m "Cerca/concertina como traçado: modo desenho, edição de vértices e lista na aba Planta"
```

---

### Task 7: Cerca no PDF (mapeamento + legenda) e na Estrutura

**Files:**
- Modify: `js/pdf.js` (`pageMapeamento`, `equipamentoLegend`), `js/tabs/estrutura.js` (`importFromPlanta`)

**Interfaces:**
- Consumes: `state.planta.cercas` (Task 6), `rect` do contain-fit dentro de `pageMapeamento` (Task 1), `equipamentoLegend()` (consumida por `pageEstrutura`).

- [ ] **Step 1: Segmentos de cerca na página de Mapeamento.** Em `pageMapeamento` (js/pdf.js), após montar `pinsHtml`, adicionar:

```js
  const cercaHtml = (state.planta.cercas||[]).map(c=>{
    const segs = [];
    for(let i=0;i<c.pontos.length-1;i++){
      const a = c.pontos[i], b = c.pontos[i+1];
      const x1 = rect.x + (a.x/100)*rect.w, y1 = rect.y + (a.y/100)*rect.h;
      const x2 = rect.x + (b.x/100)*rect.w, y2 = rect.y + (b.y/100)*rect.h;
      const len = Math.hypot(x2-x1, y2-y1);
      const ang = Math.atan2(y2-y1, x2-x1)*180/Math.PI;
      segs.push(`<div style="position:absolute;left:${x1}px;top:${y1-2}px;width:${len}px;height:4px;border-radius:2px;background:#EB5757;transform-origin:0 2px;transform:rotate(${ang}deg);"></div>`);
    }
    return segs.join('');
  }).join('');
```

e no HTML retornado, inserir `${cercaHtml}` logo após `${pinsHtml}`.

- [ ] **Step 2: Legenda.** Em `equipamentoLegend` (js/pdf.js), antes do `return`:

```js
  const legend = Object.values(map);
  (state.planta.cercas||[]).forEach(c=>{
    legend.push({tipoId:'cerca', label:c.label, qtd:1});
  });
  return legend;
```

(trocando o `return Object.values(map);` atual por esse bloco).

- [ ] **Step 3: "Gerar a partir da planta".** Em `importFromPlanta` (js/tabs/estrutura.js), após `const itens = Object.values(map);`:

```js
  (state.planta.cercas||[]).forEach(c=>{
    itens.push({qtd:1, nome:c.label||'Cerca / Concertina', desc:''});
  });
```

E a condição de vazio já cobre (o `itens.length===0` só dispara sem pins **e** sem cercas, pois cercas agora adicionam itens antes do check — **atenção**: mover o check `if(itens.length===0)` para DEPOIS do forEach das cercas).

- [ ] **Step 4: Verificação funcional.** Projeto com 2 pins + 1 traçado de cerca de 3 pontos:
  - Aba Estrutura → "Gerar a partir da planta" → grupo inclui `1x Cerca / Concertina — <rótulo>` além dos pins. Só cerca, sem pins → também funciona (não dá toast de vazio).
  - Gerar PDF → página Mapeamento mostra a linha vermelha exatamente sobre o traçado do editor (mesma posição relativa à imagem, não ao container); página Estrutura → legenda inclui a cerca com ícone; **nenhuma ficha de equipamento gerada para a cerca** (contagem de páginas = fichas só dos pins).

- [ ] **Step 5: Verificação de regressão final (checklist do spec).** Passar a lista de verificação do spec inteira: pinch/touch, pins PDF com planta larga, triângulos, validações, recorte, export/import de `.json` novo e antigo.

- [ ] **Step 6: Commit**

```bash
git add js/pdf.js js/tabs/estrutura.js
git commit -m "Cerca no PDF (mapeamento + legenda) e no 'Gerar a partir da planta' da Estrutura"
```

---

## Self-Review (feita na escrita do plano)

- **Cobertura do spec:** Item 1→Task 5; Item 2→Tasks 6+7; Item 3→Task 1; Item 4→Task 2; Item 5→Task 3; Item 6→Task 4. Casos-limite do spec: json antigo (T4 S7, T6 S10), pinch durante traçado (2 dedos não geram `click` — coberto por design, verificado em T6 S10 via zoom), upload de planta zera cercas (T6 S2).
- **Placeholders:** nenhum — todo step de código tem o código.
- **Consistência de nomes:** `containRect`/`loadImageDims`/`triDecor`/`solicitarGerarPDF`/`defaultCropFrac`/`setCropFrac`/`selectTipo`/`cercaDesfazer`/`cercaConcluir`/`cercaCancelar`/`removeCerca`/`cancelarTraco`/`startVertexDrag`/`renderCercas`/`cercaSegmentDiv` conferidos entre tasks; `state.planta.cercas[].pontos[].{x,y}` consistente entre Tasks 6 e 7.
