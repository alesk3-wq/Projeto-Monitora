# Design — Melhorias: touch, cerca como traçado, correções de PDF, validações e recorte adaptativo

**Data:** 2026-07-06
**Status:** aprovado pelo usuário (conversa de brainstorming)

## Contexto

Seis itens de melhoria no gerador de propostas de segurança eletrônica (Bracell), decididos a partir da lista de "limitações conhecidas" do CLAUDE.md, mais um bug latente descoberto durante a exploração do código. A ferramenta é vanilla JS (ES modules, sem build), roda via `npx serve .` e é publicada no Firebase Hosting para teste em campo no celular.

Decisões do usuário durante o brainstorming:

- Touch: as dores priorizadas são **falta de pinch-zoom** e **precisão do dedo**. Não incomodam: pin acidental ao rolar, long-press (mas a higiene de long-press entra por custo ~zero).
- Ao arrastar pin no touch, o pin fica **embaixo do dedo** (sem deslocamento acima da ponta do dedo).
- Cerca como traçado: escopo enxuto — **só desenho na planta + entrada na legenda/estrutura**. Sem ficha de equipamento, sem metragem/escala.
- Validações: **avisar e deixar continuar** (lista de pendências + "gerar mesmo assim?"), não bloquear.
- Bug dos pins deslocados no PDF (letterbox do `background-size:contain`): **corrigir junto** — é pré-requisito da cerca no PDF.

## Ordem de implementação

`3 → 4 → 5 → 6 → 1 → 2` (fundações e itens pequenos primeiro; cerca por último porque depende do fix do PDF e das interações touch).

---

## Item 1 — Touch na planta

**Arquivos:** `js/tabs/planta.js`, `css/style.css`

### Pinch-zoom

- Listeners `touchstart`/`touchmove`/`touchend` no `#plantaScroll`, registrados com `{passive:false}`.
- Com **2 dedos** em `touchmove`: `preventDefault()`; a razão entre a distância atual dos dedos e a distância inicial multiplica o zoom de partida. Limites: 60–400% (mesmos dos botões).
- Âncora no ponto médio do pinch: ao mudar a largura do `#plantaWrap`, compensar `scrollLeft`/`scrollTop` do `#plantaScroll` para que o ponto da planta sob o centro do gesto permaneça sob ele.
- **Durante** o gesto: atualizar só `plantaWrap.style.width` e o label de % direto no DOM (sem `renderContent()` — os pins são posicionados em %, acompanham sozinhos; o cone de 110px e o raio de 58px do handle não escalam com zoom, comportamento igual ao atual dos botões de zoom).
- **Ao soltar** (menos de 2 dedos): persistir o valor em `state.planta.zoom` (arredondado, clamp 60–400).
- Com **1 dedo**: nenhuma interceptação — scroll nativo do container continua valendo (pan). O tap-sem-movimento continua criando pin via `click` (comportamento nativo: gesto de scroll não dispara `click`).

### Precisão / alvos maiores

- `@media (pointer: coarse)`: pin de 36px → **44px**, handle de rotação de 20px → **28px**. Como os tamanhos hoje são inline no JS, mover para classes CSS (`.planta-pin`, `.planta-rothandle`) para que a media query funcione; cores/posições continuam inline.
- O pin permanece sob o dedo durante o drag (decisão do usuário). A ferramenta de precisão fina é o pinch-zoom.

### Higiene

- `#plantaScroll { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }` — elimina long-press de "salvar imagem" e seleção acidental durante drags.

---

## Item 2 — Cerca/concertina como traçado

**Arquivos:** `js/state.js`, `js/tabs/planta.js`, `js/pdf.js`, `js/tabs/estrutura.js`, `js/persistence.js`, `css/style.css`

### Modelo de dados

```js
state.planta.cercas = [
  { label: 'Cerca / Concertina', pontos: [ {x, y}, ... ] }  // x,y em % da imagem, como os pins
]
```

