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

A logo da Bracell foi **extraída diretamente desse PDF de referência** (via `pdfimages`) e está embutida em base64 no arquivo `index.html` (constante `LOGO_B64`). Não precisa fazer upload de logo — a marca é fixa.

## Estado atual da ferramenta

Arquivo único `index.html` (HTML + CSS + JS vanilla, sem build step, sem framework). Roda direto no navegador, sem servidor.

### Bibliotecas externas (via CDN, cdnjs)
- `html2canvas` 1.4.1 — rasteriza cada "página" da proposta para gerar o PDF
- `jsPDF` 2.5.1 (UMD) — monta o PDF final a partir das imagens rasterizadas
- Google Fonts: Inter (corpo) + Barlow Condensed (títulos, mesma família usada no documento de referência)

### Estrutura de abas (sidebar)
1. **Dados do Projeto** — unidade/local, equipe/núcleo responsável, endereço, responsável técnico, data
2. **01 · Problema & Solução** — dois textareas (mapeados para "Área a ser Monitorada" e "Diretriz da Proposta" do modelo original)
3. **02 · Estrutura** — grupos dinâmicos de equipamento (título do grupo + itens com qtd/nome/descrição). Botão "Gerar a partir da planta" agrega os pins da aba Planta em um novo grupo
4. **03 · Planta / Mapeamento** — upload da planta baixa, toolbar de tipos de equipamento com ícones, clique para posicionar, zoom (60%–400%), lista de pins editável
5. **04 · Fichas de Equipamentos** — uma "ficha" por equipamento posicionado, com recorte automático da planta (canvas, zoom na região do pin) + upload de foto do local de instalação + upload de foto da visualização esperada
6. **05 · Premissas** — lista título/descrição, com botão de sugestões padrão pré-escritas
7. **Gerar Proposta** — resumo com contadores + botão que monta o PDF completo

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
      { tipoId, label, qtd, x, y, direcao, fotoLocal, fotoView }
      // x,y em % relativos à imagem da planta (não em px — funciona com qualquer zoom)
      // direcao em graus (0 = norte/topo, sentido horário) — só relevante para tipos "cameraLike"
      // fotoLocal / fotoView: dataURL de fotos enviadas na aba Fichas de Equipamentos
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
- **Clique** na planta com um tipo selecionado na toolbar → cria um pin novo
- **Arrastar o ícone** (mousedown+mousemove+mouseup) → reposiciona o pin (`startPinDrag` → `onPointerDrag` → `updatePinDOM`)
- **Arrastar o ponto branco** ao redor do ícone (só em tipos `cameraLike`) → gira a direção/cone de visualização (`startRotateDrag`, matemática com `atan2`)
- **Zoom** — a imagem cresce em largura (%) dentro de um container com `overflow:auto`; como as posições dos pins são em %, elas continuam corretas em qualquer zoom
- O slider de direção na lista de pins e o arraste direto na planta ficam sincronizados (`syncPinRowControls`)
- ⚠️ Interação é baseada em eventos de mouse (`mousedown`/`mousemove`/`mouseup`) — **não tem suporte a touch/celular ainda**. Se for preciso usar em tablet/celular, isso precisa ser adaptado para eventos de touch.

### Geração de PDF
- `gerarPDF()` monta um array de "páginas" (cada uma é uma `div` de 1414×1000px), renderiza cada uma fora da tela, rasteriza com `html2canvas` e monta o PDF com `jsPDF`
- Uma página é gerada **por equipamento posicionado** na planta (recorte da planta + foto do local + foto da visualização), então o PDF cresce conforme a quantidade de equipamentos
- Paleta de cores fixa da Bracell: `BRAND.cor` (#0A2E5C, navy), `BRAND.corSecundaria` (#0066B3, azul), `BRAND.corAcento` (#7CC242, verde) — usadas nos triângulos diagonais decorativos, cabeçalhos numerados e legendas, no mesmo estilo visual do documento de referência

### Persistência / colaboração
- **Não usa `window.storage`** (essa API só funciona dentro do ambiente de artifact do Claude, não em um arquivo `.html` baixado e aberto localmente — isso foi tentado antes e removido por não funcionar fora do chat)
- Persistência atual é via **exportar/importar projeto em `.json`** (botões no rodapé da sidebar: `exportarProjeto()` / `importarProjetoFile()`), que serializa/restaura o `state` inteiro, incluindo imagens em base64
- Modelo de colaboração combinado: **não será usado Git/repositório compartilhado** (decisão do usuário) — o desenvolvimento vai continuar diretamente com o Claude, usando este `CLAUDE.md` como fonte de contexto entre sessões

## Limitações conhecidas (em aberto)
- Sem suporte a touch/mobile no posicionamento da planta
- Sem múltiplos projetos simultâneos / histórico de versões dentro da própria ferramenta (cada import de `.json` substitui o estado atual)
- Sem validação de campos obrigatórios antes de gerar o PDF
- PDFs com muitos equipamentos ficam grandes (uma página cheia por equipamento)
- O recorte automático da planta (ficha de equipamento) usa um raio fixo de 28% da imagem — pode não ficar ideal para plantas muito grandes ou muito pequenas
- Sem correção de rotação da cerca/concertina (linha de perímetro) — hoje só existe como ícone pontual, não como traçado ao longo do perímetro

## Próximos passos possíveis (não implementados ainda)
- Suporte a touch para tablets
- Desenhar cerca/concertina como linha/polígono ao longo do perímetro (não só ícone pontual)
- Múltiplos projetos salvos dentro da mesma ferramenta
- Validações antes de gerar PDF (ex: avisar se não tem planta, se faltam fotos nas fichas)
- Ajustar o raio do recorte automático da planta conforme o tamanho da imagem

## Arquivos deste projeto
- `index.html` — a ferramenta completa (único arquivo, sem dependências além dos CDNs citados acima)
- `CLAUDE.md` — este arquivo
