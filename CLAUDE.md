# CLAUDE.md — Gerador de Propostas de Segurança Eletrônica (Bracell)

Este arquivo documenta o contexto completo do projeto para que o desenvolvimento possa continuar em outra conversa/sessão com o Claude, sem perder o histórico de decisões.

## Contexto do projeto

**Quem usa:** Luan, Especialista de Segurança Eletrônica no Depto. Segurança Patrimonial da Bracell.

**O que é:** Uma ferramenta interna (não é produto para clientes externos) para montar propostas técnicas de segurança eletrônica — CFTV e Controle de Acesso — para diferentes unidades/áreas da própria Bracell. A Segurança Patrimonial é ao mesmo tempo autora e entregadora dessas propostas; não existe relação de "integradora vendendo para cliente".

**Por que foi criada:** Nenhuma ferramenta de mercado (JVSG, VideoCAD, Edraw CCTV Network) combina, num único fluxo: diagnóstico (problema/solução), estruturação de equipamentos por função de segurança, posicionamento interativo em planta baixa e geração automática de proposta em PDF. Isso hoje é feito manualmente juntando Excel + Word + planta separada.

**Documento de referência:** Um projeto real já entregue (Auto Posto Bracell, Rev. 4.1, 11/Maio/2026) foi usado como modelo. A estrutura exata do documento de referência foi extraída e replicada:
1. Capa (Projeto Seg. Eletrônica + unidade + depto + data)
2. Sumário
3. **01 - Objetivo do Projeto** → "Área a ser Monitorada" (problema) + "Diretriz da Proposta" (solução)
4. **02 - Estrutura** → equipamentos agrupados por função de segurança (ex: "Defesa Perimetral Anti-Invasão", "Controle de Acesso e Blindagem de Entrada"), cada grupo com itens no formato "NxEquipamento: descrição/justificativa"
5. **03 - Mapeamento** → planta baixa real com ícones posicionados + legenda lateral com contagem por tipo
6. **04 - Premissas** → lista "Título: descrição" (retenção de dados, responsabilidades de TI, disponibilidade CCOS, etc.)
7. Encerramento ("Servir e Proteger" + logo)

A logo da Bracell foi **extraída diretamente desse PDF de referência** (via `pdfimages`) e está salva como arquivo em `assets/logo-bracell.png`. Não precisa fazer upload de logo — a marca é fixa.

## Estado atual da ferramenta

A ferramenta é separada em `index.html` (casca HTML) + `css/style.css` + `assets/logo-bracell.png` + módulos ES em `js/` (um arquivo por responsabilidade, ver `js/tabs/` para os templates de cada aba). Sem build step, sem framework — só ES modules nativos do navegador.

**Como rodar:** a partir da pasta `claudefiles/`, rode `npx serve .` (não precisa instalar nada) e abra a URL local impressa no terminal. Não é mais possível abrir `index.html` direto por duplo-clique — navegadores bloqueiam `import`/`export` de módulos ES quando a página é aberta via `file://`.

### Bibliotecas externas (via CDN, cdnjs)
- `html2canvas` 1.4.1 — rasteriza cada "página" da proposta para gerar o PDF
- `jsPDF` 2.5.1 (UMD) — monta o PDF final a partir das imagens rasterizadas
- Google Fonts: Inter (corpo) + Barlow Condensed (títulos, mesma família usada no documento de referência)

### Estrutura de abas (sidebar)
1. **Dados do Projeto** — unidade/local, equipe/núcleo responsável, endereço, responsável técnico, data
2. **01 · Problema & Solução** — dois textareas (mapeados para "Área a ser Monitorada" e "Diretriz da Proposta" do modelo original)
3. **02 · Planta / Mapeamento** — upload da planta baixa, toolbar de tipos de equipamento com ícones, clique para posicionar, zoom (60%–400%, botões ou pinch com dois dedos), lista de pins editável. Selecionar o tipo **Cerca / Concertina** entra em *modo traçado*: cada clique adiciona um vértice de uma linha de perímetro (barra flutuante com Desfazer/Concluir/Cancelar; concluir exige ≥2 pontos), e os traçados concluídos têm vértices arrastáveis + linha própria na lista. Vem antes de Estrutura de propósito: o usuário posiciona os equipamentos na planta primeiro, depois usa o botão "Gerar a partir da planta" na aba Estrutura para agregar esses pins automaticamente
4. **03 · Estrutura** — grupos dinâmicos de equipamento (título do grupo + itens com qtd/nome/descrição). Botão "Gerar a partir da planta" agrega os pins **e os traçados de cerca** da aba Planta em um novo grupo
5. **04 · Fichas de Equipamentos** — uma "ficha" por equipamento posicionado (traçados de cerca não geram ficha), com recorte automático da planta (fração adaptativa à resolução: `clamp(800/largura, 15%, 50%)`, ajustável por ficha via slider "Zoom do recorte" que grava `pin.cropFrac`) + upload de foto do local de instalação + upload de foto da visualização esperada
6. **05 · Premissas** — lista título/descrição, com botão de sugestões padrão pré-escritas
7. **Gerar Proposta** — resumo com contadores + checklist de pendências (✓/✗ por item, via `validarProposta()` de `js/validacao.js`) + botão que chama `solicitarGerarPDF()`: se houver pendências abre um modal listando-as com "Gerar mesmo assim" / "Voltar e completar"; sem pendências gera direto

