# Vista aérea — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vistas aéreas por projeto (mapa de satélite Esri capturado no app, ou imagem enviada), com equipamentos referenciados das plantas (mesmo número, foco próprio) e página de Mapeamento no PDF.

**Architecture:** `state.aereas` é uma lista separada de `state.plantas` (objetos com formato de planta + `aerea:true`), então numeração/Estrutura/fichas/validação continuam intocadas. O alias `state.planta` passa a devolver a vista ativa quando `state.aereaAtiva !== null`, e o editor `planta.js` é reaproveitado. Pins de referência ganham *accessors* não-enumeráveis (`tipoId`, `label`, `qtd`, `altura`) que leem/escrevem o pin original — fora do JSON, transparentes para o editor e o PDF.

**Tech Stack:** ES modules sem build; Leaflet 1.9.4 (cdnjs); tiles Esri World Imagery; busca Nominatim; harness headless `test-harness.html`.

**Spec:** `docs/superpowers/specs/2026-10-28-vista-aerea-design.md`

## Global Constraints

- Sem build step; Leaflet só via `https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js` e `.../leaflet.min.css`.
- Tiles: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`; zoom máximo do mapa **19**.
- Crédito (mapa e PDF): `Imagens: Esri, Maxar, Earthstar Geographics`.
- Busca: `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=…`, só ao clicar Buscar; coordenadas "lat, long" coladas não chamam a rede.
- Captura: canvas próprio com tiles `crossOrigin='anonymous'`, lado máximo **4096 px**, JPEG ~0.9; metros/pixel = `156543.03392·cos(lat)/2^z`.
- Projetos/.json antigos não mudam de comportamento; numeração, Estrutura, fichas, contadores e validação vêm só de `state.plantas`.
- Falha de rede/CDN → toast, e o envio de imagem própria continua funcionando.
- Textos da UI em pt-BR; código no estilo dos módulos vizinhos (comentários curtos em pt-BR).
- Rodar o harness: servidor estático Node na porta 8765 (já usado no projeto) + `chrome --headless=new --disable-gpu --window-size=1400,900 --dump-dom --virtual-time-budget=15000 http://localhost:8765/test-harness.html`; esperado: todas as linhas `PASS`, nenhuma `FAIL`/`ERRO`. Hoje: 168 PASS. Novos testes entram dentro do `try` do harness, antes de `}catch(err){`.

## Review Focus

1. Excluir o equipamento original (ou a planta inteira) com ele colocado numa vista → a referência some da vista, nada quebra (editor, export, PDF). Teste na Task 1 e Task 4.
2. Importar `.json` antigo (sem `aereas`) e `.json` novo com referências → accessors religados, `aereaAtiva` válido. Teste na Task 1.
3. Trocar o tipo/rótulo/altura do original → vista reflete (badge, ícone, legenda); mudar altura na vista grava no original. Teste na Task 1.
4. Contadores/numeração/Estrutura/fichas iguais antes e depois de criar vistas com referências. Teste na Task 2.
5. Clique na vista aérea sem ferramenta válida não cria pin "Outro" fantasma. Teste na Task 2.

---

### Task 1: Modelo de dados, referências, persistência e geometria do mapa

**Files:**
- Modify: `js/state.js`, `js/numeracao.js`, `js/persistence.js`
- Create: `js/aerea.js` (funções puras)
- Test: `test-harness.html`

**Interfaces (produz):**
- `state.js`: `state.aereas = []`, `state.aereaAtiva = null`; `novaAerea(nome)` → `{...novaPlanta(nome), aerea:true, selectedTipo:'nenhum'}`; getter `state.planta` → `aereas[aereaAtiva]` quando `aereaAtiva!==null` e existe, senão a planta ativa como hoje; `limparPlanta` passa a também `delete pl.fonte`.
- `js/aerea.js`:
  - `pinOriginal(id)` → `{pin, plantaIdx, pinIdx}` | `null` (busca em `state.plantas`).
  - `vincularRef(ref)` → define accessors não-enumeráveis/configuráveis `tipoId`, `label`, `qtd` (get só) e `altura` (get/set no original) no objeto ref; devolve ref. Idempotente.
  - `novaRef(pinId, x, y)` → `{id:novoId(), ref:pinId, x, y, direcao:<do original ou 0>}` já vinculado.
  - `limparRefsOrfas()` → em todas as vistas, remove pins com `ref` cujo original não existe; revincula os demais; devolve nº removido.
  - `refsColocadas(vista)` → `Set` de ids originais já colocados.
  - `metrosPorPixel(lat, z)` → número.
  - `escalaCaptura(larguraPx, mpp)` → `{a:{x:10,y:50}, b:{x:90,y:50}, metros: 0.8*larguraPx*mpp, metrosLargura: larguraPx*mpp}`.
  - `lerCoordenadas(str)` → `{lat, lng}` | `null` (aceita `-22.6029, -48.8031`, `-22,6029 -48,8031` não — só ponto decimal com vírgula ou espaço separando; lat ∈[-90,90], lng ∈[-180,180]).
  - `CREDITO_ESRI`, `TILE_URL`, `MAPA_ZOOM_MAX = 19`, `CAPTURA_MAX = 4096`.
