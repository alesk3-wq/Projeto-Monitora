# Etiquetas, Sensor de Abertura de Porta e rolagem estável na Planta — Design

Data: 2026-10-22 · Contexto geral do projeto: `CLAUDE.md` (ler antes).

Três melhorias pedidas pelo Luan na aba **02 · Planta / Mapeamento**. São independentes entre si e podem ser entregues em tarefas separadas, nesta ordem sugerida: (1) rolagem, (2) sensor, (3) etiquetas.

---

## 1. Rolagem estável ao editar a planta (bug)

### Problema (palavras do usuário, confirmado)
Com zoom aplicado, o usuário rola até um canto da planta e posiciona um item → a área da planta volta sozinha para o início (scroll 0,0). Causa: toda ação chama `renderContent()` (`js/nav.js`), que recria o `innerHTML` de `#content`; o `#plantaScroll` novo nasce com `scrollLeft/scrollTop = 0`. O mesmo acontece com os botões ➖/➕ Zoom e com qualquer edição que re-renderiza (trocar tipo, concluir cerca, excluir pin, desenhar área, etc.).

### Comportamento esperado
- **Qualquer re-render da mesma aba, na mesma planta, preserva** a rolagem de `#plantaScroll` (horizontal e vertical) **e a rolagem da página** (`window.scrollY` — a lista de pins fica abaixo da planta; excluir um pin da lista não deve jogar a página pro topo).
- **Botões ➖/➕ Zoom e Resetar:** o zoom é ancorado no **centro da área visível** — o ponto da planta que estava no meio da janela continua no meio depois do zoom (mesma ideia da âncora do pinch, que já existe em `attachPinchZoom`).
- **Trocar de aba, trocar de planta (mini-abas), adicionar planta, enviar nova imagem de planta:** não preserva — começa do topo/canto, como hoje.
- O pinch (que não chama `renderContent`) continua como está.
- **Escopo: só a aba Planta** — a preservação (planta e página) só vale quando a aba atual é `planta`; as outras abas ficam como estão, para não mexer no que não foi pedido. *(chamada minha)*
- O "centro visível" dos botões de zoom é o centro da **área visível de `#plantaScroll`** (mesma referência do pinch), não da janela do navegador. *(chamada minha)*

### Como (decidido)
- Salvar/restaurar centralizado em `renderContent()` quando a aba não mudou (o restaurar é feito logo após `innerHTML` + `afterPlantaRender`). A condição "mesma planta" compara `state.plantaAtiva` antes/depois — o builder decide onde guardar esse "antes" (ex.: variável de módulo em `nav.js` com aba + plantaAtiva do último render).
- `zoomPlanta`/`resetZoom` calculam a fração do centro visível antes, chamam `renderContent()` e então sobrescrevem a rolagem para manter essa fração centralizada.
- Detalhe a respeitar: com a imagem ainda não decodificada, `#plantaWrap` pode ter altura 0 no instante do restore; a imagem é um dataURL já em cache na maioria dos casos, mas se `img.complete` for falso o builder deve reaplicar a rolagem no `load` da imagem (já existe um listener de `load` em `afterPlantaRender` para as cercas).

---

## 2. Novo equipamento: Sensor de Abertura de Porta

- Novo item em `EQUIP_TYPES` (`js/constants.js`), inserido **antes de `outro`**:
  `{id:'sensor_porta', label:'Sensor de Abertura de Porta', color:'#E60000', cameraLike:false}`
  - Cor: vermelho vivo, pedido do usuário ("vermelhinho"). Escolhido `#E60000` para ficar distinguível do `#EB5757` (salmão, já usado por Acesso Veicular e Cerca) e do `#C0392B` (Área 6). *(chamada minha)*
