# Design — Reorganizar em pastas (CSS/JS separados)

**Data:** 2026-07-02
**Projeto:** Gerador de Propostas de Segurança Eletrônica (Bracell) — hoje `claudefiles/index.html` (arquivo único, 858 linhas)

## Problema

O projeto começou como teste rápido — tudo num `index.html` só (HTML + CSS + JS inline). Agora que vai continuar evoluindo, a estrutura de arquivo único dificulta localizar código e edita-lo com segurança. O pedido é reorganizar em pastas (css/js/assets) "da forma que for melhor para escalonar futuramente, facilitando edições e localização dos arquivos" — sem framework, sem build step, mantendo a ferramenta simples de rodar.

## Decisão de workflow (definida com o usuário)

A ferramenta passa a exigir um **servidor local** para rodar (em vez de abrir o arquivo direto por duplo-clique), porque `import`/`export` de ES modules são bloqueados pelo navegador quando o HTML é aberto via `file://`. Isso habilita módulos JS de verdade (escopo isolado por arquivo, sem variável global acidental), em troca de precisar rodar `npx serve .` (ou a extensão Live Server do VS Code) na pasta do projeto antes de abrir no navegador. Essa troca foi decidida explicitamente com o usuário.

## Escopo

**Dentro do escopo:**
- Separar `index.html` em: `index.html` (casca), `css/style.css`, `js/*.js` (múltiplos módulos ES), `assets/logo-bracell.png`
- Preservar exatamente o comportamento atual (mesma UI, mesmas interações, mesmo fluxo de geração de PDF) — é uma reorganização de arquivos, não uma reescrita de lógica
- Resolver a quebra técnica que ES modules introduzem nos handlers inline (`onclick`/`oninput`/`onchange` nos templates HTML gerados) expondo a API pública necessária em `window`
- Resolver a reatribuição do objeto `state` inteiro (usada na importação de projeto `.json`) via uma função `setState`, já que módulos ES não permitem reatribuir um binding importado de outro módulo
- Atualizar `CLAUDE.md` para descrever a nova estrutura e o comando pra rodar com servidor local

**Fora do escopo:**
- Build step / bundler (Vite, esbuild, webpack) — não foi pedido, contraria a simplicidade atual
- Reescrever os handlers inline (`onclick=""`) para `addEventListener` — mudança de arquitetura de eventos maior, risco de regressão desnecessário para o objetivo de "separar arquivos"
- Framework (React, Vue, etc.) — não foi pedido
- Qualquer mudança funcional/de comportamento na ferramenta (isso é puramente organizacional)
- `package.json` / tooling de instalação — o servidor local roda via `npx serve` sem instalação prévia

## Design

### 1. Estrutura de pastas

```
claudefiles/
  index.html
  css/
    style.css
  assets/
    logo-bracell.png
  js/
    constants.js
    state.js
    utils.js
    nav.js
    persistence.js
    pdf.js
    main.js
    tabs/
      projeto.js
      objetivo.js
      estrutura.js
      planta.js
      equipamentos.js
      premissas.js
      gerar.js
```

Os nomes dentro de `tabs/` batem com o `id` que cada aba já usa internamente (`TABS` array), então não há ambiguidade sobre onde cada pedaço de UI mora.

