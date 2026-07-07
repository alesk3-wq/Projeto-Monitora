# Demarcadores de Área na Planta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retângulos coloridos semi-transparentes desenhados com clica-e-arrasta sobre a planta, com 6 categorias pré-definidas + "Outro", editáveis (mover/redimensionar/excluir), presentes no PDF (Mapeamento + legenda na Estrutura). Spec: `docs/superpowers/specs/2026-07-07-demarcadores-area-design.md`.

**Architecture:** App vanilla JS (ES modules, sem build). Nova lógica de áreas em módulo próprio `js/tabs/areas.js` (planta.js delega); coordenadas em % da imagem; rendering por divs compatíveis com html2canvas 1.4.1.

**Tech Stack:** JavaScript ES modules, html2canvas 1.4.1, jsPDF 2.5.1 (CDN).

## Global Constraints

- **Sem dependências novas, sem build step.** Só ES modules nativos.
- **html2canvas 1.4.1 ignora `clip-path`/`object-fit`, SVG inline instável** — nada disso em markup de `js/pdf.js`.
- **Toda função usada em `onclick`/`oninput`/`onchange` inline PRECISA estar no `window` via `js/main.js`.**
- Coordenadas de áreas em % da imagem (`x, y, w, h` de 0–100), nunca px.
- Textos de UI em pt-BR (strings deste plano são copy final).
- Compatibilidade com `.json` antigos: default `areas:[]` / `selectedAreaCat:'area1'` no import; nunca quebrar por chave ausente.
- Sem framework de teste: verificação = smoke import em Node + greps; interativa fica para o controlador/usuário.
- Commits direto na `master` (convenção aprovada), mensagens em pt-BR.
- `areas.js` NÃO pode importar de `planta.js` (evita ciclo; planta.js importa de areas.js).

## File Structure

| Arquivo | Papel |
|---|---|
| `js/constants.js` (modificar) | Task 1 — `AREA_CATS` |
| `js/utils.js` (modificar) | Task 1 — `areaCatById` |
| `js/state.js` (modificar) | Task 1 — `planta.areas`, `planta.selectedAreaCat` |
| `js/persistence.js` (modificar) | Task 1 — defaults no import |
| `js/tabs/areas.js` (**criar**) | Task 2 — paleta, desenho, render, mover/redimensionar, linhas da lista |
| `js/tabs/planta.js` (modificar) | Task 2 — botão da ferramenta, delegação, guardas, reset no upload |
| `js/main.js` (modificar) | Task 2 — expor `selectAreaCat`/`setAreaCat`/`removeArea` |
| `css/style.css` (modificar) | Task 2 — `.area-bar`, `.area-chip`, `.area-rect` label, `.area-handle`, modo área |
| `js/pdf.js` (modificar) | Task 3 — `areasHtml` no Mapeamento + seção na legenda da Estrutura |

---

### Task 1: Modelo de dados — categorias, state e persistência

**Files:**
- Modify: `js/constants.js`, `js/utils.js`, `js/state.js`, `js/persistence.js`

**Interfaces:**
- Produces: `AREA_CATS = [{id, label, desc, color}]` (7 itens, ids `area1..area6, outro`) em constants.js; `areaCatById(id)` em utils.js (fallback = último item, `outro`); `state.planta.areas` (array) e `state.planta.selectedAreaCat` ('area1'). **Tasks 2 e 3 consomem tudo isso.**

- [ ] **Step 1: `AREA_CATS` em `js/constants.js`** (após `EQUIP_TYPES`):

```js
export const AREA_CATS = [
  {id:'area1', label:'Área 1', desc:'Área da Oficina', color:'#2D9CDB'},
  {id:'area2', label:'Área 2', desc:'Área de livre circulação', color:'#27AE60'},
  {id:'area3', label:'Área 3', desc:'Materiais de altíssimo valor, mas de difícil transporte e comercialização', color:'#9B51E0'},
  {id:'area4', label:'Área 4', desc:'Materiais de fácil transporte, alto giro, mas baixo valor', color:'#F2C94C'},
  {id:'area5', label:'Área 5', desc:'Materiais de alto valor, alto giro, mas de difícil transporte', color:'#F2994A'},
  {id:'area6', label:'Área 6', desc:'Área crítica (prateleiras/porta-pallets com peças de alto giro, alto valor, fácil transporte e fácil comércio)', color:'#C0392B'},
  {id:'outro', label:'Outro', desc:'', color:'#828282'},
];
```

- [ ] **Step 2: `areaCatById` em `js/utils.js`** — adicionar `AREA_CATS` ao import de constants e:

