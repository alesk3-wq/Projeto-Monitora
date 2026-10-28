# Vista aérea — design

## Por que

A planta baixa que chega para o projeto quase sempre mostra só o prédio por dentro. Não aparecem árvores, a rua, os estacionamentos próximos nem os caminhos de pedestres e veículos. O projeto de CFTV também cobre a área **externa**, e hoje não há onde mostrar esse entorno. A vista aérea é uma foto de satélite do local, posicionada no projeto como se fosse mais uma planta. Nela o Luan coloca equipamentos **que já existem nas plantas**, para mostrar no PDF detalhes que a planta não tem.

## Objetivos

- Uma ou mais **vistas aéreas** por projeto, ao lado das plantas, nas mini-abas da aba 02 · Planta.
- A imagem de fundo vem de duas fontes; o usuário escolhe qual usar:
  - **Mapa de satélite (padrão).** O mapa abre dentro do app. O usuário busca o endereço ou cola as coordenadas, navega, enquadra e clica em **Capturar**. A captura vira a imagem de fundo **com a escala já definida**, porque o app sabe quantos metros tem cada pixel.
  - **Botão para enviar uma imagem própria.** Pode ser um print do Google Earth ou do Maps, uma foto de drone ou um PDF. O fluxo é o mesmo upload das plantas (imagem ou PDF com seletor de página). A escala é marcada com 📏 Escala, como numa planta.
- Os equipamentos da vista aérea vêm da **lista dos que já estão posicionados nas plantas**, por exemplo "Bullet 3 · Térreo".
  - O usuário escolhe um da lista e toca no lugar da foto.
  - **Não há contagem nova:** o número, o tipo, o rótulo e a altura vêm do pin original.
  - Só é preciso colocar os equipamentos que interessam, normalmente os externos.
  - Cada equipamento aparece no máximo uma vez em cada vista aérea.
- **O foco de cada câmera é ajustado na própria vista aérea**: direção, alcance e abertura. O zoom e o enquadramento da foto não batem com os da planta, então a vista aérea **não altera a planta** e a planta não altera a vista.
- Ferramentas de desenho continuam disponíveis na vista aérea:
  - Demarcar Área, Etiqueta, Muro / Parede e 📏 Escala.
  - Os itens de cenário do menu Inserir (Portão, Porta, Janela, Poste).
- **PDF:** cada vista aérea que tenha imagem sai como uma página de Mapeamento depois das páginas das plantas. O título é "Mapeamento — {nome da vista}" e a página traz a mesma legenda de rodapé, mais o crédito da imagem quando ela veio do mapa.

## Fora do escopo (não fazer)

- Google Maps / Google Earth integrados: o Google exige chave de API com faturamento e restringe a captura. Quem quiser imagem do Google faz um print e envia pelo botão.
- Criar equipamento novo na vista aérea. Equipamento nasce só na planta.
- Ficha, Estrutura, contadores e validação: continuam saindo **só das plantas**. A vista aérea não entra em nenhum deles. A ficha continua usando o recorte da planta.
- Sincronizar o foco entre a planta e a vista.

## Anti-objetivos (seria falha mesmo funcionando)

- Equipamentos com numeração diferente entre a vista aérea e a planta, ou contados duas vezes nos totais.
- Projetos e `.json` antigos mudando de comportamento.
- A vista aérea quebrar o fluxo das plantas: mini-abas, numeração, rolagem e as ferramentas que já existem.

## Restrições