- **Compatibilidade:** `.json` antigos não têm `cercas` — o import (`importarProjetoFile`) e o `state` inicial garantem default `[]`. Pins pontuais de cerca já existentes em projetos salvos continuam funcionando como pins normais (não são migrados nem removidos).

### Desenho (modo traçado)

- Selecionar o tipo `cerca` na toolbar entra em **modo traçado** (em vez de criar pin pontual): cada clique/tap na planta adiciona um vértice ao traçado em andamento.
- Barra flutuante durante o traçado: `Pontos: N · Desfazer último · Concluir · Cancelar`. "Concluir" exige ≥ 2 pontos (com < 2, descarta como "Cancelar"). Trocar de tipo na toolbar ou sair da aba com traçado em andamento equivale a "Cancelar".
- Preview ao vivo dos segmentos já clicados durante o traçado.

### Edição

- Vértices de traçados concluídos aparecem como bolinhas arrastáveis (mesma mecânica pointer-events do drag de pins: `pointerdown` → move → up, atualização direta do DOM durante o drag).
- Cada traçado ganha uma linha na lista abaixo da planta: rótulo editável + botão excluir (remove o traçado inteiro). Sem inserção/remoção de vértice individual pós-conclusão (YAGNI — excluir e redesenhar).

### Renderização (editor e PDF — mesma técnica)

- Cada segmento entre vértices consecutivos = uma `<div>` de 4px de altura, fundo `#EB5757`, `border-radius:2px`, com `left/top` no primeiro vértice, `width` = comprimento do segmento em px, `transform-origin: 0 50%`, `transform: rotate(<ângulo>)`.
- No editor os px são calculados a partir do tamanho renderizado do `#plantaWrap` (recalculados no `afterPlantaRender` e ao final do pinch/zoom). No PDF, a partir do retângulo real da imagem (ver Item 3).
- Sem SVG (suporte instável no html2canvas 1.4.1).

### Legenda e Estrutura

- `equipamentoLegend()` (pdf.js) e "Gerar a partir da planta" (estrutura.js) incluem cada traçado como `1x Cerca / Concertina — <label>`.
- Traçados **não** geram ficha de equipamento (nem página no PDF, nem card na aba Fichas).

---

## Item 3 — Fix: pins deslocados na página de Mapeamento do PDF

**Arquivo:** `js/pdf.js`

**Bug:** `pageMapeamento()` posiciona pins em `%` do container (~1286×770px), mas a planta é desenhada com `background-size:contain` — quando a proporção da imagem difere da do container, sobra letterbox e os pins saem deslocados da posição real.

**Correção:**

- `gerarPDF()` carrega a imagem da planta uma vez (`new Image()` + await) para obter `naturalWidth/naturalHeight`.
- `pageMapeamento(imgW, imgH)` calcula o retângulo efetivo do contain-fit (offset + tamanho desenhado dentro do container) e posiciona pins, cones **e segmentos de cerca em px absolutos** relativos a esse retângulo.
- Sem planta anexada, comportamento atual (placeholder) permanece.

---

## Item 4 — Triângulos decorativos do PDF (clip-path → quadrado rotacionado)

**Arquivo:** `js/pdf.js`

**Bug conhecido:** html2canvas 1.4.1 ignora `clip-path`; os triângulos decorativos saem como retângulos no PDF.

**Correção:** cada triângulo decorativo (`clip-path:polygon(100% 0,100% 100%,0 100%)` — todos são quadrados N×N cortados na diagonal a 45°) vira um **quadrado rotacionado 45°** (`transform: rotate(45deg)`) posicionado no canto da página de modo que a diagonal visível coincida com a hipotenusa atual. O `overflow:hidden` do `pageShell` corta o excesso. Vantagem decisiva sobre a técnica de borda: **preserva os degradês** (`linear-gradient(135deg, verde, azul)`), que borda não suporta. Ocorrências: capa (2 triângulos sólidos), sumário, objetivo, estrutura, ficha de equipamento, premissas, encerramento (degradê). A posição/tamanho de cada quadrado é calculada caso a caso para reproduzir a diagonal atual; validação visual comparando PDF × render ao vivo.