- `numeracao.js`: `numeroDoPinEm(pl, pi)` → se `pl.pins[pi].ref`, número do original (`numeroDoPin` dos índices de `pinOriginal`, 0 se órfão); senão `numeroDoPin(state.plantas.indexOf(pl), pi)`.
- `persistence.js`: export inclui `aereas`/`aereaAtiva` (já sai pelo stringify); `normalizarProjeto`: `aereas` ausente → `[]`; cada vista recebe os mesmos defaults de planta + `aerea:true`; ids nos pins; `aereaAtiva` fora do intervalo/inválido → `null`; após `setState`/re-anexar alias, chamar `limparRefsOrfas()` (que revincula). `exportarProjeto` chama `limparRefsOrfas()` antes de serializar.

- [ ] **Step 1: Testes (falham)** — no harness:
  - `metrosPorPixel(0, 0)` ≈ 156543.03 (±0.01); `metrosPorPixel(-22.6, 19)` ≈ 0.2757 (±0.001).
  - `escalaCaptura(1000, 0.5)` → `metrosLargura===500 && metros===400`; e `metrosLarguraDe(e.a, e.b, e.metros, 1000, 600)` de `js/escala.js` ≈ 500.
  - `lerCoordenadas('-22.6029, -48.8031')` → lat -22.6029/lng -48.8031; `lerCoordenadas('Rua X 10')===null`; `lerCoordenadas('95, 10')===null`.
  - Ref: com uma planta de teste com pin `{id:'o1', tipoId:'bullet', label:'Portaria', qtd:2, altura:6}`, `r=novaRef('o1',10,10)` → `r.tipoId==='bullet' && r.label==='Portaria' && r.qtd===2 && r.altura===6`; `r.altura=9` → original `altura===9`; original `tipoId='dome'` → `r.tipoId==='dome'`; `JSON.stringify(r)` não contém `tipoId`/`label`.
  - `numeroDoPinEm(vista, i)` do ref == `numeroDoPin` do original.
  - Removendo o original e chamando `limparRefsOrfas()` → ref sai da vista, retorno 1.
  - `normalizarProjeto({plantas:[...]})` sem `aereas` → `aereas` `[]`, `aereaAtiva===null`; com `aereas:[{pins:[{id:'r1',ref:'o1',x:1,y:1}]}], aereaAtiva:5` → `aereaAtiva===null`, vista com `aerea===true`, `muros/areas/etiquetas/cercas` arrays.
  - Alias: `state.aereas=[novaAerea('V')]; state.aereaAtiva=0` → `state.planta===state.aereas[0]`; `aereaAtiva=null` → planta ativa; `Object.keys(state)` não contém `planta`. Restaurar o estado ao fim.
- [ ] **Step 2: Rodar harness** — novos FAIL/ERRO.
- [ ] **Step 3: Implementar** as interfaces acima.
- [ ] **Step 4: Rodar harness** — tudo PASS (168 antigos + novos).
- [ ] **Step 5: Commit** `Vista aérea: modelo de dados, referências a pins da planta, persistência e geometria do mapa`.

### Task 2: Editor — mini-abas, toolbar, referências na planta

**Files:**
- Modify: `js/tabs/planta.js`, `js/nav.js`, `js/main.js`, `css/style.css`
- Create: `js/tabs/aerea.js` (UI da vista; nesta task só templates/ações do editor, o mapa vem na Task 3)
- Test: `test-harness.html`

**Interfaces:**
- Consome Task 1 inteira.
- Produz em `js/tabs/aerea.js`: `selectAerea(i)`, `addAerea()`, `removeAerea(i)`, `tplEquipPlanta(pl)` (botão "Equipamentos da planta" + painel), `toggleMenuEquip()`, `selectRef(pinId)`, `criarRefNoClique(x, y)`, `removeRef(pi)`, `tplRefRow(p, pi)`; todos expostos no `window` via `main.js`.

