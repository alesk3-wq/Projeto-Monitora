# Reorganizar em Pastas (CSS/JS/Assets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar o `index.html` monolítico (858 linhas de HTML+CSS+JS inline) em `css/style.css`, `assets/logo-bracell.png` e 14 módulos ES em `js/`, sem mudar nenhum comportamento da ferramenta.

**Architecture:** Extração mecânica (lift-and-shift) — o código de cada função é copiado verbatim do `index.html` atual para o novo arquivo, ganhando só `export`/`import`. A app fica organizada por responsabilidade: `constants.js` (dados fixos) → `utils.js`/`state.js` (fundação) → `js/tabs/*.js` (uma aba por arquivo) → `nav.js`/`persistence.js`/`pdf.js` (orquestração) → `main.js` (bootstrap + ponte para os handlers inline via `window`).

**Tech Stack:** HTML/CSS/JS vanilla, ES modules nativos do navegador (sem bundler/transpiler). Servidor estático local para dev (`npx serve .`).

## Global Constraints

- **Zero mudança de comportamento.** É uma reorganização de arquivos, não uma reescrita. Todo HTML gerado pelos templates (`tpl*`) deve ficar byte-a-byte igual ao atual, incluindo os atributos `onclick=`/`oninput=`/`onchange=` inline — eles não mudam de sintaxe, só passam a apontar para funções expostas em `window`.
- **Sem framework de testes automatizados** (mesma situação do projeto hoje, client-side, sem servidor). Verificação por task usa `node --check <arquivo>` (Node v24 confirmado disponível neste ambiente) — pega erros de sintaxe/`import`/`export`, mas não verifica comportamento em runtime. A verificação de comportamento real só acontece na Task 8 (integração), via navegador com servidor local.
- **Circular import intencional e seguro:** `js/nav.js` importa `tpl*`/`after*Render` dos módulos em `js/tabs/`. Quatro desses módulos (`estrutura.js`, `premissas.js`, `planta.js`, `equipamentos.js`) contêm funções de mutação que por sua vez importam `renderContent`/`switchTab` de volta de `js/nav.js` — um ciclo. Isso é seguro em ES modules porque: declarações de função são "hoisted" (o binding exportado já existe antes do módulo terminar de rodar seu código de topo), e nenhum dos dois lados chama a função importada durante a avaliação do módulo — só depois, dentro de callbacks de evento disparados pelo usuário, quando o grafo de módulos já carregou por completo. **Não tente "consertar" isso reestruturando ou fundindo arquivos** — é esperado.
- **`state` só é reatribuído inteiro dentro de `js/state.js`** (via `setState`). Nenhum outro módulo pode fazer `state = algumaCoisa` — só mutar propriedades (`state.x = y`), porque um binding importado (`import { state } from ...`) não pode ser reatribuído fora do módulo que o declara.
- **A ferramenta passa a exigir servidor local.** Depois da Task 8, não dá mais para abrir `index.html` por duplo-clique (ES modules são bloqueados em `file://`). Rodar com `npx serve .` na pasta do projeto.
- Todas as bibliotecas externas (`html2canvas`, `jsPDF` via CDN, Google Fonts) continuam exatamente como estão hoje — nenhuma mudança nelas.

---

### Task 1: Fundação — CSS, logo, constantes, utilitários e estado

**Files:**
- Create: `claudefiles/css/style.css`
- Create: `claudefiles/assets/logo-bracell.png`
- Create: `claudefiles/js/constants.js`
- Create: `claudefiles/js/utils.js`
- Create: `claudefiles/js/state.js`
- Reference (read-only nesta task, não editar ainda): `claudefiles/index.html`

**Interfaces:**
- Consumes: nada (é a base da árvore de dependências)
- Produces:
  - `css/style.css`: nenhuma interface JS — só CSS
  - `constants.js` exporta: `BRAND`, `EQUIP_TYPES`, `ICONS`, `TABS`, `PW`, `PH`
  - `utils.js` exporta: `todayISO()`, `showToast(msg)`, `fileToDataURL(file)`, `typeById(id)`, `fmtDate(iso)`
  - `state.js` exporta: `state` (objeto mutável, `let`), `setState(novoEstado)`

- [ ] **Step 1: Criar `css/style.css` com o conteúdo do bloco `<style>`**

Copie **verbatim** as linhas 12–83 do `claudefiles/index.html` atual (todo o conteúdo entre `<style>` na linha 11 e `</style>` na linha 84, sem incluir as próprias tags `<style>`/`</style>`) para um novo arquivo `claudefiles/css/style.css`. Não mude nenhuma regra CSS.

- [ ] **Step 2: Extrair o logo para `assets/logo-bracell.png`**

Rode este comando a partir da pasta `claudefiles/` (decodifica a constante `LOGO_B64` do `index.html` atual, que é uma data URL `data:image/png;base64,...`, para um arquivo PNG real):

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/const LOGO_B64 = \"data:image\/png;base64,([^\"]+)\"/);
if (!match) { console.error('LOGO_B64 not found'); process.exit(1); }
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/logo-bracell.png', Buffer.from(match[1], 'base64'));
console.log('wrote assets/logo-bracell.png,', fs.statSync('assets/logo-bracell.png').size, 'bytes');
"
```

Expected: imprime `wrote assets/logo-bracell.png, NNNNN bytes` com um tamanho de dezenas de KB (é um PNG real). Não delete/edite `LOGO_B64` no `index.html` ainda — isso só acontece na Task 8, quando o `index.html` inteiro é reescrito.

- [ ] **Step 3: Criar `js/constants.js`**

Copie **verbatim** de `claudefiles/index.html`:
- Linhas 110–118 (`const BRAND = {...}`)
- Linhas 121–132 (`const EQUIP_TYPES = [...]`)
- Linhas 134–145 (`const ICONS = {...}`)
- Linhas 157–165 (`const TABS = [...]`)
- Linha 672 (`const PW = 1414, PH = 1000;`)

Monte o arquivo assim (adicionando `export` antes de cada `const`, e trocando `logo: LOGO_B64,` por `logo: 'assets/logo-bracell.png',` — esse é o único conteúdo que muda em relação ao original):

```js
export const BRAND = {
  nome: 'Bracell',
  departamento: 'Segurança Patrimonial',
  logo: 'assets/logo-bracell.png',
  cor: '#0A2E5C',
  corSecundaria: '#0066B3',
  corAcento: '#7CC242',
  slogan: 'Servir e Proteger',
};

export const EQUIP_TYPES = [
  // ...copie as 10 linhas de objetos {id:..., label:..., color:..., cameraLike:...}
  // verbatim das linhas 122-131 do index.html original, sem nenhuma mudança
];

export const ICONS = {
  // ...copie os 10 pares chave:'<svg>...</svg>' verbatim das linhas 135-144
  // do index.html original, sem nenhuma mudança (são strings SVG longas — copie exatamente)
};

export const TABS = [
  {id:'projeto', label:'Dados do Projeto', num:'•'},
  {id:'objetivo', label:'Problema & Solução', num:'01'},
  {id:'estrutura', label:'Estrutura', num:'02'},
  {id:'planta', label:'Planta / Mapeamento', num:'03'},
  {id:'equipamentos', label:'Fichas de Equipamentos', num:'04'},
  {id:'premissas', label:'Premissas', num:'05'},
  {id:'gerar', label:'Gerar Proposta', num:'✓'},
];

export const PW = 1414, PH = 1000;
```

- [ ] **Step 4: Criar `js/utils.js`**

Copie **verbatim** de `claudefiles/index.html` as linhas 147 (`todayISO`), 169–174 (`showToast`), 175–182 (`fileToDataURL`), 183 (`typeById`), 184–189 (`fmtDate`). Adicione `export` antes de cada `function`, e importe `EQUIP_TYPES` (usado por `typeById`):

```js
import { EQUIP_TYPES } from './constants.js';

export function todayISO(){ return new Date().toISOString().slice(0,10); }

export function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