Nota: a ordem das abas na barra lateral (Planta antes de Estrutura) segue a ordem das seções no PDF gerado (ver "Geração de PDF" abaixo) — as duas mudam juntas por decisão do usuário.

### Modelo de dados (`state`)
```js
state = {
  projeto: { unidade, local, equipe, responsavel, data },
  objetivo: { problema, solucao },
  estrutura: [ { titulo, itens: [ {qtd, nome, desc} ] } ],
  planta: {
    imagem,          // dataURL da planta baixa
    selectedTipo,    // tipo de equipamento selecionado na toolbar
    zoom,            // 60–400 (%)
    pins: [
      { tipoId, label, qtd, x, y, direcao, fotoLocal, fotoView, cropFrac }
      // x,y em % relativos à imagem da planta (não em px — funciona com qualquer zoom)
      // direcao em graus (0 = norte/topo, sentido horário) — só relevante para tipos "cameraLike"
      // fotoLocal / fotoView: dataURL de fotos enviadas na aba Fichas de Equipamentos
      // cropFrac (opcional): fração do recorte da ficha (0.10–0.60); ausente = default adaptativo
    ],
    cercas: [
      { label, pontos: [ {x, y}, ... ] }
      // traçados de cerca/concertina como polilinha; pontos em % da imagem, como os pins
      // .json antigos sem essa chave importam com cercas:[] (default aplicado no import)
    ]
  },
  premissas: [ {titulo, desc} ],
}
```

### Tipos de equipamento (`EQUIP_TYPES`)
10 tipos definidos, cada um com `id`, `label`, `color` e `cameraLike` (bool):
`bullet`, `dome`, `ptz`, `lpr` (todos `cameraLike:true`, têm cone de direção), `acesso_veic`, `acesso_ped`, `fechadura`, `biometria`, `cerca`, `outro`.

Ícones SVG desenhados à mão (não são de biblioteca externa) em `ICONS`, um por tipo — câmera genérica para os 4 tipos de câmera (diferenciados por cor), cancela para acesso veicular, catraca/porta para acesso pedestre, cadeado para fechadura, digital/impressão digital para biometria, cerca para cerca/concertina.

### Interações implementadas na planta
- **Clique/tap** na planta com um tipo selecionado na toolbar → cria um pin novo (ou, com o tipo `cerca` selecionado, adiciona um vértice ao traçado em andamento — `tracoAtual`, variável de módulo em `js/tabs/planta.js`)
- **Arrastar o ícone** (pointer events, funciona com mouse e touch) → reposiciona o pin (`startPinDrag` → `onPointerDrag` → `updatePinDOM`); vértices de cerca usam a mesma mecânica (`startVertexDrag`, `dragState.type==='vertex'`)
- **Arrastar o ponto branco** ao redor do ícone (só em tipos `cameraLike`) → gira a direção/cone de visualização (`startRotateDrag`, matemática com `atan2`)
- **Zoom** — a imagem cresce em largura (%) dentro de um container com `overflow:auto`; como as posições dos pins são em %, elas continuam corretas em qualquer zoom. No touch há **pinch-zoom com dois dedos** (`attachPinchZoom` em `js/tabs/planta.js`: listeners `touchstart/move/end/cancel` com `{passive:false}`, ancorado no ponto médio do gesto, atualização ao vivo sem `renderContent()`); um dedo rola nativamente
- **Touch**: alvos maiores em telas touch via `@media (pointer: coarse)` (classes `.planta-pin` 36→44px, `.planta-rothandle` 20→28px, `.cerca-vertex` 14→24px); `#plantaScroll` tem `user-select:none` + `-webkit-touch-callout:none` (bloqueia long-press/seleção) e `touch-action:pan-x pan-y`
- Os segmentos de cerca no editor são `<div>`s rotacionadas com posição/comprimento em % — invariantes ao zoom (o pinch não precisa re-renderizá-los). `afterPlantaRender` re-executa `renderCercas` no `load` da imagem da planta (sem isso, a geometria sairia errada quando a aba renderiza antes do decode — ex: logo após importar um `.json`)
- O slider de direção na lista de pins e o arraste direto na planta ficam sincronizados (`syncPinRowControls`)
- Trocar de aba ou trocar o tipo na toolbar **cancela** um traçado de cerca em andamento (`cancelarTraco`); clicar na aba já ativa não cancela