Comportamento:
- [ ] **Step 1: Testes (falham)** — no harness (usar imagem canvas como nos testes de muro):
  - `addAerea()` → nova aba com texto contendo `🛰` e "Vista aérea 1"; `state.aereaAtiva===0`; `selectPlanta(0)` → `aereaAtiva===null`; botão "+ Vista aérea" presente.
  - Com vista ativa e imagem: menu Inserir só contém tipos `cenario` (e `muro`), nenhum `bullet`/`cerca`; painel "Equipamentos da planta" lista um botão por pin-equipamento das plantas, com o original já colocado `disabled`.
  - `selectRef('o1')` + `criarRefNoClique(30,40)` → vista ganha pin com `ref==='o1'`; badge `#pin-…` / linha da lista mostram o número do original; `selectedTipo` volta a `'nenhum'`.
  - Clique na imagem da vista com `selectedTipo==='nenhum'` → nenhum pin criado.
  - Linha do ref: sem `<select>` de tipo e sem campo qtd; com campo Altura quando a vista tem escala; `removeRef(i)` remove só da vista.
  - Contadores: `pontosPorTipo()`, `legendaResumo()` e `validarProposta()` idênticos antes/depois de criar a vista com ref.
  - Rolagem: `renderContent` não restaura scroll da planta ao trocar planta→vista (chave de render distinta).
- [ ] **Step 2: Rodar harness** — novos FAIL.
- [ ] **Step 3: Implementar**:
  - Mini-abas: plantas (ativa só se `aereaAtiva===null`), depois vistas `🛰 {nome}` (ativa se índice = `aereaAtiva`), depois `+ Nova planta` e `+ Vista aérea`. `selectPlanta`/`addPlanta` zeram `aereaAtiva`. Input de nome escreve em `state.planta.nome`; rótulo "Nome da vista" na vista; "Excluir vista" sempre visível na vista (`confirm` se tem conteúdo); excluir planta continua como hoje.
  - Em vista: título do bloco de upload "Imagem aérea" (Task 3 troca por mapa quando sem imagem); menu Inserir filtrado (`cenario` + `muro`; sem Cerca); ao lado o botão **Equipamentos da planta** (painel por clique como o Inserir, agrupado por `pontosPorTipo()`, item `ícone + Tipo N · {nome da planta}`, desabilitado se em `refsColocadas`).
  - Clique na imagem: se `pl.aerea` e `selectedTipo` começa com `ref:` → `criarRefNoClique`; se `pl.aerea` e `selectedTipo` não é ferramenta (`area/etiqueta/muro/escala`) nem tipo `cenario` → ignora.
  - Badge e coluna de número: `numeroDoPinEm(state.planta, pi)` (plantas e vistas).
  - Linha da lista: `p.ref` → `tplRefRow` (ícone, número, rótulo em texto, controles de direção/alcance/abertura/altura iguais aos da Bullet/Dome, `✕` = `removeRef`).
  - `tplPlanta` chama `limparRefsOrfas()` antes de montar.
  - `nav.js`: chave de render `state.aereaAtiva!==null ? 'a'+state.aereaAtiva : state.plantaAtiva`.
  - Upload de imagem/PDF numa vista com conteúdo pede `confirm('Trocar a imagem apaga o que está posicionado nesta vista (muros ficam). Continuar?')`.
- [ ] **Step 4: Rodar harness** — tudo PASS.
- [ ] **Step 5: Commit** `Vista aérea no editor: mini-abas, equipamentos da planta como referência, foco próprio`.

### Task 3: Mapa de satélite e captura

**Files:**
- Modify: `index.html` (Leaflet CSS+JS), `js/tabs/aerea.js`, `js/tabs/planta.js` (delegar), `css/style.css`
- Test: `test-harness.html` (só partes sem rede) + verificação manual com screenshot

**Interfaces:**
- Consome `metrosPorPixel`, `escalaCaptura`, `lerCoordenadas`, `TILE_URL`, `CREDITO_ESRI`, `MAPA_ZOOM_MAX`, `CAPTURA_MAX`, `limparPlanta`.
- Produz: `tplMapaAereo(pl)`, `montarMapa()` (chamado de `afterPlantaRender` quando `pl.aerea` e mostrando mapa), `buscarLocal()`, `capturarMapa()`, `trocarImagemAerea()`, `cancelarTrocaImagem()`; `montarCaptura(tiles, bounds, z)` pura o bastante para testar com imagens locais (recebe função `carregar(url)` injetável).

