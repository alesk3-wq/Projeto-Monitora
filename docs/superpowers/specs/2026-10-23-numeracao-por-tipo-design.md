# Numeração por tipo de equipamento + Estrutura agrupada por tipo — Design

Data: 2026-10-23 · Contexto geral: `CLAUDE.md` (ler antes).

## Por quê
Hoje todos os pins compartilham uma numeração global contínua ("Ponto 1..N" atravessando tipos e plantas). Adicionar 3 câmeras e depois um leitor facial dá ao facial o número 4. O usuário (Luan) quer **uma contagem por tipo exato de equipamento** — as Bullet são 1, 2, 3; o primeiro Facial é 1 de novo — e, com isso, uma aba/página **Estrutura organizada por tipo**: uma linha de cabeçalho por tipo ("03x Câmera Bullet", com o ícone) e, embaixo, a lista dos pontos daquele tipo. Hoje a Estrutura gerada tem um item por pin, todos com "1" na quantidade e o "Ponto N" no fim do nome, o que fica confuso.

## Regras de numeração (decidido com o usuário)
- **Por tipo exato** (`tipoId`): `bullet`, `dome`, `ptz`, `lpr`, `acesso_veic`, `acesso_ped`, `fechadura`, `biometria`, `sensor_porta`, `outro` — cada um com sua sequência 1..n. Câmeras de tipos diferentes **não** compartilham numeração.
- **Contínua entre plantas**: a sequência de cada tipo percorre as plantas na ordem (`state.plantas[0]`, depois `[1]`…) e, dentro de cada planta, a ordem dos pins. Ex.: Térreo tem Bullet 1–3, Galpão continua Bullet 4–5.
- O número exibido é sempre só o número ("Ponto 2", badge "2"). Internamente o código identifica o ponto pelo par `tipoId` + número (ex. chave `bullet:2`; o usuário chamou isso de "B1, F1… escondido no código"). **Não aparece letra/prefixo para o usuário.**
- O que distingue dois "1" na planta é o ícone/cor do tipo (já são distintos).
- Excluir um pin ou trocar o tipo dele renumera os seguintes daquele tipo (mesmo comportamento de hoje, agora por tipo).

## Onde o número aparece (todos mudam para o número por tipo)
1. **Badge do pin no editor** (bolinha preta no ícone) e **número na lista de pins** da aba Planta.
2. **Badge do pin no Mapeamento do PDF.**
3. **Fichas de Equipamentos** (aba e PDF): título passa de "Equipamento N — Tipo" para **"{Tipo} — Ponto N"** (ex.: "Câmera Bullet — Ponto 2"); com várias plantas, o subtítulo com o nome da planta continua. *(chamada minha)*
   - **Ordem das fichas** passa a seguir a Estrutura: agrupadas por tipo (ordem de `EQUIP_TYPES`), e dentro do tipo pelo número. *(chamada minha — o relatório fica na mesma ordem da Estrutura)*
4. **Estrutura** (abaixo).

`pinOffsetGlobal` deixa de ser usado para numeração; substituir por um helper único (ex.: `numeroDoPin(plantaIdx, pinIdx)` / um mapa calculado de `state.plantas`) usado por todos os pontos acima — **uma fonte só** para o número.

## Estrutura: "Gerar a partir da planta"
Cria **um grupo por tipo de equipamento presente** (ordem de `EQUIP_TYPES`), cada um com:
- **Cabeçalho**: ícone do tipo + `NNx {label do tipo}` (ex.: `03x Câmera Bullet`, `02x Leitor Biométrico / Facial`). Quantidade com 2 dígitos, como no exemplo do usuário. A quantidade é a **soma de `qtd` dos pins** do tipo (cada pin tem `qtd` 1 por padrão, então em geral = número de pontos). *(chamada minha)*
- **Uma linha por ponto**, na ordem do número: `Ponto N — {rótulo do pin} — {descrição}`; com mais de uma planta: `{Nome da planta} — Ponto N — {rótulo} — {descrição}` (formato pedido pelo usuário: "Térreo — Ponto 1 — Câmera x"). Se o pin tiver `qtd ≥ 2`, a linha mostra `(2x)`. A descrição é editável por linha no app (começa vazia, como hoje).
- **Cercas/concertinas**: um grupo próprio `NNx Cerca / Concertina` com o ícone de cerca, uma linha por traçado (`Trecho N — {rótulo}`, prefixo da planta quando multi). *(chamada minha — cercas não são pins e não tinham número)*
- **Etiquetas** continuam fora da Estrutura.