- Sem build step; bibliotecas só pelo CDN cdnjs, com versão fixa: **Leaflet 1.9.4** (`leaflet.js` + `leaflet.css`).
- **Imagens de satélite:** Esri World Imagery, `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
  - Responde com `Access-Control-Allow-Origin: *`, o que foi testado nesta rede.
  - Atribuição obrigatória: "Imagens: Esri, Maxar, Earthstar Geographics" no mapa e no PDF.
- **Busca de endereço:** Nominatim (`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=…`).
  - No máximo 1 requisição por busca, só quando o usuário clica Buscar; nada de autocompletar a cada tecla.
  - A busca também aceita coordenadas coladas no formato "lat, long", como o Google Maps copia (ex.: `-22.6029, -48.8031`). Nesse caso não chama a rede.
- **Captura:** montar a imagem num canvas próprio, com os tiles do zoom atual cobrindo o retângulo visível, carregados com `crossOrigin='anonymous'`. Não usar html2canvas sobre o Leaflet.
  - Lado máximo da captura: **4096 px** (limite do canvas no Safari do iOS). Se o enquadramento passar disso, reduzir proporcionalmente.
  - Saída em JPEG (qualidade ~0,9) como dataURL, igual à `imagem` das plantas.
- **Escala da captura:**
  - metros por pixel = `156543.03392 · cos(lat) / 2^zoom`, com `lat` no centro do enquadramento e o zoom dos tiles usados, ajustado se a imagem for reduzida.
  - Grava a mesma `escala` das plantas (`{a, b, metros, metrosLargura}`), com `a`/`b` nas duas pontas da largura, numa linha horizontal no meio.
  - Com isso, todo o foco em metros e o ponto cego já existentes funcionam sem mudança.
- Se a rede falhar (tile, busca ou CDN do Leaflet), aparece um toast explicando e o botão de enviar imagem continua funcionando, igual ao fallback do PDF.js.
- Trocar a imagem da vista (nova captura ou upload) apaga o conteúdo dela, como em `limparPlanta`. A nova captura traz uma escala nova.

## Decisões de como fazer (minhas, para o construtor seguir)

- **Dados:**
  - As vistas ficam numa lista **separada** das plantas: `state.aereas = [ … ]`, com objetos de mesmo formato de uma planta mais `aerea: true` e `fonte: 'mapa' | 'upload'`.
  - Todo o código que já percorre `state.plantas` (numeração, Estrutura, fichas, validação, legenda da Estrutura) fica intocado e ignora as vistas automaticamente.
  - O editor continua lendo `state.planta`. O getter passa a devolver a vista aérea ativa quando ela está selecionada; por exemplo, `state.aereaAtiva` (índice ou `null`) tem prioridade sobre `plantaAtiva`.
  - O `.json` exporta `aereas` e o import normaliza: sem a chave, `aereas: []`.
- **Equipamento colocado na vista:** pin de referência `{id, ref: <id do pin na planta>, x, y, direcao, alcance, alcanceM, abEsq, abDir}`.
  - Tipo, rótulo, número e **altura** vêm sempre do pin original. A altura é física, a mesma câmera, então muda nos dois lugares. A direção e o alcance são próprios.
  - Se o original for excluído, a referência some da vista. Se o tipo do original mudar, a referência acompanha.
  - Itens de cenário inseridos na vista são pins normais dela, sem `ref`.
- **Toolbar na vista aérea:**
  - O menu **＋ Inserir** mostra só o cenário (Aberturas, Estruturas, Outros sem equipamento) e as ferramentas de desenho.
  - Um botão **"Equipamentos da planta"** abre a lista agrupada por tipo, na ordem de `pontosPorTipo()`, com ícone + `Tipo N · Planta`. Itens já colocados nesta vista aparecem marcados e desabilitados.
  - A Cerca / Concertina não fica disponível na vista aérea, porque é equipamento contado.
- **Mini-abas:** as vistas aparecem depois das plantas, com o ícone 🛰 no nome, e um botão **"+ Vista aérea"** ao lado de "+ Nova planta". Nome padrão "Vista aérea N", editável; excluir com `confirm` quando tem conteúdo. Uma planta é obrigatória; vista aérea não.
- **Tela vazia de uma vista aérea:** o mapa ocupa a área da planta, com campo de busca + Buscar, os controles de zoom do Leaflet, o botão **Capturar** e, ao lado, **Enviar imagem própria**. Depois de capturar, aparece o editor normal com a foto e o botão **"Trocar imagem"**, que reabre o mapa no último enquadramento salvo (`centro`/`zoomMapa` gravados na vista) ou o upload.
- **Editor:** reutiliza `planta.js` tal como está; as diferenças por `pl.aerea` ficam isoladas num módulo novo, `js/tabs/aerea.js`, com mapa, captura, lista de equipamentos e template.
- **PDF:**
  - `pageMapeamento` recebe a vista como recebe uma planta.
  - O número no badge e o tipo do pin de referência vêm do original.
  - A legenda da página conta o que está na vista.
  - Quando `fonte==='mapa'`, sai o crédito "Imagens: Esri, Maxar, Earthstar Geographics" pequeno, no canto inferior da imagem.
  - Vista sem imagem não gera página.
- Testes no `test-harness.html` para:
  - o cálculo de metros/pixel;
  - a normalização do `.json`;
  - a referência a pin, inclusive original excluído e mudança de tipo;
  - a numeração e os contadores não mudarem;
  - a página do PDF.
  - O mapa em si, que depende de rede, é verificado à mão.

## Detalhes decididos após a revisão (minhas decisões)

- **Pin de referência no editor:** antes de renderizar, ele é **materializado** num pin derivado que tem os campos do original (`tipoId`, `label`, `qtd`, `altura`) e os campos próprios da vista. Com isso, `planta.js` funciona quase sem mudança.
  - Na lista da vista, tipo, rótulo e número são **somente leitura**.
  - São editáveis direção, alcance, abertura, **altura** (grava no pin original) e "Remover desta vista".
  - Nada de foto nem cropFrac na vista.
- **Número do badge na vista:** vem do original, procurando pelo `ref` o `(plantaIdx, pinIdx)` em `state.plantas`. Nunca pelo índice na vista.
- **`plantaAtiva` não muda** enquanto uma vista está ativa. `aereaAtiva` (índice ou `null`) é exportado no `.json`; no import, se o valor estiver fora do intervalo, vira `null`. Selecionar uma planta põe `aereaAtiva = null`.
- **Legenda da vista:** soma a `qtd` do original, igual à legenda das plantas.
- **Muros da vista:** pertencem à vista e bloqueiam só as câmeras da vista.
- **Trocar imagem:**
  - Uma nova captura ou um novo upload apaga as referências, o cenário, as áreas e as etiquetas da vista.
  - Muros seguem a regra de `limparPlanta` (não apagados).
  - Quando a vista tem conteúdo, o app pede `confirm` antes.
- **Referências órfãs** (original excluído, ou planta excluída) são removidas por uma única `limparRefsOrfas()`, chamada no render da aba Planta, no export e no `gerarPDF`.
- **Zoom do mapa:** máximo **19**.

## Deixado para o construtor

- O layout exato da tela do mapa e da lista de equipamentos, seguindo o visual atual do app.
- Como montar a captura a partir dos tiles: a grade, a ordem de carregamento e a espera.
- Mensagens de toast.