- [ ] **Step 1: Testes (falham)** — `montarCaptura` com `carregar` falso devolvendo canvases 256×256 coloridos: bounds 600×400 em z 18 → canvas 600×400, retorno `{dataURL, largura:600, altura:400, mpp}` com `mpp === metrosPorPixel(lat,18)`; bounds 5000×3000 → largura ≤4096 e `mpp` aumentado na mesma razão; todos os tiles falhando → rejeita/retorna `null`. Template: vista sem imagem com `window.L` ausente mostra aviso + botão "Enviar imagem própria"; com imagem mostra "Trocar imagem".
- [ ] **Step 2: Rodar harness** — FAIL.
- [ ] **Step 3: Implementar**:
  - Vista sem imagem (ou após "Trocar imagem"): no lugar de `#plantaScroll`, `#mapaAereo` (altura como a planta larga) com campo de busca + **Buscar**, lista de resultados (Nominatim, até 5) ou salto direto se `lerCoordenadas`, **Capturar**, **Enviar imagem própria** (o input de arquivo atual) e, em troca, **Cancelar**. Crédito `CREDITO_ESRI` visível no mapa (attribution do Leaflet).
  - Leaflet: `zoomSnap:1`, `maxZoom:19`; centro inicial = `pl.mapa` salvo ou Brasil (`-15.8, -47.9`, z 4). Mapa anterior destruído (`map.remove()`) a cada render. Sem `window.L` → toast "Mapa indisponível (sem conexão?). Envie uma imagem própria." e só o upload.
  - Captura: z = zoom atual; zc = `min(z+1, 19)`; bounds em pixels de mundo de `map.getPixelBounds()` × `2^(zc−z)`; desenhar tiles de zc; se maior que 4096 reduzir; `mpp` = `metrosPorPixel(lat do centro, zc)` × fator de redução. Ao concluir: `confirm` se vista tem conteúdo; `limparPlanta(pl)`; `pl.imagem`, `pl.escala = escalaCaptura(largura, mpp)`, `pl.fonte='mapa'`, `pl.mapa={lat,lng,zoom:z}`; `resetRolagem()`; toast "Imagem capturada com escala."
  - Falha de busca → toast "Busca indisponível. Cole as coordenadas (lat, long) do Google Maps."; tiles falhando → toast e nada muda.
- [ ] **Step 4: Rodar harness** — PASS. **Verificação manual:** servir local, abrir a vista, buscar "Lençóis Paulista", capturar, conferir screenshot (imagem nítida, chip `📏 Escala` presente, Bullet colocada com foco em metros).
- [ ] **Step 5: Commit** `Vista aérea: mapa de satélite (Esri) com busca e captura com escala`.

### Task 4: PDF

**Files:**
- Modify: `js/pdf.js`
- Test: `test-harness.html`

**Interfaces:** consome `numeroDoPinEm`, `limparRefsOrfas`, `CREDITO_ESRI`. Produz `legendaVista(pl)` → mesmo formato de `legendaResumo` (por tipo na ordem de `EQUIP_TYPES`, soma de `qtd`, cenário incluído, muros contados).

- [ ] **Step 1: Testes (falham)**:
  - `pageMapeamento(vista, dims, 'Mapeamento — Vista aérea 1', null)` contém o badge com o número do original e o ícone do tipo atual do original; contém `Imagens: Esri` quando `fonte==='mapa'` e não contém quando `fonte` ausente.
  - Legenda da vista conta só o que está na vista (ref de Bullet `qtd:2` → `02x — Bullet`), não a planta.
  - `gerarPDF` (ou a função que monta a lista de páginas, se extraída) inclui uma página por vista com imagem, depois das plantas; vista sem imagem não gera; página de Estrutura/legenda da Estrutura inalteradas.
- [ ] **Step 2: Rodar harness** — FAIL.
- [ ] **Step 3: Implementar**: em `pageMapeamento`, número via `numeroDoPinEm(pl, pi)`; legenda via `pl.aerea ? legendaVista(pl) : legendaResumo(li)`; crédito em fonte ~10px no canto inferior direito da imagem quando `pl.fonte==='mapa'`. Em `gerarPDF`, `limparRefsOrfas()` no início e páginas `Mapeamento — {nome}` das vistas com imagem após as das plantas (a 1ª planta sem conteúdo continua com o fallback atual).
- [ ] **Step 4: Rodar harness** — PASS; gerar PDF real com uma vista (script `real-pdf` existente adaptado) e conferir a página.
- [ ] **Step 5: Commit** `PDF: páginas de Mapeamento das vistas aéreas`.

### Task 5: Documentação

- [ ] Atualizar `CLAUDE.md`: aba 02 (vistas aéreas), modelo de dados (`aereas`, `aereaAtiva`, pin de referência + accessors, `fonte`, `mapa`), bibliotecas (Leaflet, Esri, Nominatim), PDF, arquivos (`js/aerea.js`, `js/tabs/aerea.js`), nº de asserções do harness, entrega 15, limitações (mapa depende de rede; resolução limitada pelo zoom 19; ref sem ficha própria).
- [ ] Commit `Docs: vista aérea no CLAUDE.md`.