### Estrutura sincronizada com a planta (proposta minha — aprovada pelo usuário)
Hoje "Gerar a partir da planta" **acrescenta** grupos novos a cada clique, e grupos antigos ficam com números desatualizados quando um pin é excluído (limitação documentada). Proposta: como os grupos gerados são **vivos** (ver abaixo), eles **sempre batem com a planta**; o botão "Gerar a partir da planta" cria a seção gerada uma vez (se já existir, só avisa/atualiza — nunca duplica) e as descrições digitadas ficam presas ao pin (`id`). Grupos criados à mão pelo usuário não são tocados. Assim o usuário pode posicionar, gerar, descrever, mexer na planta, e a Estrutura acompanha sem perder trabalho.

### Identidade estável do pin e grupos "vivos" *(chamadas minhas, após a checagem do builder)*
- Cada pin ganha um **`id` estável** (string única gerada na criação; pins de `.json` antigos recebem um no import/normalização). Item da Estrutura, descrição preservada e casamento com a ficha usam esse `id` — nunca posição nem texto. (Isso altera o formato do pin: um campo novo `id`; o resto igual.)
- Os grupos gerados são **vivos**: o cabeçalho (`NNx`, ícone, label do tipo) e as linhas (planta, número, rótulo do pin, `(2x)`) são **calculados da planta na hora** de renderizar a aba e o PDF. O que fica gravado no grupo gerado é só o que o usuário digita: a **descrição por `id` de pin**. Consequências: excluir/mover/trocar tipo/renomear um pin reflete na Estrutura sem gerar de novo; a descrição acompanha o pin (inclusive se ele trocar de tipo e mudar de grupo); descrição de pin excluído é descartada.
- Pin de tipo `outro`: o cabeçalho usa o label do tipo ("Outro"); o rótulo livre do pin aparece na linha.
- Cercas: "Trecho N" contínuo entre plantas; continuam sem ficha e sem número no editor.
- A reordenação das fichas por tipo é só de exibição/ordem no PDF; a ordem guardada em `pins` não muda.

### Grupos manuais
"+ Novo grupo" e "+ Item" continuam como hoje (título livre, itens qtd/nome/descrição), para grupos por função de segurança escritos à mão. Os grupos gerados têm a forma nova (cabeçalho com ícone + linhas por ponto); o builder decide se é um campo `tipoId` no grupo + `ref` nos itens ou outra marcação — requisito: o grupo gerado é reconhecível, e cada linha sabe a que pin se refere sem depender de regex no texto.

## PDF — página Estrutura
- Grupos gerados: cabeçalho com **ícone do tipo** (bolinha colorida com o SVG, como na legenda) + `03x Câmera Bullet` em negrito; abaixo, as linhas de ponto (`Ponto 1 — Portaria principal: descrição`), recuadas.
- Grupos manuais: como hoje.
- A legenda à direita ("Legenda — Equipamentos na Planta") continua.
- O prefixo `Nx` dos itens manuais segue a regra atual (só quando qtd ≥ 2).

## Ficha ↔ item da Estrutura
A legenda da ficha no PDF (nome + descrição do item correspondente, hoje via regex `Ponto N` em `itemDoPonto`) passa a casar pela **referência interna** do ponto (tipo + número/posição), não por texto. Sem item correspondente → sem legenda (como hoje).

## Compatibilidade com projetos salvos (.json antigos)
- Pins não mudam de formato; a numeração nova é calculada, então projetos antigos já abrem com os números por tipo.
- Grupos da Estrutura gerados no formato antigo ("Equipamentos Mapeados", itens "… — Ponto 7") ficam como **grupos manuais** (texto como está; os números antigos no texto ficam desatualizados). O usuário gera de novo para ter o formato novo e apaga os antigos. *(chamada minha — não vale migrar texto livre)*
- A ficha de projetos antigos perde a legenda casada por "Ponto N" até o usuário gerar de novo. *(consequência aceitável; anotar em Limitações)*

## Não-objetivos
- Sem prefixo/letra visível (B1, F1).
- Sem numeração por planta (é contínua).
- Não muda Mapeamento além do número do badge; não muda etiquetas, áreas, cercas no editor.

## Testes
Estender `test-harness.html` (39 asserções hoje; rodar como descrito no `CLAUDE.md`). Ajustar as asserções antigas que esperavam numeração global (ex.: "lista da planta 2 numera 4 e 5", "item da planta 2 usa Ponto 4", "Equipamento 4") para as regras novas. Cobrir: numeração por tipo numa planta; continuidade entre plantas; badge do editor = número da lista = título da ficha; geração cria um grupo por tipo com a quantidade certa e linhas com nome da planta quando multi; cercas em grupo próprio; gerar de novo substitui os gerados, preserva descrições e não toca grupos manuais; ficha casa com o item pela referência; `.json` antigo com grupos antigos abre sem erro.

## Deixado para o builder
- Nome/forma do helper de numeração e da marcação de grupo/linha gerados.
- Layout exato do grupo gerado na aba Estrutura do app (cabeçalho não editável com ícone + linhas com rótulo somente-leitura e input de descrição é o esperado).
- Atualizar `CLAUDE.md` no fim (numeração, Estrutura, fichas, limitações).