```js
export function areaCatById(id){ return AREA_CATS.find(c=>c.id===id) || AREA_CATS[AREA_CATS.length-1]; }
```

- [ ] **Step 3: state.** Em `js/state.js`, linha da planta vira:

```js
  planta: { imagem:null, selectedTipo:'bullet', pins:[], zoom:100, cercas:[], areas:[], selectedAreaCat:'area1' },
```

- [ ] **Step 4: import de `.json` antigo.** Em `js/persistence.js`, após `if(!state.planta.cercas) state.planta.cercas = [];`:

```js
      if(!state.planta.areas) state.planta.areas = [];
      if(!state.planta.selectedAreaCat) state.planta.selectedAreaCat = 'area1';
```

- [ ] **Step 5: Verificação.**
Run: `node -e "import('file:///c:/sk8/SGP-Projetos/claudefiles/js/utils.js').then(m=>console.log(m.areaCatById('area6').color, m.areaCatById('xxx').id)).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `#C0392B outro`
Run: `node -e "import('file:///c:/sk8/SGP-Projetos/claudefiles/js/state.js').then(m=>console.log(JSON.stringify(m.state.planta.areas), m.state.planta.selectedAreaCat)).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `[] area1`

- [ ] **Step 6: Commit**

```bash
git add js/constants.js js/utils.js js/state.js js/persistence.js
git commit -m "Demarcadores de área: categorias, modelo de dados e defaults de import"
```

---

### Task 2: Editor — módulo areas.js, integração na aba Planta, CSS

**Files:**
- Create: `js/tabs/areas.js`
- Modify: `js/tabs/planta.js`, `js/main.js`, `css/style.css`

**Interfaces:**
- Consumes: `AREA_CATS`, `areaCatById`, `state.planta.areas`, `state.planta.selectedAreaCat` (Task 1); `renderContent` (nav.js).
- Produces: exports de `js/tabs/areas.js`: `tplAreaPalette()`, `tplAreaRows()`, `renderAreas(wrap)`, `startAreaDraw(e)`, `areaDragAtivo()`, `selectAreaCat(id)`, `setAreaCat(ai, id)`, `removeArea(ai)`. No `window`: `selectAreaCat`, `setAreaCat`, `removeArea` (os drags são anexados programaticamente, não precisam de window).

- [ ] **Step 1: Criar `js/tabs/areas.js`:**

```js
import { state } from '../state.js';
import { AREA_CATS } from '../constants.js';
import { areaCatById } from '../utils.js';
import { renderContent } from '../nav.js';

// ---------- templates ----------
export function tplAreaPalette(){
  const sel = state.planta.selectedAreaCat || 'area1';
  return `
    <div class="area-bar">
      <b>Demarcar área:</b>
      ${AREA_CATS.map(c=>`
        <button class="area-chip ${c.id===sel?'active':''}" style="--chip-cor:${c.color}" onclick="selectAreaCat('${c.id}')" title="${c.desc||'Descrição livre'}">${c.label}</button>`).join('')}
      <span class="hint" style="margin:0;">Clique e arraste na planta para desenhar. Arraste o corpo para mover; alça no canto para redimensionar.</span>
    </div>`;
}

export function tplAreaRows(){
  return state.planta.areas.map((a,ai)=>`
    <div class="pinrow">
      <span class="icon-dot" style="background:${areaCatById(a.catId).color}">▧</span>
      <b style="font-size:12px;color:var(--text-mid);width:24px;">A${ai+1}</b>
      <select onchange="setAreaCat(${ai}, this.value)">
        ${AREA_CATS.map(c=>`<option value="${c.id}" ${c.id===a.catId?'selected':''}>${c.label}</option>`).join('')}
      </select>
      <input type="text" style="flex:1;min-width:160px;" placeholder="${a.catId==='outro'?'Descreva a área':'Descrição'}" value="${a.descricao}" oninput="state.planta.areas[${ai}].descricao=this.value">
      <button class="btn danger small" onclick="removeArea(${ai})">✕</button>
    </div>`).join('');
}

// ---------- ações da lista/paleta ----------
export function selectAreaCat(id){ state.planta.selectedAreaCat = id; renderContent(); }
export function setAreaCat(ai, id){
  const a = state.planta.areas[ai];
  a.catId = id;
  a.descricao = areaCatById(id).desc || '';
  renderContent();
}
export function removeArea(ai){ state.planta.areas.splice(ai,1); renderContent(); }