- Ícone novo em `ICONS.sensor_porta`, SVG desenhado à mão no mesmo padrão dos outros (16×16, viewBox 24, `stroke="white"`): uma porta (retângulo vertical com maçaneta) com um pequeno sensor magnético (dois retângulos curtos alinhados no batente). O desenho exato é do builder; precisa ser legível a 16px.
- É um equipamento comum: ganha número global "Ponto N", item no "Gerar a partir da planta", ficha, entrada na legenda do PDF, aparece no select de tipo da lista de pins. Nada além de adicionar a constante e o ícone deve ser necessário — o builder confirma que nenhum lugar tem lista de tipos hardcoded.

---

## 3. Etiquetas (anotações com seta) na planta

### Para que serve
Anotar a planta para apontar algo — tipicamente **erros do projeto arquitetônico** (ex.: uma porta desenhada que não leva a lugar nenhum → etiqueta "Esta porta não existe" com a seta apontando a porta), ou qualquer observação livre. É uma **anotação, não um equipamento**.

### Não-objetivos (decididos)
- Etiqueta **não** ganha número "Ponto N", **não** entra na Estrutura (nem no "Gerar a partir da planta"), **não** gera ficha, **não** conta nos contadores da aba Gerar nem na validação, **não** entra na legenda de equipamentos da página Estrutura do PDF.
- Sem formatação de texto, sem cores escolhíveis, sem múltiplas setas por etiqueta.
- Etiquetas **não aparecem nos recortes das fichas** (`generateCropDataURL`), igual a áreas e cercas hoje. *(chamada minha)*

### Interação no editor
- Na toolbar de tipos, um botão **"Etiqueta"** (ao lado de "Demarcar Área", mesmo estilo de botão especial, ícone 🏷 ou SVG simples num `icon-dot` amarelo-escuro). Selecionar seta `pl.selectedTipo = 'etiqueta'` (como `'area'`), o que cancela traçado de cerca em andamento pela lógica já existente de `selectTipo`.
- Com "Etiqueta" selecionado, **clicar/tocar na planta cria uma etiqueta**: a **ponta da seta** fica exatamente no ponto clicado e a **caixa** nasce deslocada para cima-direita (ex.: +6% x, −8% y, com clamp para ficar dentro de 0–100%), com texto padrão **"Nova etiqueta"**. Após criar, o foco vai para o campo de texto dessa etiqueta na lista (para o usuário já digitar).
- **Arrastar a caixa** move só a caixa (a ponta da seta fica parada). **Arrastar a bolinha da ponta** move só a ponta. Ambos funcionam **sempre**, em qualquer modo selecionado (como os pins), com mouse e touch, reaproveitando o padrão de pointer events de `planta.js`/`areas.js` (incluindo `suppressNextClick` para não criar item ao soltar um arraste).
- A **perninha**: linha reta do centro da caixa até a ponta (a caixa fica por cima, então visualmente a linha sai da borda), terminando numa **ponta de seta** (triângulo) apontando para o alvo. A bolinha de arraste da ponta fica sobre ela no editor (só no editor; no PDF sai só a seta).
- Caixa: fundo amarelo-claro tipo post-it (`#FFF4C2`), borda `#E0A800`, texto escuro, fonte ~12px, `max-width` ~180px com quebra de linha. Linha e seta em cinza escuro (`#333`). Tamanhos em **px fixos** (não escalam com o zoom, como os pins); posições em **% da imagem** (como tudo), então ficam corretas em qualquer zoom e no pinch.
- Camadas: etiquetas **por cima de tudo** (áreas → cercas → pins → etiquetas).
- **Lista abaixo da planta:** uma linha por etiqueta (ícone + "E1", "E2"…, input de texto que edita ao vivo e atualiza a caixa na planta sem re-render, botão ✕ excluir), depois das linhas de áreas. A mensagem "Nenhum equipamento posicionado ainda" considera também as etiquetas.

