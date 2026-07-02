# Design — Suporte a touch/tablet no posicionamento da planta

**Data:** 2026-07-02
**Projeto:** Gerador de Propostas de Segurança Eletrônica (Bracell) — `claudefiles/index.html`
**Sub-projeto de:** lista "Próximos passos possíveis" do `CLAUDE.md` (item 1 de 5)

## Problema

A aba "03 · Planta / Mapeamento" só funciona com mouse: posicionar, arrastar e girar pins usa `mousedown/mousemove/mouseup`, sem equivalente para touch. Além disso, o layout não tem nenhum `@media` query — sidebar fixa de 230px + conteúdo com `max-width:1000px` — o que provavelmente gera aperto/scroll horizontal indesejado em tablet (ex: iPad portrait, 768–834px).

## Escopo

**Dentro do escopo:**
- Tocar na planta para posicionar um pin novo
- Arrastar o ícone do pin com o dedo para reposicionar
- Arrastar a alça de rotação (só tipos `cameraLike`) com o dedo para girar a direção
- Aumentar o tamanho dos alvos de toque (pin e alça de rotação)
- Layout responsivo básico em tablet: sidebar vira barra horizontal, conteúdo ocupa largura toda, formulários em coluna única em telas estreitas

**Fora do escopo:**
- Pinch-to-zoom com dois dedos na planta (zoom continua só pelos botões ➖/➕ existentes, 60–400%)
- Redesenho geral da UI para celular/telas muito pequenas
- Menu hambúrguer colapsável (decidido: sidebar horizontal simples, não colapsável)
- Suporte a multi-touch simultâneo (dois pins arrastados ao mesmo tempo por dois dedos)

## Design

### 1. Pointer Events API substitui Mouse Events

Os handlers de drag (`startPinDrag`, `startRotateDrag`, `onPointerDrag`, `endPointerDrag`, hoje em `index.html` linhas ~346–415) passam a escutar `pointerdown/pointermove/pointerup` em vez de `mousedown/mousemove/mouseup`. A lógica interna (cálculo de `x`/`y` em %, `atan2` para o ângulo) não muda — só o tipo de evento escutado, porque `PointerEvent` já carrega `clientX`/`clientY` igual a `MouseEvent`.

CSS `touch-action: none` é adicionado inline nos elementos arrastáveis (`#pinicon-N`, `#rothandle-N`), para o navegador não tentar rolar a página enquanto o dedo arrasta um pin. O container `#plantaScroll` mantém `touch-action` padrão (auto), então continua rolável normalmente fora dos pins.

O clique para **posicionar** pin novo (tocar em área vazia da imagem) não muda — continua no listener `img.onclick`, que dispara nativamente em touch. A lógica de `suppressNextClick` (evita criar pin sem querer logo após soltar um arraste) é mantida sem alteração.

### 2. Tamanho dos alvos de toque

- Ícone do pin: `30px` → `36px` (largura/altura, `pin.style.cssText` em `afterPlantaRender`)
- Alça de rotação: `16px` → `20px`
- Raio de posicionamento da alça (`R` em `afterPlantaRender` e `updatePinDOM`): `55` → `58`, para manter a proporção visual com a alça maior

Vale para mouse e touch igualmente (sem tamanho condicional por tipo de dispositivo).

### 3. Layout responsivo — breakpoint único em `max-width: 1024px`

- `#app` muda de `flex-direction: row` (padrão) para `column`
- `#sidebar` deixa de ter `width:230px; height:100vh; position:sticky` e vira uma barra horizontal (`width:100%`, `height:auto`, sem sticky), com os `.navbtn` em `flex-direction:row` e `overflow-x:auto` caso não caibam todos
- `#content` perde o `max-width:1000px` (ocupa 100% da largura disponível) e reduz padding de `36px 44px` para `20px 18px`
- Breakpoint adicional em `max-width: 640px`: `.row` muda de `flex-direction:row` para `column` (blocos de formulário empilham em vez de espremer lado a lado)

## Arquivos afetados

- `claudefiles/index.html` — único arquivo alterado (CSS no `<style>` do topo + funções JS de drag na seção da planta)

## Verificação

Como é uma ferramenta client-side sem testes automatizados, a verificação é manual:
- Abrir `index.html` num navegador desktop, confirmar que arrastar/girar pin com mouse continua funcionando igual a antes (regressão)
- Emular um viewport de tablet (DevTools, ex: iPad 820×1180) e testar: tocar pra posicionar pin, arrastar pin, arrastar alça de rotação, rolar a planta com zoom >100%, conferir que sidebar virou barra horizontal e formulários empilham
- Se possível, testar num tablet físico ou emulador Android/iOS

## Riscos conhecidos

- Sem acesso a um tablet físico nesta sessão — a verificação principal será por emulação de DevTools; comportamento real de touch (pressão, latência) pode diferir sutilmente
- `touch-action:none` em navegadores muito antigos pode não ser respeitado, mas está fora do escopo suportar navegadores desatualizados nessa ferramenta interna
