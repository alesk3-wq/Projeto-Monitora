# Escala da planta + foco em metros + ponto cego pela altura da câmera

## Intenção

Hoje o foco das câmeras é um **símbolo de tamanho fixo na tela** (55px no editor, 72px no Mapeamento do PDF, 75px no recorte da ficha), multiplicado por `pin.alcance` (0.7–1.8). Ele não tem relação com o tamanho real do local: o zoom aumenta a planta e o foco continua do mesmo tamanho. Por isso o app não consegue mostrar o que o usuário pediu, a **faixa cega logo abaixo da câmera**:

- quanto mais alta a câmera, maior o ponto cego;
- foco mais curto (câmera inclinada para baixo) dá ponto cego menor;
- o ponto cego é cortado pelas paredes, como o foco já é.

O exemplo do usuário é uma câmera a ~18 m de altura, com faixa vermelha perto da câmera e o foco verde além dela.

Para isso, a planta precisa saber **quantos metros vale a imagem**. O usuário confirmou que as plantas recebidas têm medidas conhecidas, e aceitou marcar a escala uma vez por planta.

## Objetivos

1. **Escala por planta.** Ferramenta "📏 Escala": o usuário toca em dois pontos da planta e digita a distância real em metros.
2. **Foco em metros.** Com a planta em escala, o foco das câmeras passa a ter tamanho real: cresce com o zoom e sai proporcional no PDF e na ficha. O alcance de Bullet/Dome é arrastado em metros, com um limite bem maior que o de hoje (pedido do usuário: "arrastar o foco maior na distância").
3. **Altura por câmera** (Bullet/Dome), em metros.
4. **Ponto cego** desenhado em vermelho translúcido na parte do foco mais próxima da câmera, cortado pelos muros. Aparece no editor, no Mapeamento do PDF e no recorte da ficha.

## Não-objetivos

- Ponto cego de PTZ e LPR. A PTZ gira e olha para baixo; a LPR só tem direção, por decisão anterior do usuário.
- Muro com altura (câmera enxergando por cima do muro). Todo muro continua bloqueando, por decisão anterior.
- Metragem da cerca. Fica mais fácil depois disso, mas é outra entrega.
- Cobertura da planta inteira / áreas sem câmera.
- Inclinação (tilt) editável à mão. O tilt é deduzido do alcance (ver Cálculo).

## Anti-objetivos

- Projetos sem escala (todos os `.json` atuais) **não podem mudar de aparência**: sem escala, tudo continua exatamente como hoje (símbolo, `pin.alcance`, sem ponto cego).
- O ponto cego não pode aparecer "inventado" numa planta sem escala.

## Modelo de dados

- **`planta.escala`** (opcional): `{ a:{x,y}, b:{x,y}, metros, metrosLargura }`.
  - `a` e `b` são os pontos marcados, em % da imagem. `metros` é a distância digitada.
  - `metrosLargura` é quantos metros a largura inteira da imagem representa. Calcular com as dimensões naturais da imagem (`naturalWidth/Height`):
    `dist = hypot((bx-ax)/100*natW, (by-ay)/100*natH)`, `metrosLargura = metros * natW / dist`.
  - Em qualquer desenho com a imagem em `W` px de largura: `pxPorMetro = W / metrosLargura`. É isotrópico porque todo lugar desenha a imagem mantendo a proporção.
  - Trocar a imagem da planta (upload novo) **apaga** `escala`.
  - `.json` antigos: sem a chave, sem escala. Não precisa de migração; `normalizarProjeto` pode deixar ausente.
- **`pin.alcanceM`** (Bullet/Dome, opcional): alcance do foco em metros. Vale só quando a planta tem escala.
  - Limites: `ALCANCE_M_MIN = 2`, `ALCANCE_M_MAX = 150`.
  - Ausente: padrão **20 m**.
  - `pin.alcance` (o fator antigo) fica intocado, para o modo sem escala.
- **`pin.altura`** (Bullet/Dome, opcional): metros.
  - Limites: `ALTURA_MIN = 1`, `ALTURA_MAX = 40`.
  - Ausente: padrão **3 m**.
- **Alcance de PTZ e LPR com escala:** fixo e não editável (coerente com as decisões anteriores). PTZ = raio de **30 m**, LPR = **15 m**. *Chamada minha (builder pode ajustar os números).*

## Cálculo do ponto cego (função pura, testável)

Em `js/visao.js` (ou `utils.js`), a função `pontoCegoM(altura, alcanceM, aberturaTotalGraus)` retorna metros:

- **Abertura vertical**, deduzida da horizontal com imagem 16:9: `hfov = esq + dir`, `vfov = 2*atan(tan(hfov/2) * 9/16)`.
- **Mira:** a borda de cima da imagem vai até a ponta do foco, a `alcanceM`. Então `θtopo = atan(altura / alcanceM)`, medido abaixo da horizontal.
- **Borda de baixo:** `θbase = θtopo + vfov`.
- **Resultado:** se `θbase ≥ 90°`, o ponto cego é `0`. Senão, é `altura / tan(θbase)`, limitado a `alcanceM` (ou um pouco menos).

Conferência (abertura total de 50°):

| Altura | Alcance | Ponto cego |
|---|---|---|
| 18 m | 40 m | ≈ 13,3 m |
| 18 m | 20 m | ≈ 6,1 m |
| 3 m | 20 m | ≈ 3,9 m |

*Chamada minha:* imagem 16:9, porque é o padrão das câmeras IP atuais. Os testes usam esses valores (tolerância de ±0,2 m).

Comportamento esperado (pedido do usuário):

- subir a altura aumenta o ponto cego;
- encurtar o alcance diminui;
- abrir a lente diminui.

## Desenho