### Modelo de dados
Em cada planta: `etiquetas: [ { texto, x, y, ax, ay } ]`
- `x, y` = posição do canto superior-esquerdo da caixa, em % da imagem.
- `ax, ay` = ponta da seta, em % da imagem.
- `novaPlanta()` inclui `etiquetas: []`; import de `.json` antigos aplica `etiquetas: []` (mesmo padrão de `cercas`/`areas` em `persistence.js`).
- Enviar uma nova imagem de planta limpa as etiquetas (como já limpa pins/cercas/áreas) — vale para imagem e para o fluxo de PDF (`plantaPdf.js`).
- `removePlanta` considera etiquetas no "tem conteúdo?" do `confirm`.

### PDF (página Mapeamento)
- Etiquetas desenhadas na página de Mapeamento da planta, **por último** (por cima dos pins), em px relativos ao retângulo efetivo da imagem (`containRect`), como pins/áreas.
- Restrições do `html2canvas` 1.4.1 (ver CLAUDE.md): **sem `clip-path`, sem SVG inline para a seta**. Linha = `<div>` fina rotacionada (como segmento de cerca); ponta = triângulo pela técnica de bordas transparentes (como o cone de câmera), rotacionado na direção da linha.
- Plantas cuja única coisa são etiquetas **não** são puladas no PDF multi-planta (entram na checagem de "planta vazia").

### Texto livre e escape (decidido)
O texto da etiqueta é livre e com aspas/`<` frequentes ("porta \"fantasma\""). Hoje o app não escapa nada (limitação conhecida). **Para as etiquetas**, o texto deve ser seguro: no editor a caixa é criada via DOM com `textContent`; no input da lista e no PDF, passar por um helper `escHtml` novo em `js/utils.js` (escapa `& < > " '`). Não é escopo aplicar `escHtml` ao resto do app.

---

## 4. Área da planta aproveitando a tela no PC

### Problema (confirmado com o usuário)
No PC, a aba Planta fica presa em `#content{max-width:1000px}`: sobra faixa vazia dos lados em monitores largos. E `#plantaScroll{max-height:560px}` limita a altura, então mesmo em tela grande se vê um pedaço pequeno da planta. O usuário quer que a área da planta ocupe a largura e a altura disponíveis no PC.

### Como (decidido — chamadas minhas)
- **Só na aba Planta** o `#content` perde o `max-width` (ex.: classe `wide` aplicada por `renderContent()` quando a aba é `planta`, removida nas outras). As outras abas (formulários de texto) continuam com 1000px — esticar textareas em 1900px piora a leitura.
- **Altura do `#plantaScroll` em telas largas** (acima do breakpoint de 1024px já existente): passa a acompanhar a altura da janela — `max-height: max(560px, calc(100vh - 140px))` ou equivalente — para a planta caber na tela sem rolar a página. O builder ajusta o offset para a toolbar de zoom ficar visível junto.
- **Mobile/tablet (≤1024px):** sem mudança.
- Nada muda na geração do PDF (as páginas têm tamanho fixo).

---

## Testes
- Estender `test-harness.html` com asserções (headless, padrão existente): `sensor_porta` aparece na toolbar; `novaPlanta` tem `etiquetas:[]`; import de `.json` sem `etiquetas` recebe `[]`; criar etiqueta e checar que ela aparece na lista e no DOM da planta e **não** aparece em Estrutura/fichas/contadores; texto com `"` e `<` não quebra a linha da lista; rolagem de `#plantaScroll` preservada após um re-render na mesma planta (setar `scrollLeft/Top`, chamar uma ação que re-renderiza, conferir) e zerada após trocar de planta.
- Verificação manual do PDF com etiquetas e sensor (gerar e olhar), e smoke em viewport mobile (Chrome headless/emulação).

## Deixado para o builder
- Desenho exato do ícone do sensor e do ícone do botão Etiqueta.
- Offsets exatos de criação da caixa, tamanhos de fonte/padding, espessura da linha e tamanho da ponta.
- Se a lógica de etiquetas vive num módulo próprio `js/tabs/etiquetas.js` (recomendado, seguindo o precedente de `areas.js`) e como `planta.js` delega.
- Atualizar o `CLAUDE.md` no fim (modelo de dados, tipos, interações, PDF, limitações).