// ---------- render na planta ----------
export function renderAreas(wrap){
  wrap.querySelectorAll('.area-rect').forEach(el=>el.remove());
  const interativo = state.planta.selectedTipo==='area';
  state.planta.areas.forEach((a,ai)=>wrap.appendChild(areaRectDiv(a, ai, interativo)));
}

function areaRectDiv(a, ai, interativo){
  const cat = areaCatById(a.catId);
  const d = document.createElement('div');
  d.className = 'area-rect';
  d.id = 'arearect-'+ai;
  d.style.cssText = `position:absolute;left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%;background:${cat.color}38;border:2px solid ${cat.color};border-radius:4px;z-index:1;box-sizing:border-box;${interativo?'cursor:move;touch-action:none;':'pointer-events:none;'}`;
  d.innerHTML = `<span class="area-chip-label" style="background:${cat.color};">${cat.label}</span>`;
  if(interativo){
    d.onpointerdown = (e)=>startAreaMove(e, ai);
    const h = document.createElement('div');
    h.className = 'area-handle';
    h.style.cssText = `position:absolute;right:-9px;bottom:-9px;background:#fff;border:2.5px solid ${cat.color};border-radius:50%;cursor:nwse-resize;touch-action:none;box-shadow:0 1px 3px rgba(0,0,0,.35);`;
    h.onpointerdown = (e)=>startAreaResize(e, ai);
    d.appendChild(h);
  }
  return d;
}

// ---------- desenho / mover / redimensionar ----------
let areaDrag = null;
const MIN_DIM = 1.5; // % mínimo de largura/altura

export function areaDragAtivo(){ return areaDrag !== null; }

function pctPoint(e){
  const img = document.getElementById('plantaImg');
  const rect = img.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((e.clientX-rect.left)/rect.width)*100)),
    y: Math.max(0, Math.min(100, ((e.clientY-rect.top)/rect.height)*100)),
  };
}