export function fileToDataURL(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function typeById(id){ return EQUIP_TYPES.find(t=>t.id===id) || EQUIP_TYPES[EQUIP_TYPES.length-1]; }

export function fmtDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${parseInt(d)} | ${meses[parseInt(m)-1]} | ${y}`;
}
```

- [ ] **Step 5: Criar `js/state.js`**

Copie **verbatim** de `claudefiles/index.html` as linhas 149–155 (o objeto `state` inicial). Adicione `export`, importe `todayISO`, e adicione a nova função `setState`:

```js
import { todayISO } from './utils.js';

export let state = {
  projeto: { unidade:'', local:'', equipe:'Núcleo de Tecnologia', responsavel:'', data: todayISO() },
  objetivo: { problema:'', solucao:'' },
  estrutura: [ { titulo:'Controle de Acesso', itens:[ {qtd:1, nome:'', desc:''} ] } ],
  planta: { imagem:null, selectedTipo:'bullet', pins:[], zoom:100 },
  premissas: [ {titulo:'', desc:''} ],
};

export function setState(novoEstado){ state = novoEstado; }
```

- [ ] **Step 6: Verificar sintaxe dos 3 arquivos JS**

```bash
node --check js/constants.js
node --check js/utils.js
node --check js/state.js
```

Expected: nenhum dos três comandos imprime nada e todos saem com código 0 (sem erro de sintaxe).

- [ ] **Step 7: Conferir que `EQUIP_TYPES` e `ICONS` foram copiados por completo**

```bash
node -e "
const fs = require('fs');
const orig = fs.readFileSync('index.html','utf8').split('\n');
const equipOrig = orig.slice(121,132).join('\n');
const iconsOrig = orig.slice(134,145).join('\n');
console.log('EQUIP_TYPES linhas originais:', equipOrig.split('\n').length);
console.log('ICONS linhas originais:', iconsOrig.split('\n').length);
"
```

Confirme manualmente que `js/constants.js` tem exatamente os mesmos 10 objetos em `EQUIP_TYPES` (ids: `bullet, dome, ptz, lpr, acesso_veic, acesso_ped, fechadura, biometria, cerca, outro`) e as mesmas 10 chaves em `ICONS` (mesmos ids), sem nenhum truncamento nas strings SVG.

- [ ] **Step 8: Salvar** (sem commit — controlador faz o commit depois da revisão)

---

### Task 2: Abas simples — Projeto, Objetivo, Gerar

**Files:**
- Create: `claudefiles/js/tabs/projeto.js`
- Create: `claudefiles/js/tabs/objetivo.js`
- Create: `claudefiles/js/tabs/gerar.js`

**Interfaces:**
- Consumes: `state` de `../state.js` (Task 1, já commitado)
- Produces: `projeto.js` exporta `tplProjeto()`; `objetivo.js` exporta `tplObjetivo()`; `gerar.js` exporta `tplGerar()`. Essas três funções não têm parâmetros e retornam uma string HTML — mesma assinatura de hoje.

Essas três abas são as mais simples: cada uma só lê `state`, não muta nada, e não chama `renderContent`/outras funções de módulos ainda não criados.

- [ ] **Step 1: Criar `js/tabs/projeto.js`**

Copie **verbatim** as linhas 213–232 de `claudefiles/index.html` (função `tplProjeto`):

```js
import { state } from '../state.js';

export function tplProjeto(){
  const p = state.projeto;
  return `
    <h1 class="pagetitle">Dados do Projeto</h1>
    <p class="pagesub">Unidade/área da Bracell que está recebendo a proposta de Segurança Eletrônica.</p>
    <div class="card">
      <div class="row">
        <div><label>Unidade / Local (ex: Auto Posto Bracell)</label><input type="text" value="${p.unidade}" oninput="state.projeto.unidade=this.value"></div>
        <div><label>Equipe / Núcleo responsável</label><input type="text" value="${p.equipe}" oninput="state.projeto.equipe=this.value"></div>
      </div>
      <label>Endereço / detalhamento do local</label>
      <input type="text" value="${p.local}" oninput="state.projeto.local=this.value">
      <div class="row">
        <div><label>Responsável técnico (Especialista)</label><input type="text" value="${p.responsavel}" oninput="state.projeto.responsavel=this.value"></div>
        <div><label>Data</label><input type="date" value="${p.data}" oninput="state.projeto.data=this.value"></div>
      </div>
      <div class="hint">O documento sempre sai assinado como Bracell · Depto. Segurança Patrimonial.</div>
    </div>
  `;
}
```

- [ ] **Step 2: Criar `js/tabs/objetivo.js`**

Copie **verbatim** as linhas 234–246 de `claudefiles/index.html` (função `tplObjetivo`):

```js
import { state } from '../state.js';

export function tplObjetivo(){
  const o = state.objetivo;
  return `
    <h1 class="pagetitle">01 · Problema & Solução</h1>
    <p class="pagesub">Equivalente às seções "Área a ser Monitorada" e "Diretriz da Proposta" do padrão atual.</p>
    <div class="card">
      <label>Problema / Contexto de risco (área a ser monitorada, vulnerabilidades, riscos atuais)</label>
      <textarea style="min-height:130px" oninput="state.objetivo.problema=this.value">${o.problema}</textarea>
      <label>Solução / Diretriz da proposta (visão geral da solução proposta)</label>
      <textarea style="min-height:130px" oninput="state.objetivo.solucao=this.value">${o.solucao}</textarea>
    </div>
  `;
}
```

- [ ] **Step 3: Criar `js/tabs/gerar.js`**

Copie **verbatim** as linhas 577–598 de `claudefiles/index.html` (função `tplGerar`):

```js
import { state } from '../state.js';

export function tplGerar(){
  const totalItens = state.estrutura.reduce((s,g)=>s+g.itens.reduce((s2,it)=>s2+(parseInt(it.qtd)||0),0),0);
  const totalPins = state.planta.pins.length;
  const totalFichas = state.planta.pins.filter(p=>p.fotoLocal && p.fotoView).length;
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
      <div style="font-weight:700;margin-bottom:4px;">Unidade</div>
      <div style="color:var(--text-mid);margin-bottom:14px;">${state.projeto.unidade || '— não preenchido —'}</div>
      <div style="font-weight:700;margin-bottom:4px;">Planta baixa</div>
      <div style="color:var(--text-mid);margin-bottom:14px;">${state.planta.imagem ? 'Anexada ✓' : 'Não anexada — a página de mapeamento sairá em branco'}</div>
      <button class="btn primary" style="font-size:15px;padding:13px 22px;" onclick="gerarPDF()">⬇ Gerar PDF da Proposta</button>
    </div>
  `;
}
```

Note que `onclick="gerarPDF()"` continua uma string literal igual a hoje — `gerar.js` não importa `gerarPDF`, só o gera como texto dentro do HTML (a função de verdade vem de `js/pdf.js`, exposta em `window` na Task 8).

- [ ] **Step 4: Verificar sintaxe**

```bash
node --check js/tabs/projeto.js
node --check js/tabs/objetivo.js
node --check js/tabs/gerar.js
```

Expected: os três comandos saem sem output, código 0.

- [ ] **Step 5: Salvar** (sem commit)

---

### Task 3: Abas de listas — Estrutura e Premissas

**Files:**
- Create: `claudefiles/js/tabs/estrutura.js`
- Create: `claudefiles/js/tabs/premissas.js`

**Interfaces:**
- Consumes: `state` de `../state.js` (Task 1); `typeById` de `../utils.js` (Task 1); `showToast` de `../utils.js` (Task 1); `renderContent` e `switchTab` de `../nav.js` — **`nav.js` ainda não existe** (é criado na Task 6). Isso é esperado: o import circular descrito nas Global Constraints. `node --check` valida sintaxe sem precisar resolver o módulo importado, então este `import` de um arquivo que ainda não existe não quebra a verificação desta task.
- Produces: `estrutura.js` exporta `tplEstrutura()`, `addGroup()`, `removeGroup(gi)`, `addItem(gi)`, `removeItem(gi,ii)`, `importFromPlanta()`. `premissas.js` exporta `tplPremissas()`, `addPremissa()`, `removePremissa(i)`, `addPremissasPadrao()`.

- [ ] **Step 1: Criar `js/tabs/estrutura.js`**

Copie **verbatim** de `claudefiles/index.html`: linhas 248–275 (`tplEstrutura`), 601 (`addGroup`), 602 (`removeGroup`), 603 (`addItem`), 604 (`removeItem`), 616–628 (`importFromPlanta`):

```js
import { state } from '../state.js';
import { typeById, showToast } from '../utils.js';
import { renderContent, switchTab } from '../nav.js';