**Mapeamento de conteúdo (do `index.html` atual para os novos arquivos):**
- `css/style.css` ← todo o bloco `<style>` (linhas 11–83, incluindo os `@media` adicionados na feature de touch/tablet)
- `assets/logo-bracell.png` ← decodificado da constante `LOGO_B64` (data URL `data:image/png;base64,...`, linha 109)
- `js/constants.js` ← `BRAND` (com `logo` agora apontando pro caminho do arquivo, não mais o base64), `EQUIP_TYPES`, `ICONS`, `TABS`, `PW`/`PH` (dimensões de página do PDF, hoje linha 672)
- `js/state.js` ← o objeto `state` inicial (hoje linha 149) + `setState(novoEstado)` (nova função, ver seção 3)
- `js/utils.js` ← `todayISO`, `showToast`, `fileToDataURL`, `typeById`, `fmtDate`
- `js/nav.js` ← `currentTab`, `renderNav`, `switchTab`, `renderContent` (o dispatcher que decide qual `tpl*` chamar por aba)
- `js/persistence.js` ← `exportarProjeto`, `importarProjetoFile`
- `js/pdf.js` ← `pageShell`, `pageHeader`, `footerBrand`, `pageCapa`, `pageSumario`, `pageObjetivo`, `pageEstrutura`, `pageMapeamento`, `pageEquipamento`, `pagePremissas`, `pageEncerramento`, `gerarPDF`
- `js/tabs/projeto.js` ← `tplProjeto`
- `js/tabs/objetivo.js` ← `tplObjetivo`
- `js/tabs/estrutura.js` ← `tplEstrutura`, `addGroup`, `removeGroup`, `addItem`, `removeItem`, `importFromPlanta`
- `js/tabs/planta.js` ← `tplPlanta`, `afterPlantaRender`, `startPinDrag`, `startRotateDrag`, `onPointerDrag`, `endPointerDrag`, `updatePinDOM`, `syncPinRowControls`, `zoomPlanta`, `resetZoom`, `liveUpdateCone`, `removePin`, `handlePlantaUpload` (essa última hoje está fisicamente longe da aba planta no arquivo original — linha 629 — mas logicamente pertence aqui; é o único realinhamento de local feito nessa reorganização)
- `js/tabs/equipamentos.js` ← `tplEquipamentos`, `afterEquipamentosRender`, `generateCropDataURL`, `handleEquipPhoto`
- `js/tabs/premissas.js` ← `tplPremissas`, `addPremissa`, `removePremissa`, `addPremissasPadrao`
- `js/tabs/gerar.js` ← `tplGerar`
- `js/main.js` ← ponto de entrada: importa tudo, roda a inicialização (hoje linhas 864-867: seta o `src` do logo, chama `renderNav()` + `renderContent()`), e expõe a API pública em `window` (ver seção 3)

`index.html` fica só com: `<head>` (meta, título, `<link>` do CSS, Google Fonts, os `<script>` CDN do html2canvas/jsPDF — sem mudança), a marcação do `<body>` (sidebar + `#content` vazio + `#pdf-render-root`), e um único `<script type="module" src="js/main.js"></script>` no final.

### 2. Import/export entre módulos

Cada arquivo `export`a só o que outros módulos realmente usam (funções `tpl*`/`after*Render` de cada aba, `state`, `setState`, funções utilitárias). `main.js` importa de todos e é o único lugar que conhece a lista completa — os módulos de aba não se importam entre si, exceto `estrutura.js`, que importa `state` de `planta.js`... não, **os pins pertencem ao `state.planta`**, então `importFromPlanta` (em `estrutura.js`) só precisa importar `state` de `state.js` e `typeById` de `utils.js`, sem depender de `planta.js` diretamente. Cada módulo de aba depende apenas de `state.js`, `utils.js` e `constants.js` — nunca de outro módulo de aba.

`nav.js` importa as 7 funções `tpl*` (uma por aba) e as duas `after*Render` (`planta`, `equipamentos`) para montar o dispatcher `renderContent`.

### 3. Bridge para os handlers inline + `state`

Os templates HTML gerados (`tpl*`) continuam usando `onclick="nomeDaFuncao(...)"`, `oninput="state.campo=this.value"` etc., exatamente como hoje — nenhum template muda. Para isso continuar funcionando com ES modules, `main.js` expõe explicitamente em `window`, depois de importar tudo:

```js
Object.assign(window, {
  state, renderContent, switchTab,
  exportarProjeto, importarProjetoFile,
  addGroup, removeGroup, addItem, removeItem, importFromPlanta,
  handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, removePin,
  handleEquipPhoto,
  addPremissa, removePremissa, addPremissasPadrao,
  gerarPDF,
});
```

Essa é a lista completa e exaustiva de tudo referenciado por `onclick=`/`oninput=`/`onchange=` inline nos templates atuais (levantada por grep no arquivo original) — não há necessidade de expor mais nada além disso.