### Geração de PDF
- `gerarPDF()` monta um array de "páginas" (cada uma é uma `div` de 1414×1000px), renderiza cada uma fora da tela, rasteriza com `html2canvas` e monta o PDF com `jsPDF`
- Ordem atual das páginas: Capa, Sumário, Objetivo (01), **Mapeamento (02)**, **Estrutura (03)** — a legenda de equipamentos posicionados na planta é renderizada na página de Estrutura, não na de Mapeamento (foi movida para lá para deixar a planta ocupar a largura toda) —, Fichas de Equipamento (uma por pin), Premissas (05), Encerramento
- Uma página é gerada **por equipamento posicionado** na planta (recorte da planta + foto do local + foto da visualização), então o PDF cresce conforme a quantidade de equipamentos
- Paleta de cores fixa da Bracell: `BRAND.cor` (#0A2E5C, navy), `BRAND.corSecundaria` (#0066B3, azul), `BRAND.corAcento` (#7CC242, verde) — usadas nos triângulos diagonais decorativos, cabeçalhos numerados e legendas, no mesmo estilo visual do documento de referência
- Na página de Mapeamento, pins/cones/segmentos de cerca são posicionados **em px relativos ao retângulo efetivo da imagem** (helpers `loadImageDims` + `containRect` em `js/pdf.js`): como a planta é encaixada com `background-size:contain`, posicionar em % do container deslocava os pins quando a proporção da imagem diferia da do container (bug corrigido). Os segmentos de cerca são emitidos **antes** dos pins para os pins ficarem por cima, como no editor
- ⚠️ **`html2canvas` 1.4.1 não suporta `clip-path` nem `object-fit`** (ambos são silenciosamente ignorados na rasterização, mesmo renderizando corretamente no DOM ao vivo), e o suporte a SVG inline é instável. Por isso `js/pdf.js` evita tudo isso: cones de direção de câmera usam a técnica de borda transparente (`border-left`/`border-right` transparentes + `border-top` colorido, com `transform-origin`/`rotate`); a imagem da planta usa uma `<div>` com `background-image`+`background-size:contain`; os **triângulos decorativos** usam o helper `triDecor()` — um quadrado de lado `N·√2` rotacionado 45° posicionado no canto (a página tem `overflow:hidden`), que reproduz a diagonal do antigo `clip-path` **e preserva os degradês** (o gradiente interno usa `90deg` para compensar a rotação e aparecer como `135deg`); e os segmentos de cerca são `<div>`s finas rotacionadas via `transform`

### Persistência / colaboração
- **Não usa `window.storage`** (essa API só funciona dentro do ambiente de artifact do Claude, não em um arquivo `.html` baixado e aberto localmente — isso foi tentado antes e removido por não funcionar fora do chat)
- Persistência atual é via **exportar/importar projeto em `.json`** (botões no rodapé da sidebar: `exportarProjeto()` / `importarProjetoFile()`), que serializa/restaura o `state` inteiro, incluindo imagens em base64
- O projeto agora tem um repositório remoto no GitHub (`https://github.com/alesk3-wq/Projeto-Monitora`), branch `master`. O desenvolvimento continua diretamente com o Claude, usando este `CLAUDE.md` como fonte de contexto entre sessões — o Git remoto é usado como backup/histórico, não como fluxo de colaboração multi-pessoa (ainda é uma única pessoa desenvolvendo com o Claude)

## Limitações conhecidas (em aberto)
- Sem múltiplos projetos simultâneos / histórico de versões dentro da própria ferramenta (cada import de `.json` substitui o estado atual)
- PDFs com muitos equipamentos ficam grandes (uma página cheia por equipamento)
- Traçado de cerca não tem metragem/escala (decisão de escopo) nem edição de vértice individual pós-conclusão (excluir e redesenhar)
- Rótulos de pins/cercas são interpolados sem escape em atributos `value="..."` — um rótulo contendo `"` quebra a linha da lista (padrão pré-existente em todo o app)
- Pinch/touch real validado só por emulação até agora — pendente teste de campo no celular (via Firebase Hosting)

## Próximos passos possíveis (não implementados ainda)
- Múltiplos projetos salvos dentro da mesma ferramenta
- Metragem da cerca com calibração de escala da planta
- Escape de HTML nos valores interpolados nos templates

## Arquivos deste projeto
- `index.html` — casca HTML (estrutura da página, sem lógica)
- `css/style.css` — todo o CSS da ferramenta
- `assets/logo-bracell.png` — logo da Bracell extraída do PDF de referência
- `js/state.js` — modelo de dados (`state`) e `setState`
- `js/constants.js` — constantes fixas (ex: `EQUIP_TYPES`, `ICONS`, `BRAND`)
- `js/utils.js` — funções utilitárias (ex: `todayISO`, `defaultCropFrac`)
- `js/validacao.js` — `validarProposta()` (lista de pendências) e `CHECKS` (checklist da aba Gerar Proposta)
- `js/nav.js` — navegação entre abas e renderização de conteúdo (`renderNav`, `renderContent`, `switchTab`)
- `js/persistence.js` — exportar/importar projeto em `.json` (`exportarProjeto`, `importarProjetoFile`)
- `js/pdf.js` — geração do PDF final (`gerarPDF`)
- `js/main.js` — ponto de entrada: importa os módulos, expõe funções no `window` e inicia a renderização
- `js/tabs/` — um módulo por aba da sidebar (Dados do Projeto, Objetivo, Estrutura, Planta, Equipamentos, Premissas, Gerar Proposta), com o template e as funções de cada aba
- `CLAUDE.md` — este arquivo