export function tplEstrutura(){
  const groups = state.estrutura;
  return `
    <h1 class="pagetitle">02 · Estrutura de Equipamentos</h1>
    <p class="pagesub">Agrupe os equipamentos por função de segurança (ex: Defesa Perimetral, Controle de Acesso).</p>
    ${groups.map((g,gi)=>`
      <div class="group">
        <div class="group-head">
          <input type="text" style="margin-bottom:0;font-weight:700;max-width:360px;" placeholder="Nome do grupo (ex: Defesa Perimetral Anti-Invasão)" value="${g.titulo}" oninput="state.estrutura[${gi}].titulo=this.value">
          <button class="btn danger" onclick="removeGroup(${gi})">Remover grupo</button>
        </div>
        ${g.itens.map((it,ii)=>`
          <div class="item-row">
            <input class="qtd" type="number" min="0" placeholder="Qtd" value="${it.qtd}" oninput="state.estrutura[${gi}].itens[${ii}].qtd=this.value">
            <input class="nome" type="text" placeholder="Equipamento (ex: Câmera Bullet c/ IA)" value="${it.nome}" oninput="state.estrutura[${gi}].itens[${ii}].nome=this.value">
            <input class="desc" type="text" placeholder="Descrição / finalidade" value="${it.desc}" oninput="state.estrutura[${gi}].itens[${ii}].desc=this.value">
            <button class="btn danger small" onclick="removeItem(${gi},${ii})">✕</button>
          </div>
        `).join('')}
        <button class="btn ghost small" onclick="addItem(${gi})">+ Item</button>
      </div>
    `).join('')}
    <div style="display:flex;gap:10px;">
      <button class="btn ghost" onclick="addGroup()">+ Novo grupo</button>
      <button class="btn ghost" onclick="importFromPlanta()">↺ Gerar a partir da planta</button>
    </div>
  `;
}

export function addGroup(){ state.estrutura.push({titulo:'', itens:[{qtd:1,nome:'',desc:''}]}); renderContent(); }
export function removeGroup(gi){ state.estrutura.splice(gi,1); renderContent(); }
export function addItem(gi){ state.estrutura[gi].itens.push({qtd:1,nome:'',desc:''}); renderContent(); }
export function removeItem(gi,ii){ state.estrutura[gi].itens.splice(ii,1); renderContent(); }

export function importFromPlanta(){
  const map = {};
  state.planta.pins.forEach(p=>{
    const key = p.tipoId+'|'+p.label;
    if(!map[key]) map[key] = {qtd:0, nome:p.label||typeById(p.tipoId).label, desc:''};
    map[key].qtd += (parseInt(p.qtd)||1);
  });
  const itens = Object.values(map);
  if(itens.length===0){ showToast('Nenhum ponto na planta para importar.'); return; }
  state.estrutura.push({titulo:'Equipamentos Mapeados', itens});
  showToast('Grupo criado a partir da planta.');
  switchTab('estrutura');
}
```

- [ ] **Step 2: Criar `js/tabs/premissas.js`**

Copie **verbatim** de `claudefiles/index.html`: linhas 554–575 (`tplPremissas`), 606 (`addPremissa`), 607 (`removePremissa`), 608–615 (`addPremissasPadrao`):

```js
import { state } from '../state.js';
import { renderContent } from '../nav.js';

export function tplPremissas(){
  const list = state.premissas;
  return `
    <h1 class="pagetitle">05 · Premissas</h1>
    <p class="pagesub">Condições, responsabilidades e requisitos técnicos do projeto.</p>
    <div class="card">
      ${list.map((p,i)=>`
        <div class="group">
          <div class="item-row">
            <input class="nome" style="width:280px" type="text" placeholder="Título (ex: Retenção de Dados)" value="${p.titulo}" oninput="state.premissas[${i}].titulo=this.value">
            <input class="desc" type="text" placeholder="Descrição" value="${p.desc}" oninput="state.premissas[${i}].desc=this.value">
            <button class="btn danger small" onclick="removePremissa(${i})">✕</button>
          </div>
        </div>
      `).join('')}
      <div style="display:flex;gap:10px;">
        <button class="btn ghost" onclick="addPremissa()">+ Premissa</button>
        <button class="btn ghost" onclick="addPremissasPadrao()">+ Sugestões padrão</button>
      </div>
    </div>
  `;
}

export function addPremissa(){ state.premissas.push({titulo:'',desc:''}); renderContent(); }
export function removePremissa(i){ state.premissas.splice(i,1); renderContent(); }
export function addPremissasPadrao(){
  state.premissas.push(
    {titulo:'Retenção de Dados', desc:'O sistema deve possuir infraestrutura de storage capaz de manter, no mínimo, 30 dias de gravação contínua para auditorias e perícias.'},
    {titulo:'Disponibilidade de Monitoramento', desc:'Deve ser garantida a disponibilidade de monitoramento em tempo real na Central de Operações (CCOS).'},
    {titulo:'Infraestrutura de Rede e TI', desc:'É responsabilidade da TI garantir que os equipamentos da central atendam integralmente às necessidades operacionais, evitando falhas, latências ou gargalos.'},
  );
  renderContent();
}
```

- [ ] **Step 3: Verificar sintaxe**

```bash
node --check js/tabs/estrutura.js
node --check js/tabs/premissas.js
```

Expected: sem output, código 0. (O `import` de `../nav.js`, que ainda não existe, não causa erro em `--check` — é só uma verificação de sintaxe, não resolve módulos.)

- [ ] **Step 4: Salvar** (sem commit)

---

### Task 4: Aba Planta (posicionamento, arrastar, girar, touch)

**Files:**
- Create: `claudefiles/js/tabs/planta.js`

**Interfaces:**
- Consumes: `state` de `../state.js`; `EQUIP_TYPES`, `ICONS` de `../constants.js`; `typeById`, `fileToDataURL` de `../utils.js`; `renderContent` de `../nav.js` (não existe ainda — mesmo caso da Task 3, `node --check` não resolve módulos)
- Produces: exporta `tplPlanta()`, `afterPlantaRender()`, `startPinDrag(e,pi)`, `startRotateDrag(e,pi)`, `onPointerDrag(e)`, `endPointerDrag()`, `updatePinDOM(pi)`, `syncPinRowControls()`, `zoomPlanta(delta)`, `resetZoom()`, `liveUpdateCone(pi,deg)`, `removePin(pi)`, `handlePlantaUpload(e)`

Esta é a aba com mais lógica (drag com Pointer Events, touch, rotação) — merece task e revisão isoladas. `dragState` e `suppressNextClick` são variáveis privadas do módulo (não exportadas — só usadas dentro deste arquivo, igual hoje).

- [ ] **Step 1: Criar `js/tabs/planta.js` com o template e o estado de drag**

Copie **verbatim** de `claudefiles/index.html` as linhas 277–323 (`tplPlanta`) e 325–326 (`dragState`, `suppressNextClick`):

```js
import { state } from '../state.js';
import { EQUIP_TYPES, ICONS } from '../constants.js';
import { typeById, fileToDataURL } from '../utils.js';
import { renderContent } from '../nav.js';