**Reatribuição do `state`:** hoje `importarProjetoFile` faz `state = loaded` (substitui o objeto inteiro ao importar um `.json`). Com ES modules, um binding importado (`import { state } from './state.js'`) não pode ser reatribuído fora do módulo que o declara — só suas propriedades podem ser mutadas (`state.x = y`). Por isso, `state.js` exporta também:

```js
export function setState(novoEstado){ state = novoEstado; }
```

E `js/persistence.js` chama `setState(loaded)` em vez de `state = loaded`. Como `state` é um binding vivo do ES module, todo módulo que já deu `import { state }` volta a enxergar o novo valor automaticamente na próxima leitura — não precisa re-importar.

Pelo mesmo motivo, `importarProjetoFile` hoje também seta `currentTab = 'projeto'` diretamente antes de chamar `renderNav(); renderContent();` — isso é a mesma classe de problema (`currentTab` é um binding vivo de `nav.js`). A correção é trocar essas três linhas por uma chamada só: `switchTab('projeto')` (que já faz exatamente `currentTab = id; renderNav(); renderContent();` dentro do próprio `nav.js`, então não há reatribuição cross-module).

### 4. Logo como arquivo real

`LOGO_B64` (hoje uma constante JS com uma data URL de ~29KB) é decodificado para um arquivo binário `assets/logo-bracell.png`. `BRAND.logo` passa a ser a string `'assets/logo-bracell.png'` em vez do base64 completo. O único lugar que lê `BRAND.logo` (linha 865 do arquivo atual, `img.src = BRAND.logo`) não muda de comportamento — um `<img src="...">` aceita tanto data URL quanto caminho relativo.

### 5. Como rodar (documentação)

`CLAUDE.md` é atualizado para descrever a nova estrutura de pastas (substituindo a seção "Estado atual da ferramenta" que hoje descreve "arquivo único") e para instruir como rodar:

```
npx serve .
```

Abre um servidor estático na pasta, sem instalação prévia (ou usar a extensão "Live Server" do VS Code). Depois é só abrir a URL local (ex: http://localhost:3000) no navegador — não dá mais para abrir o `index.html` por duplo-clique.

## Arquivos afetados

- `claudefiles/index.html` — reduzido para a casca (head + body + um `<script type="module">`)
- `claudefiles/css/style.css` — novo
- `claudefiles/assets/logo-bracell.png` — novo (extraído do base64 atual)
- `claudefiles/js/*.js` e `claudefiles/js/tabs/*.js` — novos (14 arquivos ao todo)
- `claudefiles/CLAUDE.md` — atualizado (estrutura + instruções de execução)

## Verificação

Sem framework de testes automatizados (mesma situação do projeto hoje). Verificação manual, comparando com o comportamento atual:
- Rodar `npx serve .` e abrir a URL local
- Navegar por todas as 7 abas, confirmar que cada uma renderiza igual a antes
- Testar uma interação de cada tipo: editar um campo de texto (Dados do Projeto), adicionar/remover grupo (Estrutura), posicionar/arrastar/girar um pin (Planta — inclui reconfirmar o suporte a touch da feature anterior), tirar foto/anexar em uma ficha (Equipamentos), adicionar premissa padrão (Premissas)
- Exportar um projeto `.json`, depois importar esse mesmo arquivo de volta, confirmar que o estado é restaurado corretamente (é o caminho que exercita `setState`)
- Gerar o PDF final e confirmar que abre corretamente e tem o logo certo (exercita o `assets/logo-bracell.png`)
- Abrir o console do navegador durante todo o teste e confirmar que não aparece nenhum erro (principalmente `ReferenceError` de função não definida — sintoma de algo que ficou faltando no bridge do `window`)

## Riscos conhecidos

- A lista de funções expostas em `window` foi levantada por grep no arquivo atual; se algum handler inline foi esquecido, o sintoma é um erro no console ao clicar/editar aquele campo específico — a verificação manual (percorrer as 7 abas) deve pegar isso
- `npx serve` baixa o pacote via npm na primeira execução — exige internet na primeira vez (não teria esse problema com o arquivo único de antes)