export function startAreaDraw(e){
  e.preventDefault();
  const p = pctPoint(e);
  areaDrag = {type:'draw', start:p, rect:null};
  const wrap = document.getElementById('plantaWrap');
  const cat = areaCatById(state.planta.selectedAreaCat||'area1');
  const d = document.createElement('div');
  d.id = 'area-preview';
  d.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;width:0;height:0;background:${cat.color}38;border:2px dashed ${cat.color};border-radius:4px;z-index:5;pointer-events:none;box-sizing:border-box;`;
  wrap.appendChild(d);
  document.addEventListener('pointermove', onAreaPointerMove);
  document.addEventListener('pointerup', endAreaPointer);
}

function startAreaMove(e, ai){
  e.preventDefault(); e.stopPropagation();
  const p = pctPoint(e);
  const a = state.planta.areas[ai];
  areaDrag = {type:'move', index:ai, start:p, orig:{x:a.x, y:a.y}};
  document.addEventListener('pointermove', onAreaPointerMove);
  document.addEventListener('pointerup', endAreaPointer);
}

function startAreaResize(e, ai){
  e.preventDefault(); e.stopPropagation();
  areaDrag = {type:'resize', index:ai};
  document.addEventListener('pointermove', onAreaPointerMove);
  document.addEventListener('pointerup', endAreaPointer);
}

function onAreaPointerMove(e){
  if(!areaDrag) return;
  const img = document.getElementById('plantaImg');
  if(!img) return;
  const p = pctPoint(e);
  if(areaDrag.type==='draw'){
    const s = areaDrag.start;
    const x = Math.min(s.x, p.x), y = Math.min(s.y, p.y);
    const w = Math.abs(p.x-s.x), h = Math.abs(p.y-s.y);
    areaDrag.rect = {x, y, w, h};
    const d = document.getElementById('area-preview');
    if(d){ d.style.left=x+'%'; d.style.top=y+'%'; d.style.width=w+'%'; d.style.height=h+'%'; }
  } else if(areaDrag.type==='move'){
    const a = state.planta.areas[areaDrag.index];
    if(!a) return;
    const dx = p.x - areaDrag.start.x, dy = p.y - areaDrag.start.y;
    a.x = Math.max(0, Math.min(100-a.w, areaDrag.orig.x+dx));
    a.y = Math.max(0, Math.min(100-a.h, areaDrag.orig.y+dy));
    updateAreaDOM(areaDrag.index);
  } else if(areaDrag.type==='resize'){
    const a = state.planta.areas[areaDrag.index];
    if(!a) return;
    a.w = Math.max(MIN_DIM, Math.min(100-a.x, p.x-a.x));
    a.h = Math.max(MIN_DIM, Math.min(100-a.y, p.y-a.y));
    updateAreaDOM(areaDrag.index);
  }
}

function updateAreaDOM(ai){
  const a = state.planta.areas[ai];
  const d = document.getElementById('arearect-'+ai);
  if(d){ d.style.left=a.x+'%'; d.style.top=a.y+'%'; d.style.width=a.w+'%'; d.style.height=a.h+'%'; }
}

function endAreaPointer(){
  document.removeEventListener('pointermove', onAreaPointerMove);
  document.removeEventListener('pointerup', endAreaPointer);
  const drag = areaDrag;
  areaDrag = null;
  if(drag && drag.type==='draw'){
    const d = document.getElementById('area-preview');
    if(d) d.remove();
    const r = drag.rect;
    if(r && r.w>=MIN_DIM && r.h>=MIN_DIM){
      const catId = state.planta.selectedAreaCat||'area1';
      state.planta.areas.push({catId, descricao: areaCatById(catId).desc||'', x:r.x, y:r.y, w:r.w, h:r.h});
      renderContent();
    }
  }
}
```

- [ ] **Step 2: Integração em `js/tabs/planta.js`.**

(a) Import no topo:
```js
import { tplAreaPalette, tplAreaRows, renderAreas, startAreaDraw, areaDragAtivo } from './areas.js';
```

(b) Botão da ferramenta — em `tplPlanta`, dentro de `<div class="toolbar-types">`, logo após o `.map` dos `EQUIP_TYPES`:
```js
        <button class="type-btn ${pl.selectedTipo==='area'?'active':''}" onclick="selectTipo('area')">
          <span class="icon-dot" style="background:#5A6B82">▧</span>Demarcar Área
        </button>
```

(c) Paleta — logo após o bloco da `cerca-bar` (o `${pl.selectedTipo==='cerca' && ...}`):
```js
      ${pl.selectedTipo==='area' && pl.imagem ? tplAreaPalette() : ''}
```

(d) Modo área no scroll — trocar `<div id="plantaScroll">` por:
```js
      <div id="plantaScroll" class="${pl.selectedTipo==='area' ? 'modo-area' : ''}">
```

(e) Lista — a condição de lista vazia vira `(pl.pins.length===0 && pl.cercas.length===0 && pl.areas.length===0) ?` e, após o `.map` das cercas, adicionar:
```js
        ${tplAreaRows()}
```

(f) Guarda no clique — em `img.onclick` (dentro de `afterPlantaRender`), logo após o guard de `suppressNextClick`:
```js
      if(state.planta.selectedTipo==='area') return;
```

(g) Desenho — ainda em `afterPlantaRender`, dentro do `if(img){...}`, após definir `img.onclick`:
```js
    img.onpointerdown = (e)=>{
      if(state.planta.selectedTipo==='area' && e.isPrimary) startAreaDraw(e);
    };
```

(h) Render — dentro do `if(wrap){...}`, logo após `renderCercas(wrap);`:
```js
    renderAreas(wrap);
```

(i) Pinch — em `attachPinchZoom`, trocar `if(dragState) return;` por:
```js
    if(dragState || areaDragAtivo()) return;
```

(j) Upload zera áreas — em `handlePlantaUpload`, após `state.planta.cercas = [];`:
```js
  state.planta.areas = [];
```

- [ ] **Step 3: Wiring no `js/main.js`.** Adicionar import:
```js
import { selectAreaCat, setAreaCat, removeArea } from './tabs/areas.js';
```
e no `Object.assign(window, {...})`, após a linha das funções de cerca:
```js
  selectAreaCat, setAreaCat, removeArea,
```

- [ ] **Step 4: CSS** — ao final de `css/style.css`:

```css
  .area-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#F3F6FB;border:1px solid #D6DDE7;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;}
  .area-chip{border:2px solid var(--chip-cor);background:#fff;color:var(--text-dark);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;}
  .area-chip.active{background:var(--chip-cor);color:#fff;}
  .area-chip-label{position:absolute;top:2px;left:2px;color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:3px;pointer-events:none;}
  .area-handle{width:18px;height:18px;}
  #plantaScroll.modo-area{touch-action:none;}
  @media (pointer: coarse){
    .area-handle{width:28px;height:28px;}
  }
```

- [ ] **Step 5: Verificação.**
Run: `node -e "import('file:///c:/sk8/SGP-Projetos/claudefiles/js/nav.js').then(()=>console.log('IMPORT OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: IMPORT OK
Run: `grep -n "selectAreaCat\|setAreaCat\|removeArea" js/main.js js/tabs/areas.js`
Expected: exports em areas.js + import e Object.assign em main.js, mesmos nomes.
Run: `grep -n "renderAreas\|startAreaDraw\|areaDragAtivo\|modo-area\|tplAreaPalette\|tplAreaRows" js/tabs/planta.js`
Expected: todas as integrações (b)–(i) presentes.
Verificação interativa (desenhar/mover/redimensionar, touch) fica para o controlador/usuário.

- [ ] **Step 6: Commit**

```bash
git add js/tabs/areas.js js/tabs/planta.js js/main.js css/style.css
git commit -m "Demarcadores de área: desenho clica-e-arrasta, paleta de categorias, mover/redimensionar e lista"
```

---

### Task 3: Áreas no PDF — Mapeamento + legenda na Estrutura

**Files:**
- Modify: `js/pdf.js` (funções `pageMapeamento` e `pageEstrutura`)

**Interfaces:**
- Consumes: `state.planta.areas` (Task 1), `areaCatById` (utils.js, Task 1), `rect` do contain-fit dentro de `pageMapeamento` (já existente).

- [ ] **Step 1: Import.** Em `js/pdf.js`, adicionar `areaCatById` ao import de utils:
```js
import { showToast, fmtDate, typeById, areaCatById } from './utils.js';
```

- [ ] **Step 2: Retângulos no Mapeamento.** Em `pageMapeamento`, logo após o bloco que monta `cercaHtml`, adicionar:

```js
  const areasHtml = (state.planta.areas||[]).map(a=>{
    const cat = areaCatById(a.catId);
    const x = rect.x + (a.x/100)*rect.w, y = rect.y + (a.y/100)*rect.h;
    const w = (a.w/100)*rect.w, h = (a.h/100)*rect.h;
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${cat.color}38;border:2px solid ${cat.color};border-radius:4px;box-sizing:border-box;"><span style="position:absolute;top:2px;left:2px;background:${cat.color};color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:3px;">${cat.label}</span></div>`;
  }).join('');
```

e no HTML retornado, trocar `${cercaHtml}` + `${pinsHtml}` por (áreas por baixo de tudo):
```js
      ${areasHtml}
      ${cercaHtml}
      ${pinsHtml}
```

- [ ] **Step 3: Seção na legenda da Estrutura.** Em `pageEstrutura`, dentro da `<div>` da legenda (a de `width:440px`), logo após o `.map` da `legend` (antes de fechar a div), adicionar:

```js
      ${(state.planta.areas||[]).length ? `
        <div style="font-weight:800;color:${BRAND.cor};font-size:15px;margin:18px 0 12px;">Áreas Demarcadas</div>
        ${state.planta.areas.map(a=>{
          const cat = areaCatById(a.catId);
          return `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
            <div style="width:16px;height:16px;border-radius:4px;background:${cat.color}66;border:2px solid ${cat.color};margin-top:1px;flex-shrink:0;"></div>
            <div style="font-size:13px;color:#33415A;line-height:1.4;"><b>${cat.label}</b>${a.descricao ? ' — '+a.descricao : ''}</div>
          </div>`;
        }).join('')}` : ''}
```

- [ ] **Step 4: Verificação.**
Run: `node -e "import('file:///c:/sk8/SGP-Projetos/claudefiles/js/pdf.js').then(()=>console.log('IMPORT OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: IMPORT OK
Run: `grep -n "areasHtml\|Áreas Demarcadas" js/pdf.js`
Expected: `areasHtml` definido e emitido antes de `cercaHtml` no Mapeamento; seção "Áreas Demarcadas" na Estrutura.
Verificação visual do PDF fica para o controlador/usuário.

- [ ] **Step 5: Commit**

```bash
git add js/pdf.js
git commit -m "Demarcadores de área no PDF: retângulos no Mapeamento e legenda na Estrutura"
```

---

## Self-Review (feita na escrita do plano)

- **Cobertura do spec:** categorias/cores→T1; modelo/persistência→T1; desenho/paleta/edição/lista/touch→T2; PDF Mapeamento+legenda→T3. Guardas: pin dentro de área (pointer-events none fora do modo), clique não cria pin em modo área (T2-f), pinch × drag de área (T2-i), upload zera áreas (T2-j), json antigo (T1-4).
- **Placeholders:** nenhum.
- **Consistência de nomes:** `AREA_CATS`/`areaCatById`/`selectAreaCat`/`setAreaCat`/`removeArea`/`tplAreaPalette`/`tplAreaRows`/`renderAreas`/`startAreaDraw`/`areaDragAtivo`/`arearect-N`/`area-preview` conferidos entre T1–T3.