export function tplPlanta(){
  const pl = state.planta;
  return `
    <h1 class="pagetitle">03 · Planta / Mapeamento</h1>
    <p class="pagesub">Envie a planta baixa, escolha o tipo de equipamento e clique para posicionar. Depois é só arrastar o ícone para reposicionar, e (para câmeras) arrastar o ponto branco ao redor dele para girar a direção de visualização.</p>
    <div class="card">
      <label>Planta baixa (imagem)</label>
      <input type="file" accept="image/*" onchange="handlePlantaUpload(event)" style="margin-bottom:16px;">
      <div class="toolbar-types">
        ${EQUIP_TYPES.map(t=>`
          <button class="type-btn ${pl.selectedTipo===t.id?'active':''}" onclick="state.planta.selectedTipo='${t.id}'; renderContent();">
            <span class="icon-dot" style="background:${t.color}">${ICONS[t.id]}</span>${t.label}
          </button>`).join('')}
      </div>
      ${pl.imagem ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <button class="btn ghost small" onclick="zoomPlanta(-20)">➖ Zoom</button>
        <span style="font-size:13px;font-weight:700;min-width:44px;text-align:center;">${pl.zoom||100}%</span>
        <button class="btn ghost small" onclick="zoomPlanta(20)">➕ Zoom</button>
        <button class="btn ghost small" onclick="resetZoom()">Resetar</button>
        <span class="hint" style="margin:0;">Dê zoom para posicionar com mais precisão; role a área para navegar.</span>
      </div>` : ''}
      <div id="plantaScroll">
        ${pl.imagem
          ? `<div id="plantaWrap" style="position:relative;width:${pl.zoom||100}%;">
               <img id="plantaImg" src="${pl.imagem}">
             </div>`
          : `<div class="empty-hint">Envie uma imagem da planta baixa para começar a posicionar os equipamentos.</div>`}
      </div>
      <div class="pinlist">
        ${pl.pins.length===0 ? `<div class="hint">Nenhum equipamento posicionado ainda.</div>` : pl.pins.map((p,pi)=>`
          <div class="pinrow">
            <span class="icon-dot" style="background:${typeById(p.tipoId).color}">${ICONS[p.tipoId]}</span>
            <b style="font-size:12px;color:var(--text-mid);width:18px;">${pi+1}</b>
            <select onchange="state.planta.pins[${pi}].tipoId=this.value; renderContent();">
              ${EQUIP_TYPES.map(t=>`<option value="${t.id}" ${t.id===p.tipoId?'selected':''}>${t.label}</option>`).join('')}
            </select>
            <input type="text" style="flex:1;min-width:140px;" placeholder="Rótulo (ex: Monitoramento bombas/Pit)" value="${p.label}" oninput="state.planta.pins[${pi}].label=this.value">
            <input type="number" min="1" style="width:60px" value="${p.qtd}" oninput="state.planta.pins[${pi}].qtd=this.value">
            ${typeById(p.tipoId).cameraLike ? `<span style="font-size:11px;color:var(--text-mid);">Direção</span><input id="dirslider-${pi}" type="range" min="0" max="359" value="${p.direcao||0}" style="width:80px;margin-bottom:0;" oninput="liveUpdateCone(${pi}, this.value)"><span id="deglabel-${pi}" style="font-size:11px;color:var(--text-mid);width:32px;">${p.direcao||0}°</span>` : ''}
            <button class="btn danger small" onclick="removePin(${pi})">✕</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

let dragState = null;
let suppressNextClick = false;
```

- [ ] **Step 2: Adicionar a lógica de drag/rotação/touch**

Copie **verbatim** as linhas 328–470 de `claudefiles/index.html` (`afterPlantaRender` até `liveUpdateCone`) logo depois do que foi escrito no Step 1, adicionando `export` antes de cada `function`:

```js
export function afterPlantaRender(){
  const img = document.getElementById('plantaImg');
  const wrap = document.getElementById('plantaWrap');
  if(img){
    img.onclick = (e)=>{
      if(suppressNextClick){ suppressNextClick = false; return; }
      const rect = img.getBoundingClientRect();
      const x = ((e.clientX-rect.left)/rect.width)*100;
      const y = ((e.clientY-rect.top)/rect.height)*100;
      const t = typeById(state.planta.selectedTipo);
      state.planta.pins.push({tipoId:t.id, label:t.label, qtd:1, x, y, direcao:0, fotoLocal:null, fotoView:null});
      renderContent();
    };
  }
  if(wrap){
    state.planta.pins.forEach((p,pi)=>{
      const t = typeById(p.tipoId);
      if(t.cameraLike){
        const cone = document.createElement('div');
        cone.id = 'cone-'+pi;
        cone.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;width:110px;height:110px;transform:translate(-50%,-50%) rotate(${p.direcao||0}deg);transform-origin:50% 50%;clip-path:polygon(50% 50%, 26% 0%, 74% 0%);background:${t.color}55;pointer-events:none;z-index:1;`;
        wrap.appendChild(cone);

        const R = 58;
        const rad = (p.direcao||0) * Math.PI/180;
        const hx = R*Math.sin(rad), hy = -R*Math.cos(rad);
        const handle = document.createElement('div');
        handle.id = 'rothandle-'+pi;
        handle.title = 'Arraste para girar a direção';
        handle.style.cssText = `position:absolute;left:calc(${p.x}% + ${hx}px);top:calc(${p.y}% + ${hy}px);width:20px;height:20px;border-radius:50%;background:#fff;border:2.5px solid ${t.color};transform:translate(-50%,-50%);cursor:grab;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.45);touch-action:none;`;
        handle.onpointerdown = (e)=>startRotateDrag(e, pi);
        wrap.appendChild(handle);
      }
      const pin = document.createElement('div');
      pin.id = 'pinicon-'+pi;
      pin.title = 'Arraste para reposicionar';
      pin.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:3;cursor:grab;touch-action:none;`;
      pin.innerHTML = ICONS[t.id] + `<span style="position:absolute;top:-7px;right:-7px;background:#111;color:#fff;font-size:9px;font-weight:800;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${pi+1}</span>`;
      pin.onpointerdown = (e)=>startPinDrag(e, pi);
      wrap.appendChild(pin);
    });
  }
}