---

## Item 5 — Validações antes de gerar o PDF

**Arquivos:** novo `js/validacao.js`, `js/tabs/gerar.js`, `js/pdf.js` (ou `js/main.js` para wiring), `css/style.css`

- `validarProposta(state)` → `[ { campo, msg } ]` com as pendências:
  - Unidade não preenchida (`projeto.unidade`)
  - Problema e/ou Solução vazios (`objetivo`)
  - Planta não anexada (`planta.imagem`)
  - Nenhum grupo/item na Estrutura
  - N equipamentos sem foto do local e/ou da visualização (uma pendência agregada com contagem)
  - Nenhuma premissa cadastrada
- **Aba Gerar Proposta:** checklist visual (✓ verde / ✗ âmbar) derivada da mesma função, substituindo os avisos soltos atuais.
- **Botão Gerar PDF:** com pendências, abre overlay (div modal simples, sem lib) listando-as, com botões **"Gerar mesmo assim"** (prossegue) e **"Voltar e completar"** (fecha). Sem pendências, gera direto.

---

## Item 6 — Recorte das fichas adaptativo + ajustável

**Arquivos:** `js/tabs/equipamentos.js`, `js/pdf.js` (consome o mesmo valor)

- Default adaptativo: `cropFrac = clamp(800 / naturalWidth, 0.15, 0.50)` — plantas de alta resolução recortam uma fração menor (mais zoom), plantas pequenas recortam mais área. O valor exato pode ser calibrado na implementação, mantendo a fórmula `clamp(K/width, min, max)`.
- Cada ficha ganha um slider **"Zoom do recorte"** (faixa ~10–60%), que grava `cropFrac` no pin (`state.planta.pins[i].cropFrac`). Pins sem `cropFrac` usam o default adaptativo (compatível com projetos antigos).
- O preview do recorte na aba atualiza ao soltar o slider; `generateCropDataURL(pin)` passa a ler `pin.cropFrac ?? defaultAdaptativo` — o PDF usa automaticamente o mesmo valor.

---

## Fora de escopo (explícito)

- Metragem/escala da cerca; ficha de equipamento para cerca.
- Migração de pins pontuais de cerca existentes para traçados.
- Inserir/remover vértice individual em traçado concluído.
- Deslocamento do pin acima do dedo durante drag touch (rejeitado pelo usuário).
- Múltiplos projetos, histórico de versões.

## Erros e casos-limite

- Pinch iniciado com traçado de cerca em andamento: o gesto de 2 dedos não adiciona vértices (vértice só em `click`, que não dispara em gesto multi-touch).
- Import de `.json` antigo: defaults para `cercas: []` e `cropFrac` ausente; nunca quebrar por chave faltante.
- Zoom durante drag de vértice/pin: não suportado simultaneamente (dois gestos distintos; o drag de pin usa 1 dedo com `touch-action:none` no alvo, o pinch exige 2 dedos na área de scroll).
- Planta trocada após traçados/pins existentes: comportamento atual (upload zera `pins`) se estende a `cercas`.

## Verificação (manual — projeto sem framework de teste)

1. `npx serve .` + DevTools em modo touch: pinch-zoom ancorado, alvos maiores, drag de pin/vértice, tap cria pin, 1 dedo rola.
2. Teste real no celular via Firebase Hosting.
3. Gerar PDF com planta de proporção bem diferente do container (ex: bem larga) e conferir pins sobre a imagem (Item 3).
4. Conferir triângulos com degradê no PDF × editor (Item 4).
5. Gerar PDF com projeto incompleto → overlay de pendências; completo → gera direto (Item 5).
6. Planta grande (>3000px) e pequena (<1000px): recorte default razoável; slider altera preview e PDF (Item 6).
7. Exportar projeto novo e importar um `.json` antigo (sem `cercas`/`cropFrac`) sem erro.