- **Região do ponto cego:** o setor da câmera (mesma direção e abertura esq/dir) de raio `pontoCego` (em px = metros × pxPorMetro), cortado pelos muros com `poligonoVisao`. Sem muro cortando, é um setor com arco.
- **Ordem e cor:** desenhado **por cima** do foco, com a mesma forma, em vermelho translúcido (`#E53935`, fill ~`55` hex, contorno sólido fino).
- **Onde aparece:** editor (`posicionarFoco` em `js/tabs/planta.js`, SVG; um segundo `<path>` no mesmo SVG do cone serve), Mapeamento do PDF (`coneMapeamento` em `js/pdf.js`, mesmo canvas) e recorte da ficha (`generateCropDataURL` em `js/tabs/equipamentos.js`).
- **Só aparece** com a planta em escala, para Bullet/Dome, e com valor > 0.

## Foco em metros (planta com escala)

Comprimento do foco em px, em cada lugar:

- **Editor:** `alcanceM * img.clientWidth / metrosLargura`. Acompanha zoom/pinch; o `ResizeObserver` que hoje só existe quando há muros passa a existir também quando há escala.
- **Mapeamento do PDF:** `alcanceM * rect.w / metrosLargura`, onde `rect` é o retângulo efetivo da imagem que `pageMapeamento` já calcula.
- **Ficha:** `alcanceM * (largura da imagem inteira em px do canvas) / metrosLargura`. A largura é `cw*dw/cropW`, já usada para os muros.

Regras de interação e tamanho:

- **Arraste do ponto do meio do arco** (Bullet/Dome): o arraste é **relativo**. O alcance novo é o alcance no início do arraste mais (distância atual − distância no início) / `pxPorMetro`, arredondado a 0,5 m e limitado a 2–150 m. Assim o alcance não salta ao pegar o ponto quando ele está na distância mínima. *Chamada minha.*
- **Distância mínima dos pontos:** os pontos de arraste continuam com distância mínima do ícone (44/40 px) mesmo quando o foco real é minúsculo. O desenho do foco segue o tamanho real.
- **Focos grandes:** um foco de 150 m numa planta pequena pode ficar enorme; o SVG/canvas tem `overflow:visible` e o PDF já corta pela página. O canvas do PDF deve ser **limitado ao retângulo da página**, para não estourar memória (ex.: limitar `S` a algo como 3000px).
- **Sem escala:** comportamento atual, sem nenhuma mudança.

## Interface

- **Ferramenta de escala:**
  - Botão **"📏 Escala"** na barra da planta, ao lado de Demarcar Área / Etiqueta.
  - Modo escala (`selectedTipo='escala'`): o 1º toque marca A, o 2º marca B. Aparece uma linha tracejada com as duas pontas, e uma barra flutuante (padrão das barras de cerca/muro) com o input "Distância real (m)" + **Confirmar** / **Cancelar**.
  - Confirmar com valor > 0 grava `escala` e mostra o toast "Escala definida".
  - Sair do modo (trocar ferramenta/aba) cancela uma marcação incompleta.
- **Indicador:** com escala definida, a barra da planta mostra um texto curto, ex. `Escala: 20 m (refazer · remover)`. Remover pede `confirm`.
- **A linha de escala** fica visível só com a ferramenta Escala ativa. Não sai no PDF.
- **Lista de pins** (Bullet/Dome) com escala:
  - O slider "Alcance %" vira "Alcance" em metros (2–150, passo 0,5, rótulo `20 m`).
  - Novo input numérico **"Altura (m)"** (1–40, passo 0,5).
  - Rótulo `Ponto cego: X m`, atualizado ao vivo. Mostra `0 m` quando não houver.
  - Sem escala, a altura não aparece. *Chamada minha:* mostrar a altura sem escala confundiria, porque não teria efeito.
- **Rótulo no editor** junto à câmera com escala (pequeno, como o do cctvplanner): `18 m · 40 m` (altura · alcance). *Chamada minha*; não sai no PDF.
- **Ficha (PDF e aba):** com escala, abaixo da legenda da Estrutura, uma linha `Altura: 18 m · Alcance: 40 m · Ponto cego: 10 m`. *Chamada minha.*

## Testes (test-harness.html)

1. `pontoCegoM`: monotonia (altura ↑ ⇒ ↑; alcance ↓ ⇒ ↓; abertura ↑ ⇒ ↓), valor 0 quando a base passa de 90°, limitado ao alcance.
2. **Escala:** `metrosLargura` calculado certo a partir de dois pontos e das dimensões naturais (imagem não quadrada).
3. **Editor com escala:** comprimento do foco proporcional ao zoom (100% vs 200% dobra); o ponto cego aparece (um 2º path); sem escala não aparece.
4. **PDF:** `coneMapeamento` com escala marca o ponto cego (atributo `data-cego` ou similar); sem escala, string idêntica à atual.
5. **Ficha:** a linha de altura/alcance/ponto cego aparece só com escala.
6. **Import de `.json` antigo:** sem escala, sem mudança.
7. **Trocar a imagem** apaga a escala.

Os testes atuais (129) devem continuar passando.

## Restrições do projeto (do CLAUDE.md)

- ES modules sem build.
- html2canvas não faz clip-path / object-fit / SVG inline confiável: no PDF, tudo em canvas → `<img>`.
- Posições em % da imagem; geometria em px.
- Atualizar o `CLAUDE.md` no fim.
- Commit direto na master, deploy com `firebase deploy --only hosting` (CLI global).

## Deixado para quem implementa

- Onde exatamente ficam as constantes e as funções (utils.js vs visao.js).
- Estilo visual exato da barra de escala e do rótulo.
- Arredondamentos.
- Como estruturar `posicionarFoco` para os dois modos.