export function startPinDrag(e, pi){
  e.preventDefault(); e.stopPropagation();
  dragState = {type:'move', index:pi};
  const el = document.getElementById('pinicon-'+pi);
  if(el) el.style.cursor = 'grabbing';
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
export function startRotateDrag(e, pi){
  e.preventDefault(); e.stopPropagation();
  dragState = {type:'rotate', index:pi};
  const el = document.getElementById('rothandle-'+pi);
  if(el) el.style.cursor = 'grabbing';
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
export function onPointerDrag(e){
  if(!dragState) return;
  const img = document.getElementById('plantaImg');
  if(!img) return;
  const rect = img.getBoundingClientRect();
  const pi = dragState.index;
  const pin = state.planta.pins[pi];
  if(!pin) return;
  if(dragState.type==='move'){
    let x = ((e.clientX-rect.left)/rect.width)*100;
    let y = ((e.clientY-rect.top)/rect.height)*100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    pin.x = x; pin.y = y;
  } else if(dragState.type==='rotate'){
    const cx = rect.left + (pin.x/100)*rect.width;
    const cy = rect.top + (pin.y/100)*rect.height;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    let deg = Math.atan2(dx, -dy) * 180/Math.PI;
    if(deg < 0) deg += 360;
    pin.direcao = Math.round(deg);
  }
  updatePinDOM(pi);
}
export function endPointerDrag(){
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
export function updatePinDOM(pi){
  const pin = state.planta.pins[pi];
  const pinEl = document.getElementById('pinicon-'+pi);
  const coneEl = document.getElementById('cone-'+pi);
  const handleEl = document.getElementById('rothandle-'+pi);
  if(pinEl){ pinEl.style.left = pin.x+'%'; pinEl.style.top = pin.y+'%'; }
  if(coneEl){
    coneEl.style.left = pin.x+'%'; coneEl.style.top = pin.y+'%';
    coneEl.style.transform = `translate(-50%,-50%) rotate(${pin.direcao||0}deg)`;
  }
  if(handleEl){
    const R = 58;
    const rad = (pin.direcao||0) * Math.PI/180;
    const hx = R*Math.sin(rad), hy = -R*Math.cos(rad);
    handleEl.style.left = `calc(${pin.x}% + ${hx}px)`;
    handleEl.style.top = `calc(${pin.y}% + ${hy}px)`;
  }
}
export function syncPinRowControls(){
  state.planta.pins.forEach((p,pi)=>{
    const slider = document.getElementById('dirslider-'+pi);
    const lbl = document.getElementById('deglabel-'+pi);
    if(slider) slider.value = p.direcao||0;
    if(lbl) lbl.textContent = (p.direcao||0)+'°';
  });
}

export function zoomPlanta(delta){
  const z = (state.planta.zoom||100) + delta;
  state.planta.zoom = Math.min(400, Math.max(60, z));
  renderContent();
}
export function resetZoom(){ state.planta.zoom = 100; renderContent(); }
export function liveUpdateCone(pi, deg){
  state.planta.pins[pi].direcao = parseInt(deg);
  const el = document.getElementById('cone-'+pi);
  if(el) el.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
  const lbl = document.getElementById('deglabel-'+pi);
  if(lbl) lbl.textContent = deg+'°';
  updatePinDOM(pi);
}
```

- [ ] **Step 3: Adicionar `removePin` e `handlePlantaUpload`**

`removePin` está hoje no bloco MUTATIONS (linha 605) e `handlePlantaUpload` está hoje isolado perto da seção de persistência (linhas 629–635) — nesta reorganização, ambos migram para `planta.js` porque operam sobre `state.planta` e são referenciados só pelos templates desta aba. Copie o corpo verbatim, adicionando `export`:

```js
export function removePin(pi){ state.planta.pins.splice(pi,1); renderContent(); }

export async function handlePlantaUpload(e){
  const f = e.target.files[0]; if(!f) return;
  state.planta.imagem = await fileToDataURL(f);
  state.planta.pins = [];
  state.planta.zoom = 100;
  renderContent();
}
```

- [ ] **Step 4: Verificar sintaxe**

```bash
node --check js/tabs/planta.js
```

Expected: sem output, código 0.

- [ ] **Step 5: Salvar** (sem commit)

---

### Task 5: Aba Equipamentos (fichas + recorte de planta)

**Files:**
- Create: `claudefiles/js/tabs/equipamentos.js`

**Interfaces:**
- Consumes: `state` de `../state.js`; `ICONS` de `../constants.js`; `typeById`, `fileToDataURL` de `../utils.js`; `renderContent` de `../nav.js` (não existe ainda, mesmo caso das Tasks 3/4)
- Produces: exporta `tplEquipamentos()`, `handleEquipPhoto(e,pi,field)`, `afterEquipamentosRender()`, `generateCropDataURL(pin)`. **`generateCropDataURL` é usado depois pela Task 7 (`js/pdf.js`)** — não mude sua assinatura `(pin) => Promise<string|null>`.

- [ ] **Step 1: Criar `js/tabs/equipamentos.js`**

Copie **verbatim** as linhas 472–553 de `claudefiles/index.html`:

```js
import { state } from '../state.js';
import { ICONS } from '../constants.js';
import { typeById, fileToDataURL } from '../utils.js';
import { renderContent } from '../nav.js';

export function tplEquipamentos(){
  const pins = state.planta.pins;
  return `
    <h1 class="pagetitle">04 · Fichas de Equipamentos</h1>
    <p class="pagesub">Uma página individual é gerada para cada equipamento posicionado na planta, com a localização e as fotos do local.</p>
    ${pins.length===0 ? `<div class="card"><div class="empty-hint">Nenhum equipamento posicionado ainda. Vá até a aba Planta para adicionar.</div></div>` : pins.map((p,pi)=>`
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span class="icon-dot" style="width:30px;height:30px;background:${typeById(p.tipoId).color}">${ICONS[p.tipoId]}</span>
          <div>
            <div style="font-weight:800;color:var(--text-dark);">Equipamento ${pi+1} — ${typeById(p.tipoId).label}</div>
            <div style="font-size:12.5px;color:var(--text-mid);">${p.label||''}</div>
          </div>
        </div>
        <div class="row">
          <div>
            <label>Localização na planta (automática)</label>
            <img id="cropPreview-${pi}" style="width:100%;height:150px;object-fit:cover;border-radius:8px;border:1px solid #E3E8EF;background:#F4F6F9;">
          </div>
          <div>
            <label>Foto do local de instalação</label>
            <input type="file" accept="image/*" onchange="handleEquipPhoto(event, ${pi}, 'fotoLocal')" style="margin-bottom:8px;">
            ${p.fotoLocal ? `<img src="${p.fotoLocal}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;">` : ''}
          </div>
          <div>
            <label>Foto do que o equipamento vai visualizar</label>
            <input type="file" accept="image/*" onchange="handleEquipPhoto(event, ${pi}, 'fotoView')" style="margin-bottom:8px;">
            ${p.fotoView ? `<img src="${p.fotoView}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;">` : ''}
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

export async function handleEquipPhoto(e, pi, field){
  const f = e.target.files[0]; if(!f) return;
  const durl = await fileToDataURL(f);
  state.planta.pins[pi][field] = durl;
  renderContent();
}

export function afterEquipamentosRender(){
  state.planta.pins.forEach((p,pi)=>{
    generateCropDataURL(p).then(url=>{
      const el = document.getElementById('cropPreview-'+pi);
      if(el && url) el.src = url;
    });
  });
}

export function generateCropDataURL(pin){
  return new Promise((resolve)=>{
    if(!state.planta.imagem){ resolve(null); return; }
    const img = new Image();
    img.onload = ()=>{
      const cw = img.naturalWidth, ch = img.naturalHeight;
      const cropFrac = 0.28;
      const cropW = cw*cropFrac, cropH = ch*cropFrac;
      let sx = (pin.x/100)*cw - cropW/2;
      let sy = (pin.y/100)*ch - cropH/2;
      sx = Math.max(0, Math.min(cw-cropW, sx));
      sy = Math.max(0, Math.min(ch-cropH, sy));
      const canvas = document.createElement('canvas');
      canvas.width = 500; canvas.height = 350;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F4F6F9'; ctx.fillRect(0,0,canvas.width,canvas.height);
      const scale = Math.min(canvas.width/cropW, canvas.height/cropH);
      const dw = cropW*scale, dh = cropH*scale;
      const dx = (canvas.width-dw)/2, dy = (canvas.height-dh)/2;
      ctx.drawImage(img, sx, sy, cropW, cropH, dx, dy, dw, dh);
      const markerX = dx + ((pin.x/100*cw - sx)/cropW)*dw;
      const markerY = dy + ((pin.y/100*ch - sy)/cropH)*dh;
      ctx.beginPath();
      ctx.arc(markerX, markerY, 10, 0, Math.PI*2);
      ctx.fillStyle = typeById(pin.tipoId).color;
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = ()=>resolve(null);
    img.src = state.planta.imagem;
  });
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
node --check js/tabs/equipamentos.js
```

Expected: sem output, código 0.

- [ ] **Step 3: Salvar** (sem commit)

---

### Task 6: Navegação e Persistência

**Files:**
- Create: `claudefiles/js/nav.js`
- Create: `claudefiles/js/persistence.js`

**Interfaces:**
- Consumes: `TABS` de `./constants.js`; `tplProjeto` de `./tabs/projeto.js`; `tplObjetivo` de `./tabs/objetivo.js`; `tplEstrutura` de `./tabs/estrutura.js`; `tplPlanta`+`afterPlantaRender` de `./tabs/planta.js`; `tplEquipamentos`+`afterEquipamentosRender` de `./tabs/equipamentos.js`; `tplPremissas` de `./tabs/premissas.js`; `tplGerar` de `./tabs/gerar.js` — todos os 7 módulos de aba já existem (Tasks 2–5, todas commitadas). `persistence.js` também consome `state`+`setState` de `./state.js` e `showToast` de `./utils.js`.
- Produces: `nav.js` exporta `renderNav()`, `switchTab(id)`, `renderContent()` (`currentTab` fica privado do módulo — nenhum outro arquivo precisa dele diretamente, só via `switchTab`). `persistence.js` exporta `exportarProjeto()`, `importarProjetoFile(e)`.

Esta é a task que fecha o ciclo de import circular descrito nas Global Constraints: `nav.js` importa de `tabs/estrutura.js`, `tabs/premissas.js`, `tabs/planta.js`, `tabs/equipamentos.js`, que por sua vez importam `renderContent`/`switchTab` de volta de `nav.js`. Isso é esperado e seguro — não é um bug.

- [ ] **Step 1: Criar `js/nav.js`**

Copie **verbatim** as linhas 166 (`currentTab`), 192–198 (`renderNav`), 199 (`switchTab`), 202–211 (`renderContent`) de `claudefiles/index.html`:

```js
import { TABS } from './constants.js';
import { tplProjeto } from './tabs/projeto.js';
import { tplObjetivo } from './tabs/objetivo.js';
import { tplEstrutura } from './tabs/estrutura.js';
import { tplPlanta, afterPlantaRender } from './tabs/planta.js';
import { tplEquipamentos, afterEquipamentosRender } from './tabs/equipamentos.js';
import { tplPremissas } from './tabs/premissas.js';
import { tplGerar } from './tabs/gerar.js';

let currentTab = 'projeto';

export function renderNav(){
  const el = document.getElementById('navBtns');
  el.innerHTML = TABS.map(t=>`
    <button class="navbtn ${t.id===currentTab?'active':''}" onclick="switchTab('${t.id}')">
      <span class="num">${t.num}</span>${t.label}
    </button>`).join('');
}
export function switchTab(id){ currentTab = id; renderNav(); renderContent(); }

export function renderContent(){
  const c = document.getElementById('content');
  if(currentTab==='projeto') c.innerHTML = tplProjeto();
  else if(currentTab==='objetivo') c.innerHTML = tplObjetivo();
  else if(currentTab==='estrutura') c.innerHTML = tplEstrutura();
  else if(currentTab==='planta') { c.innerHTML = tplPlanta(); afterPlantaRender(); }
  else if(currentTab==='equipamentos') { c.innerHTML = tplEquipamentos(); afterEquipamentosRender(); }
  else if(currentTab==='premissas') c.innerHTML = tplPremissas();
  else if(currentTab==='gerar') c.innerHTML = tplGerar();
}
```

- [ ] **Step 2: Criar `js/persistence.js`**

Copie as linhas 638–650 de `claudefiles/index.html` verbatim (`exportarProjeto`) e adapte 651–669 (`importarProjetoFile`) trocando `state = loaded;` por `setState(loaded);` e trocando as 3 linhas `currentTab = 'projeto'; renderNav(); renderContent();` por uma chamada só, `switchTab('projeto');` (motivo: ver Global Constraints — `state`/`currentTab` não podem ser reatribuídos fora do módulo que os declara):

```js
import { state, setState } from './state.js';
import { switchTab } from './nav.js';
import { showToast } from './utils.js';

export function exportarProjeto(){
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Projeto_${(state.projeto.unidade||'Bracell').replace(/[^a-zA-Z0-9]+/g,'_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Projeto exportado. Envie o arquivo .json para seu colega.');
}

export function importarProjetoFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const loaded = JSON.parse(ev.target.result);
      setState(loaded);
      if(!state.planta) state.planta = {imagem:null, selectedTipo:'bullet', pins:[], zoom:100};
      if(state.planta.zoom===undefined) state.planta.zoom = 100;
      switchTab('projeto');
      showToast('Projeto importado com sucesso.');
    }catch(err){
      showToast('Arquivo inválido — verifique se é um .json exportado desta ferramenta.');
      console.error(err);
    }
  };
  reader.readAsText(f);
}
```

- [ ] **Step 3: Verificar sintaxe**

```bash
node --check js/nav.js
node --check js/persistence.js
```

Expected: sem output, código 0.

- [ ] **Step 4: Conferir que todos os nomes importados batem com o que cada módulo de aba exporta**

Releia `js/tabs/projeto.js`, `objetivo.js`, `estrutura.js`, `planta.js`, `equipamentos.js`, `premissas.js`, `gerar.js` (das Tasks 2–5) e confirme que cada `export function` referenciado no `import` do Step 1 existe com esse nome exato. Reporte no seu relatório se encontrar alguma divergência (não corrija sozinho — isso indicaria um problema em uma task anterior já revisada; sinalize como concern).

- [ ] **Step 5: Salvar** (sem commit)

---

### Task 7: Geração de PDF

**Files:**
- Create: `claudefiles/js/pdf.js`

**Interfaces:**
- Consumes: `state` de `./state.js`; `BRAND`, `ICONS`, `PW`, `PH` de `./constants.js`; `showToast`, `fmtDate`, `typeById` de `./utils.js`; `generateCropDataURL` de `./tabs/equipamentos.js` (Task 5, já commitada)
- Produces: exporta `gerarPDF()`. `html2canvas` e `window.jspdf` continuam globais (carregados via `<script>` CDN no `index.html`, sem `import` — ver Step 1)

- [ ] **Step 1: Criar `js/pdf.js`**

Copie **verbatim** as linhas 673–863 de `claudefiles/index.html` (todas as funções `page*` + `gerarPDF`):

```js
import { state } from './state.js';
import { BRAND, ICONS, PW, PH } from './constants.js';
import { showToast, fmtDate, typeById } from './utils.js';
import { generateCropDataURL } from './tabs/equipamentos.js';

function pageShell(inner){
  return `<div style="width:${PW}px;height:${PH}px;position:relative;overflow:hidden;background:#fff;font-family:'Inter',sans-serif;">${inner}</div>`;
}
function pageHeader(num, title){
  return `
    <div style="position:absolute;top:50px;left:64px;display:flex;align-items:center;gap:20px;">
      <div style="width:60px;height:60px;border-radius:50%;background:${BRAND.corSecundaria};color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;">${num}</div>
      <div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:32px;color:${BRAND.cor};">${title}</div>
        <div style="width:110px;height:4px;background:${BRAND.corAcento};margin-top:6px;"></div>
      </div>
    </div>`;
}
function footerBrand(){
  return `<div style="position:absolute;bottom:30px;left:64px;display:flex;align-items:center;gap:10px;color:#8FA3BF;font-size:11px;font-weight:600;">
    <img src="${BRAND.logo}" style="height:20px;object-fit:contain;">
    <span>${BRAND.nome} · ${BRAND.departamento}</span>
  </div>`;
}

function pageCapa(){
  return pageShell(`
    <div style="width:100%;height:100%;background:#fff;position:relative;">
      <div style="position:absolute;right:-110px;bottom:-160px;width:760px;height:760px;background:${BRAND.cor};clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.97;"></div>
      <div style="position:absolute;right:-30px;bottom:-90px;width:480px;height:480px;background:${BRAND.corSecundaria};clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.9;"></div>
      <div style="position:absolute;left:74px;top:56px;font-size:12px;letter-spacing:1.5px;font-weight:800;color:${BRAND.cor};text-transform:uppercase;">PROJETO SEG. ELETRÔNICA</div>
      <div style="position:absolute;left:74px;top:78px;font-size:11px;letter-spacing:1px;font-weight:700;color:#8FA3BF;text-transform:uppercase;">DEPTO. ${BRAND.departamento.toUpperCase()}</div>
      <div style="position:absolute;left:74px;top:300px;max-width:640px;">
        <div style="color:#111;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:64px;line-height:.95;">PROJETO<br>SEG. ELETRÔNICA</div>
        <div style="display:inline-block;margin-top:24px;background:${BRAND.corSecundaria};color:#fff;padding:10px 22px;border-radius:6px;font-weight:800;font-size:18px;">${state.projeto.unidade || 'Unidade não definida'}</div>
        <div style="margin-top:24px;font-weight:800;font-size:15px;color:#111;">DEPTO. ${BRAND.departamento.toUpperCase()}</div>
        <div style="font-size:14px;color:#4A5A72;">${state.projeto.equipe||''}</div>
        <div style="margin-top:14px;font-size:13px;color:#4A5A72;font-weight:700;">${fmtDate(state.projeto.data)}</div>
      </div>
      <div style="position:absolute;left:74px;bottom:64px;">
        <img src="${BRAND.logo}" style="height:34px;object-fit:contain;">
      </div>
    </div>
  `);
}
function pageSumario(){
  const items = [['01','Problema & Solução'],['02','Estrutura'],['03','Mapeamento'],['04','Fichas de Equipamentos'],['05','Premissas']];
  return pageShell(`
    <div style="position:absolute;right:-140px;top:-160px;width:560px;height:560px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.92;"></div>
    <div style="padding:70px 74px;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:40px;color:${BRAND.cor};margin-bottom:34px;">Sumário</div>
      ${items.map(([n,l])=>`
        <div style="display:flex;align-items:center;gap:18px;margin-bottom:18px;max-width:520px;">
          <div style="width:40px;height:40px;border-radius:50%;background:#EDEFF3;color:${BRAND.cor};display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed';font-weight:800;font-size:17px;flex-shrink:0;">${n}</div>
          <div style="font-size:18px;color:${BRAND.cor};font-weight:600;border-bottom:1px solid #E3E8EF;flex:1;padding-bottom:14px;">${l}</div>
        </div>`).join('')}
    </div>
    ${footerBrand()}
  `);
}
function pageObjetivo(){
  return pageShell(`
    ${pageHeader('01','Objetivo do Projeto')}
    <div style="position:absolute;right:-140px;top:-160px;width:420px;height:420px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.85;"></div>
    <div style="position:absolute;top:170px;left:64px;right:64px;">
      <div style="font-weight:800;color:${BRAND.cor};font-size:16px;margin-bottom:8px;">Área a ser Monitorada</div>
      <div style="font-size:14.5px;line-height:1.6;color:#33415A;white-space:pre-wrap;margin-bottom:34px;">${state.objetivo.problema || '—'}</div>
      <div style="font-weight:800;color:${BRAND.cor};font-size:16px;margin-bottom:8px;">Diretriz da Proposta</div>
      <div style="font-size:14.5px;line-height:1.6;color:#33415A;white-space:pre-wrap;">${state.objetivo.solucao || '—'}</div>
    </div>
    ${footerBrand()}
  `);
}
function pageEstrutura(){
  return pageShell(`
    ${pageHeader('02','Estrutura')}
    <div style="position:absolute;right:-140px;top:-160px;width:420px;height:420px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.85;"></div>
    <div style="position:absolute;top:165px;left:64px;right:64px;bottom:70px;overflow:hidden;">
      ${state.estrutura.map(g=>`
        <div style="margin-bottom:20px;">
          <div style="font-weight:800;color:${BRAND.corSecundaria};font-size:15px;margin-bottom:8px;">${g.titulo||'Grupo'}</div>
          ${g.itens.map(it=>`
            <div style="font-size:13.5px;color:#33415A;line-height:1.5;margin-bottom:4px;">
              <b>${it.qtd||0}x ${it.nome||''}</b>${it.desc?': '+it.desc:''}
            </div>`).join('')}
        </div>`).join('')}
    </div>
    ${footerBrand()}
  `);
}
function pageMapeamento(){
  const map = {};
  state.planta.pins.forEach(p=>{
    const key = p.tipoId+'|'+p.label;
    if(!map[key]) map[key] = {tipoId:p.tipoId, label:p.label, qtd:0};
    map[key].qtd += (parseInt(p.qtd)||1);
  });
  const legend = Object.values(map);
  const pinsHtml = state.planta.pins.map(p=>{
    const t = typeById(p.tipoId);
    const cone = t.cameraLike ? `<div style="position:absolute;left:${p.x}%;top:${p.y}%;width:100px;height:100px;transform:translate(-50%,-50%) rotate(${p.direcao||0}deg);clip-path:polygon(50% 50%, 26% 0%, 74% 0%);background:${t.color}55;"></div>` : '';
    return `${cone}<div style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">${ICONS[t.id]}</div>`;
  }).join('');
  return pageShell(`
    ${pageHeader('03','Mapeamento')}
    <div style="position:absolute;top:165px;left:64px;width:820px;height:770px;border-radius:8px;overflow:hidden;background:#F4F6F9;border:1px solid #E3E8EF;">
      ${state.planta.imagem ? `<img src="${state.planta.imagem}" style="width:100%;height:100%;object-fit:contain;position:relative;">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8FA3BF;font-size:14px;">Planta não anexada</div>`}
      ${pinsHtml}
    </div>
    <div style="position:absolute;top:165px;right:64px;width:440px;background:#F9FAFB;border:1px solid #E3E8EF;border-radius:10px;padding:20px;">
      <div style="font-weight:800;color:${BRAND.cor};font-size:15px;margin-bottom:14px;">Legenda</div>
      ${legend.length===0 ? `<div style="font-size:13px;color:#8FA3BF;">Nenhum equipamento posicionado.</div>` : legend.map(l=>`
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
          <div style="width:20px;height:20px;border-radius:50%;background:${typeById(l.tipoId).color};margin-top:1px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ICONS[l.tipoId]}</div>
          <div style="font-size:13px;color:#33415A;line-height:1.4;"><b>${l.qtd}x — ${typeById(l.tipoId).label}</b>${l.label && l.label!==typeById(l.tipoId).label ? '<br>'+l.label : ''}</div>
        </div>`).join('')}
    </div>
    ${footerBrand()}
  `);
}
function pageEquipamento(pin, index, cropUrl){
  const t = typeById(pin.tipoId);
  const boxStyle = 'width:100%;height:290px;object-fit:cover;border-radius:8px;border:1px solid #E3E8EF;background:#F4F6F9;';
  const placeholder = (txt)=>`<div style="${boxStyle}display:flex;align-items:center;justify-content:center;color:#9AA7BA;font-size:13px;">${txt}</div>`;
  return pageShell(`
    ${pageHeader(String(index+1), t.label + (pin.label?' — '+pin.label:''))}
    <div style="position:absolute;right:-140px;top:-160px;width:420px;height:420px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.85;"></div>
    <div style="position:absolute;top:170px;left:64px;right:64px;bottom:70px;display:flex;gap:24px;">
      <div style="flex:1;">
        <div style="font-weight:800;color:${BRAND.cor};font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Localização na Planta</div>
        ${cropUrl ? `<img src="${cropUrl}" style="${boxStyle}">` : placeholder('Planta não anexada')}
      </div>
      <div style="flex:1;">
        <div style="font-weight:800;color:${BRAND.cor};font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Local de Instalação</div>
        ${pin.fotoLocal ? `<img src="${pin.fotoLocal}" style="${boxStyle}">` : placeholder('Foto não anexada')}
      </div>
      <div style="flex:1;">
        <div style="font-weight:800;color:${BRAND.cor};font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Visualização Esperada</div>
        ${pin.fotoView ? `<img src="${pin.fotoView}" style="${boxStyle}">` : placeholder('Foto não anexada')}
      </div>
    </div>
    ${footerBrand()}
  `);
}
function pagePremissas(){
  return pageShell(`
    ${pageHeader('05','Premissas do Projeto')}
    <div style="position:absolute;right:-140px;top:-160px;width:420px;height:420px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.85;"></div>
    <div style="position:absolute;top:165px;left:64px;right:64px;bottom:70px;overflow:hidden;">
      ${state.premissas.map(p=>`
        <div style="margin-bottom:16px;font-size:14px;line-height:1.55;color:#33415A;">
          <b style="color:${BRAND.cor};">${p.titulo}:</b> ${p.desc}
        </div>`).join('')}
    </div>
    ${footerBrand()}
  `);
}
function pageEncerramento(){
  return pageShell(`
    <div style="width:100%;height:100%;position:relative;background:#fff;">
      <div style="position:absolute;right:-100px;top:-140px;width:520px;height:520px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.92;"></div>
      <div style="position:absolute;left:74px;top:420px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:52px;color:${BRAND.cor};">${(BRAND.slogan||'').toUpperCase()}</div>
      <div style="position:absolute;left:74px;bottom:70px;"><img src="${BRAND.logo}" style="height:30px;object-fit:contain;"></div>
    </div>
  `);
}

export async function gerarPDF(){
  showToast('Gerando PDF…');
  const root = document.getElementById('pdf-render-root');
  root.innerHTML = '';
  const equipCrops = [];
  for(const p of state.planta.pins){ equipCrops.push(await generateCropDataURL(p)); }
  const pages = [
    pageCapa(), pageSumario(), pageObjetivo(), pageEstrutura(), pageMapeamento(),
    ...state.planta.pins.map((p,i)=>pageEquipamento(p,i,equipCrops[i])),
    pagePremissas(), pageEncerramento()
  ];
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({orientation:'landscape', unit:'px', format:[PW,PH]});
  for(let i=0;i<pages.length;i++){
    const div = document.createElement('div');
    div.innerHTML = pages[i];
    root.appendChild(div);
    await new Promise(r=>setTimeout(r,60));
    const canvas = await html2canvas(div.firstElementChild, {scale:2, useCORS:true, backgroundColor:'#ffffff'});
    const imgData = canvas.toDataURL('image/jpeg', 0.93);
    if(i>0) pdf.addPage([PW,PH],'landscape');
    pdf.addImage(imgData, 'JPEG', 0, 0, PW, PH);
    root.removeChild(div);
  }
  const filename = `Proposta_Bracell_${(state.projeto.unidade||'Projeto').replace(/[^a-zA-Z0-9]+/g,'_')}.pdf`;
  pdf.save(filename);
  showToast('PDF gerado com sucesso!');
}
```

Note que `pageShell`, `pageHeader`, `footerBrand`, `pageCapa`, `pageSumario`, `pageObjetivo`, `pageEstrutura`, `pageMapeamento`, `pageEquipamento`, `pagePremissas`, `pageEncerramento` **não** levam `export` — só `gerarPDF` é usado fora deste arquivo (exposto em `window` na Task 8). As demais são detalhes internos de implementação deste módulo. `html2canvas` e `window.jspdf` não são importados — continuam vindo dos `<script>` CDN carregados no `<head>` do `index.html`, que executam antes do módulo (scripts CDN sem `type="module"` rodam antes de scripts `type="module"`, que são sempre adiados).

- [ ] **Step 2: Verificar sintaxe**

```bash
node --check js/pdf.js
```

Expected: sem output, código 0.

- [ ] **Step 3: Salvar** (sem commit)

---

### Task 8: Integração final — main.js, index.html, CLAUDE.md

**Files:**
- Create: `claudefiles/js/main.js`
- Modify: `claudefiles/index.html` (reescrita completa — vira só a casca)
- Modify: `claudefiles/CLAUDE.md` (seção "Estado atual da ferramenta")

**Interfaces:**
- Consumes: tudo que foi exportado nas Tasks 1–7 (lista completa no Step 1)
- Produces: nada consumido por outra task — esta é a integração final. **É aqui que a aplicação roda pela primeira vez de ponta a ponta.**

Esta é a única task com risco real de regressão (todas as anteriores foram extrações mecânicas verificadas só por sintaxe) — capriche na verificação manual do Step 5.

- [ ] **Step 1: Criar `js/main.js`**

```js
import { state } from './state.js';
import { renderNav, renderContent, switchTab } from './nav.js';
import { exportarProjeto, importarProjetoFile } from './persistence.js';
import { addGroup, removeGroup, addItem, removeItem, importFromPlanta } from './tabs/estrutura.js';
import { handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, removePin } from './tabs/planta.js';
import { handleEquipPhoto } from './tabs/equipamentos.js';
import { addPremissa, removePremissa, addPremissasPadrao } from './tabs/premissas.js';
import { gerarPDF } from './pdf.js';

Object.assign(window, {
  state, renderContent, switchTab,
  exportarProjeto, importarProjetoFile,
  addGroup, removeGroup, addItem, removeItem, importFromPlanta,
  handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, removePin,
  handleEquipPhoto,
  addPremissa, removePremissa, addPremissasPadrao,
  gerarPDF,
});

renderNav();
renderContent();
```

Essa é a lista completa e exaustiva de tudo referenciado por `onclick=`/`oninput=`/`onchange=` inline nos templates das Tasks 2–5 (18 funções + `state`) — não adicione nem remova nada dessa lista sem conferir contra os templates. Não importe `setState` (só é usado dentro de `persistence.js`, que já o importa por conta própria) nem `BRAND` (o logo passa a ser um `<img>` estático no HTML, ver Step 2 — não precisa de JS para inicializá-lo).

- [ ] **Step 2: Reescrever `claudefiles/index.html`**

Note que o `<img>` do logo na sidebar hoje tem uma base64 gigante hardcoded como `src` (linha 90 do arquivo atual) que é **imediatamente sobrescrita** no carregamento pela linha `document.querySelectorAll('#sidebar .brand img').forEach(img=>{ img.src = BRAND.logo; });` (linha 865) com o mesmo valor — é uma duplicação redundante. Nesta reescrita, o `<img>` aponta direto para `assets/logo-bracell.png` no HTML estático, e essa linha de inicialização em JS desaparece (não é mais necessária).

Substitua o conteúdo inteiro de `claudefiles/index.html` por:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gerador de Propostas — Segurança Patrimonial Bracell</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
</head>
<body>
<div id="app">
  <aside id="sidebar">
    <div class="brand">
      <img src="assets/logo-bracell.png">
      <div class="txt">Segurança<br>Patrimonial</div>
    </div>
    <div id="navBtns"></div>
    <div id="sidebar-footer">
      <button onclick="exportarProjeto()">⬇ Exportar projeto (.json)</button>
      <label style="background:var(--ui-panel);color:var(--ui-muted);border:1px solid var(--ui-line);border-radius:8px;padding:9px 10px;font-size:12px;font-weight:600;cursor:pointer;text-align:left;display:block;">
        ⬆ Importar projeto (.json)
        <input type="file" accept="application/json" onchange="importarProjetoFile(event)" style="display:none;">
      </label>
    </div>
  </aside>
  <main id="content"></main>
</div>
<div id="pdf-render-root" style="position:absolute;left:-99999px;top:0;"></div>
<div id="toast"></div>

<script type="module" src="js/main.js"></script>
</body>
</html>
```

Confira que **nenhuma outra linha do `<body>` original mudou** além do `<img>` do logo — copie o resto (a estrutura de `#app`/`#sidebar`/`#navBtns`/`#sidebar-footer`/`#content`/`#pdf-render-root`/`#toast`) exatamente do `index.html` atual (linhas 86–105), o bloco acima já reflete isso.

- [ ] **Step 3: Apagar o `LOGO_B64` do arquivo antigo (se ainda restar em algum lugar)**

Depois do Step 2, `claudefiles/index.html` não deve conter nenhuma ocorrência de `LOGO_B64` nem nenhuma string `data:image/png;base64,` — confirme:

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html','utf8');
console.log('LOGO_B64 occurrences:', (html.match(/LOGO_B64/g)||[]).length);
console.log('base64 data URL occurrences:', (html.match(/data:image\/png;base64,/g)||[]).length);
"
```

Expected: ambos os contadores em `0`.

- [ ] **Step 4: Verificar sintaxe de `main.js`**

```bash
node --check js/main.js
```

Expected: sem output, código 0.

- [ ] **Step 5: Verificação manual completa no navegador**

```bash
npx serve .
```

Abra a URL local impressa no terminal (ex: `http://localhost:3000`) e, com o console do navegador aberto (F12):

1. Confirme que a página carrega sem nenhum erro no console e que o logo da Bracell aparece na sidebar
2. Navegue pelas 7 abas (Dados do Projeto, Problema & Solução, Estrutura, Planta, Fichas de Equipamentos, Premissas, Gerar Proposta) — cada uma deve renderizar igual a antes
3. Em "Dados do Projeto", edite um campo de texto e confirme que o valor persiste ao trocar de aba e voltar
4. Em "Estrutura", adicione um grupo, adicione um item, remova um item, clique em "Gerar a partir da planta" (sem pins ainda deve mostrar o toast "Nenhum ponto na planta para importar")
5. Em "Planta", envie uma imagem, clique para posicionar um pin, arraste o pin, arraste a alça de rotação (para um tipo câmera), teste o zoom, confirme que tudo isso já funciona também com emulação de touch no DevTools (Ctrl+Shift+M) — é a funcionalidade da feature anterior, deve continuar idêntica
6. Em "Fichas de Equipamentos", confirme que aparece uma ficha para o pin criado, com o recorte automático da planta
7. Em "Premissas", clique em "+ Sugestões padrão" e confirme que adiciona as 3 premissas
8. Exporte o projeto (.json) pelo rodapé da sidebar, depois importe esse mesmo arquivo de volta — confirme que volta para a aba "Dados do Projeto" com os dados intactos e aparece o toast de sucesso
9. Vá em "Gerar Proposta" e clique em "Gerar PDF da Proposta" — confirme que baixa um PDF, abra-o e confirme que o logo aparece corretamente (exercita `assets/logo-bracell.png` via `BRAND.logo`) e que as páginas batem com os dados preenchidos

Se qualquer passo gerar um erro no console (especialmente `ReferenceError: X is not defined`), volte ao Step 1 e confira se `X` está faltando na lista exposta em `window`.

- [ ] **Step 6: Atualizar `claudefiles/CLAUDE.md`**

Na seção "## Estado atual da ferramenta", troque o parágrafo que descreve "Arquivo único `index.html`..." pela nova estrutura de pastas e pelo comando para rodar. Substitua o parágrafo de abertura dessa seção por:

```markdown
## Estado atual da ferramenta

A ferramenta é separada em `index.html` (casca HTML) + `css/style.css` + `assets/logo-bracell.png` + módulos ES em `js/` (um arquivo por responsabilidade, ver `js/tabs/` para os templates de cada aba). Sem build step, sem framework — só ES modules nativos do navegador.

**Como rodar:** a partir da pasta `claudefiles/`, rode `npx serve .` (não precisa instalar nada) e abra a URL local impressa no terminal. Não é mais possível abrir `index.html` direto por duplo-clique — navegadores bloqueiam `import`/`export` de módulos ES quando a página é aberta via `file://`.
```

Mantenha o resto do `CLAUDE.md` (contexto do projeto, modelo de dados, tipos de equipamento, etc.) sem mudanças — essas informações continuam corretas independente da reorganização de arquivos.

- [ ] **Step 7: Salvar** (sem commit)

---

## Self-Review Notes

- **Cobertura do spec:** as 5 seções do spec (`2026-07-02-file-structure-design.md`) mapeiam para as tasks: estrutura de pastas → Tasks 1–7 (cada arquivo previsto no spec tem uma task que o cria); bridge de `window` + `setState` → Task 8 Step 1 e Task 6 Step 2; logo como arquivo real → Task 1 Step 2; documentação/como rodar → Task 8 Step 6.
- **Sem placeholders:** cada task copia linhas específicas e exatas do `index.html` atual (line ranges verificados nesta sessão, pós-feature de touch/tablet) e mostra o wrapper `import`/`export` completo — nenhuma menção a "similar to" ou "add appropriate code".
- **Consistência de nomes:** conferido manualmente que toda função referenciada num `import` de uma task posterior (ex: `renderContent` em `estrutura.js`, `generateCropDataURL` em `pdf.js`) corresponde exatamente ao nome exportado na task que a define. A Task 6 Step 4 pede uma conferência cruzada adicional antes de fechar aquela task, como rede de segurança.
- **Import circular:** documentado nas Global Constraints e repetido no contexto da Task 3/4/5 (que o introduzem) e Task 6 (que o fecha), para nenhum subagente tentar "consertar" gerando um design pior.
