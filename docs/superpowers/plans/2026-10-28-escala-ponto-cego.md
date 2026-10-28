# Escala da planta + foco em metros + ponto cego — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each planta gets a scale (two points plus a distance in meters). On a scaled planta, camera foci are drawn at real size, and Bullet/Dome get a height (m) and a red blind spot near the camera, clipped by walls, in the editor, the PDF Mapeamento and the ficha crop.

**Architecture:** A new pure module `js/escala.js` owns the scale math and the blind-spot formula. A new editor module `js/tabs/escalaTool.js` owns the calibration tool, and `planta.js` delegates to it, as it does for areas, etiquetas and muros. The editor (`planta.js#posicionarFoco`), PDF (`pdf.js#coneMapeamento`) and ficha (`equipamentos.js#generateCropDataURL`) get the focus length in px from `escala.js`; without a scale they keep today's code path byte-for-byte.

**Tech Stack:** Vanilla ES modules (no build), html2canvas 1.4.1 (canvas → `<img>` in the PDF), headless Chrome harness `test-harness.html`.

**Spec:** `docs/superpowers/specs/2026-10-28-escala-ponto-cego-design.md`

## Global Constraints

- Without `planta.escala`, everything must look and behave exactly as today. Existing harness asserts stay green (129 → more).
- Values:
  - alcance: `ALCANCE_M_MIN = 2`, `ALCANCE_M_MAX = 150`, default **20 m**, drag rounding 0.5 m;
  - altura: `ALTURA_MIN = 1`, `ALTURA_MAX = 40`, default **3 m**, step 0.5;
  - fixed reach with scale: PTZ **30 m** radius, LPR **15 m**.
- Blind spot only for types with `ajustaAlcance` (Bullet/Dome), only with a scale, and only when the value is > 0.
- Blind spot colour `#E53935`: fill `#E5393555`, thin solid stroke.
- Image 16:9 for the vertical FOV: `vfov = 2*atan(tan(hfov/2)*9/16)`, `hfov = esq + dir`.
- PDF: no clip-path / object-fit / inline SVG; draw on canvas and emit `<img>`.
- Positions stay in % of the image; geometry is done in px.
- Text with user input goes through `escHtml`. UI copy is in pt-BR.
- Commits go directly on `master`, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Running the tests

- Static server: `node <scratchpad>/serve.js /c/sk8/SGP-Projetos/claudefiles 8765` (background). If missing, write a ~15-line `http.createServer` + `fs.readFile` server with MIME types for .html/.js/.css/.png/.jpg. `npx` does not work on this network.
- Run:
  ```bash
  timeout 90 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --user-data-dir="$SCRATCH/chrome-prof" --window-size=1400,900 --dump-dom --virtual-time-budget=20000 http://localhost:8765/test-harness.html > "$SCRATCH/out.html"
  grep -cE "^PASS ::" "$SCRATCH/out.html"; grep -E "^FAIL ::" "$SCRATCH/out.html"
  ```
- Expected: zero `FAIL` lines, and the PASS count goes up by this task's new asserts.
- New harness blocks go right **before** the line `assert('título de seção quebra linha` (inside the async section where `PD2`, `waitImg` and `near` already exist). Each block is wrapped in `{ … }` and restores any state it changes.

## Review Focus

1. **Coincident or near-identical calibration points** (distance < 1 natural px): refuse with the toast "Os dois pontos estão muito próximos." and save nothing. Test in Task 2.
2. **Distance typed with a comma** ("12,5"), empty, zero or negative: comma is accepted as a decimal; ≤ 0 or NaN gives the toast "Digite a distância em metros." and the bar stays open. Test in Task 2.
3. **Huge focus on a scaled planta** (150 m on a planta 40 m wide): the PDF canvas must not exceed the page. Clamp the drawn radius to `PDF_L_MAX = 1500` px. Test in Task 4.
4. **Multi-planta:** each planta uses its own `escala`. A pin on an unscaled planta stays the old symbol, even if another planta is scaled. Test in Task 4 (`coneMapeamento` gets ppm per planta).
5. **Image not yet decoded** (`clientWidth` 0) when the focus is positioned: `ppmEditor()` returns null and the code falls back to the old symbol; the `load` handler / ResizeObserver redraws. Covered by making the ResizeObserver also attach when `escala` exists (Task 3 test checks the zoom-doubling, which goes through the same path).

---

### Task 1: `js/escala.js`, the pure math

**Files:**
- Create: `js/escala.js`
- Test: `test-harness.html` (new block)

**Interfaces:**
- Produces (all exported from `js/escala.js`):
  - Constants: `ALCANCE_M_MIN=2, ALCANCE_M_MAX=150, ALCANCE_M_PADRAO=20, ALTURA_MIN=1, ALTURA_MAX=40, ALTURA_PADRAO=3, ALCANCE_FIXO_M={ptz:30, lpr:15}, COR_CEGO='#E53935'`.
  - `metrosLarguraDe(a:{x,y}, b:{x,y}, metros:number, natW:number, natH:number) → number|null`: null when the point distance is < 1 natural px or `metros` ≤ 0. Otherwise `metros*natW/dist`.
  - `temEscala(pl) → boolean`: true when `pl.escala?.metrosLargura > 0`.
  - `pxPorMetro(pl, W:number) → number|null`: `W / pl.escala.metrosLargura`; null without a scale or when `W` ≤ 0.
  - `alcanceMDe(pin) → number`:
    - ptz → 30; lpr → 15;
    - `ajustaAlcance` types → `pin.alcanceM` clamped to 2–150, default 20;
    - other types → 20.
  - `alturaDe(pin) → number`: `pin.altura` clamped to 1–40, default 3.
  - `pontoCegoM(altura:number, alcanceM:number, aberturaTotal:number) → number`: the spec formula, in meters, limited to `alcanceM`.
  - `cegoDoPin(pin) → number`: 0 unless `typeById(pin.tipoId).ajustaAlcance`. Otherwise `pontoCegoM(alturaDe(pin), alcanceMDe(pin), aberturaDe(pin).esq + aberturaDe(pin).dir)`.
  - `fmtM(v) → string`: one decimal at most, comma decimal, no trailing ",0", plus " m" (`13,3 m`, `20 m`).

- [ ] **Step 1: Write the failing tests** (new harness block, `const ES = await import('./js/escala.js')`):
  ```js
  assert('ponto cego: 18 m / 40 m / 50° ≈ 13,3', near(ES.pontoCegoM(18,40,50), 13.3, 0.2));
  assert('ponto cego: 18 m / 20 m ≈ 6,1', near(ES.pontoCegoM(18,20,50), 6.1, 0.2));
  assert('ponto cego: 3 m / 20 m ≈ 3,9', near(ES.pontoCegoM(3,20,50), 3.9, 0.2));
  assert('ponto cego cresce com a altura, cai com alcance menor e com lente mais aberta',
    ES.pontoCegoM(10,30,50) > ES.pontoCegoM(5,30,50) && ES.pontoCegoM(10,15,50) < ES.pontoCegoM(10,30,50) && ES.pontoCegoM(10,30,100) < ES.pontoCegoM(10,30,50));
  assert('ponto cego = 0 quando a base passa da vertical', ES.pontoCegoM(40,2,160)===0);
  assert('ponto cego nunca passa do alcance', ES.pontoCegoM(40,5,10) <= 5);
  // imagem 2000×1000: pontos em (10%,50%) e (60%,50%) = 1000 px naturais = 25 m → largura = 50 m
  assert('metrosLargura a partir de 2 pontos (imagem não quadrada)', near(ES.metrosLarguraDe({x:10,y:50},{x:60,y:50},25,2000,1000), 50, 0.01)
    && near(ES.metrosLarguraDe({x:10,y:10},{x:10,y:60},25,2000,1000), 100, 0.01));
  assert('metrosLargura: pontos coincidentes ou metros ≤ 0 → null', ES.metrosLarguraDe({x:5,y:5},{x:5,y:5},10,1000,1000)===null && ES.metrosLarguraDe({x:0,y:0},{x:50,y:0},0,1000,1000)===null);
  assert('alcance/altura padrão e limites', ES.alcanceMDe({tipoId:'bullet'})===20 && ES.alcanceMDe({tipoId:'dome',alcanceM:999})===150 && ES.alcanceMDe({tipoId:'ptz'})===30 && ES.alcanceMDe({tipoId:'lpr'})===15 && ES.alturaDe({})===3 && ES.alturaDe({altura:0.2})===1);
  assert('cegoDoPin: só Bullet/Dome', ES.cegoDoPin({tipoId:'ptz',altura:18})===0 && ES.cegoDoPin({tipoId:'bullet',altura:18,alcanceM:40,abEsq:25,abDir:25})>13);
  assert('pxPorMetro e fmtM', ES.pxPorMetro({escala:{metrosLargura:50}},1000)===20 && ES.pxPorMetro({},1000)===null && ES.fmtM(13.333)==='13,3 m' && ES.fmtM(20)==='20 m');
  ```
- [ ] **Step 2: Run the harness.** Expected: the new asserts error or FAIL (module missing).
- [ ] **Step 3: Implement `js/escala.js`** with the Interfaces above. It imports `typeById` and `aberturaDe` from `./utils.js`. Formula: `θtopo = atan(h/D)`, `θbase = θtopo + vfov`; if `θbase ≥ π/2` return 0; otherwise `min(D, h/tan(θbase))`.
- [ ] **Step 4: Run the harness.** Expected: all PASS.
- [ ] **Step 5: Commit** `Escala: módulo js/escala.js (escala da planta, alcance/altura em metros, cálculo do ponto cego)`.

### Task 2: scale tool in the editor

**Files:**
- Create: `js/tabs/escalaTool.js`
- Modify: `js/tabs/planta.js` (toolbar button, bar slot, click handler, `selectTipo`, `cancelarTraco`, `handlePlantaUpload` clears `escala`, render hook)
- Modify: `js/tabs/plantaPdf.js:37-42` (`applyPage` clears `escala`)
- Modify: `js/main.js` (expose the window functions)
- Modify: `css/style.css` (handle class, if needed)
- Test: `test-harness.html`

**Interfaces:**
- Consumes: `metrosLarguraDe`, `temEscala`, `fmtM` (Task 1).
- Produces (`js/tabs/escalaTool.js`):
  - `tplEscalaBar() → string`.
    - During marking: "Marque o 1º ponto" / "Marque o 2º ponto" / `<input id="escalaMetros" inputmode="decimal" placeholder="Distância real (m)">` + `✔ Confirmar` (`escalaConfirmar()`) + `✕ Cancelar` (`escalaCancelar()`).
    - With a scale and no marking in progress: `Escala: {fmtM(metros)}`, plus `Refazer` (restarts marking) and `Remover` (`escalaRemover()`, `confirm`).
  - `tplEscalaStatus() → string`: short chip on the zoom row when the planta has a scale: `📏 Escala: 20 m`. Empty string otherwise.
  - `escalaClique(x, y)`: the 1st click sets A, the 2nd sets B. While both exist, the bar shows the input; a 3rd click restarts from A.
  - `escalaConfirmar()`:
    - reads `#escalaMetros` (comma → dot) and uses `plantaImg.naturalWidth/Height`;
    - saves `state.planta.escala = {a, b, metros, metrosLargura}`, shows the toast "Escala definida." and re-renders;
    - **errors:** a value ≤ 0 or NaN gives the toast "Digite a distância em metros." and keeps the bar; `metrosLarguraDe` returning null gives the toast "Os dois pontos estão muito próximos." and resets the marking.
  - `escalaCancelar()`, `escalaRemover()`, `cancelarEscala()` (clears the in-progress marking; called from `cancelarTraco`).
  - `renderEscala(wrap)`: only while `selectedTipo==='escala'`. Draws an SVG `.escala-svg` (same viewBox technique as `muros.js`) with a dashed line A–B in `#0B7285`, plus two `.escala-ponto` dots. It shows the in-progress marking, or the saved `escala.a/b` when there is no marking.
- Toolbar: button `📏 Escala` (`selectTipo('escala')`), after Etiqueta. The click handler routes `selectedTipo==='escala'` to `escalaClique` **before** the generic pin creation.

- [ ] **Step 1: Write the failing tests** (set an image of 2000×1000 via canvas on `state.plantas[0]`, `switchTab('planta')`, `await waitImg()`; restore at the end):
  ```js
  window.selectTipo('escala'); await waitImg();
  assert('escala: botão na barra e barra própria', [...document.querySelectorAll('.toolbar-types .type-btn')].some(b=>b.textContent.includes('Escala')) && document.querySelector('.escala-bar'));
  EST.escalaClique(10,50); EST.escalaClique(60,50); await waitImg();
  document.getElementById('escalaMetros').value = '12,5'; EST.escalaConfirmar();
  assert('escala: vírgula decimal, metrosLargura gravado', pl0.escala && near(pl0.escala.metrosLargura, 25, 0.01) && pl0.escala.metros===12.5);
  // inválidos
  delete pl0.escala; EST.escalaClique(10,50); EST.escalaClique(60,50); await waitImg();
  document.getElementById('escalaMetros').value = 'abc'; EST.escalaConfirmar();
  assert('escala: valor inválido não grava e mantém a barra', !pl0.escala && document.getElementById('escalaMetros'));
  EST.escalaCancelar(); EST.escalaClique(20,20); EST.escalaClique(20,20); await waitImg();
  document.getElementById('escalaMetros').value = '10'; EST.escalaConfirmar();
  assert('escala: pontos coincidentes não gravam', !pl0.escala);
  assert('escala: clique com a ferramenta não cria pin', pl0.pins.length===nPinsAntes);
  ```
  Also assert that `window.handlePlantaUpload` (simulated by calling the same reset path, or by checking `applyPage` code via a direct state check) clears `escala`. Simplest: export a helper `limparPlanta(pl)` from `planta.js` used by both uploads, and assert `limparPlanta({escala:{metrosLargura:5},pins:[1]}).escala===undefined`.
- [ ] **Step 2: Run the harness.** Expected: the new asserts FAIL.
- [ ] **Step 3: Implement** `escalaTool.js` and the hooks:
  - `planta.js`: add `limparPlanta(pl)` (pins/cercas/areas/etiquetas = [], zoom = 100, `delete pl.escala`) and use it in `handlePlantaUpload` and in `plantaPdf.js#applyPage`. Keep the current behaviour for `muros` (not cleared today; don't change that).
  - `main.js`: expose `escalaConfirmar`, `escalaCancelar`, `escalaRemover`, `escalaRefazer`.
- [ ] **Step 4: Run the harness.** Expected: all PASS.
- [ ] **Step 5: Commit** `Escala da planta: ferramenta 📏 Escala (2 pontos + distância em metros), limpa ao trocar a imagem`.

### Task 3: editor, focus in meters + height + blind spot

**Files:**
- Modify: `js/tabs/planta.js` (`posicionarFoco`, rotate drag, `startRotateDrag`, pin-row template, `syncPinRowControls`, ResizeObserver condition, new live-update functions)
- Modify: `js/main.js` (expose `liveUpdateAlcanceM`, `liveUpdateAltura`)
- Test: `test-harness.html`

**Interfaces:**
- Consumes: Task 1 (`pxPorMetro`, `alcanceMDe`, `alturaDe`, `cegoDoPin`, `fmtM`, constants, `COR_CEGO`).
- Produces:
  - In the cone SVG of Bullet/Dome/LPR, a **second** `<path class="cego">` after the focus path, with fill `#E5393555` and stroke `#E53935`. `d` is empty when there is no blind spot.
  - `liveUpdateAlcanceM(pi, m)` and `liveUpdateAltura(pi, m)` exported from `planta.js` and exposed on `window`.
  - `ppmEditor() → number|null`: `pxPorMetro(state.planta, plantaImg.clientWidth)`.

Behaviour:

- [ ] **Focus length in `posicionarFoco`.** With `ppm` (non-null `ppmEditor()`), L = `alcanceMDe(pin)*ppm`; this covers the PTZ (30 m) and LPR (15 m) too. Without `ppm`, L stays as today (`PTZ_R` / `CONE_L0*alcanceDe`).
- [ ] **Blind-spot path.** Bullet/Dome only, when `ppm` and `cegoDoPin(pin) > 0`. R = `cegoDoPin(pin)*ppm`, same angles, clipped with `poligonoVisao(px,py,R,dir-ab.esq,dir+ab.dir,segs)`; without walls cutting it, `setorPath(c,c,R,dir,ab)`. Handles keep their current minimum distances (44/40 px).
- [ ] **Relative rotate/alcance drag with a scale.** `startRotateDrag` stores `dragState.d0` (pointer distance to the icon at start) and `dragState.m0 = alcanceMDe(pin)`. On move: `pin.alcanceM = clamp(round2(m0 + (d - d0)/ppm), 2, 150)`, where `round2` rounds to 0.5. Without a scale, the current absolute formula on `pin.alcance` stays unchanged.
- [ ] **Pin row**, for `ajustaAlcance` types with a scale:
  - replace the `Alcance %` slider with `id="alcslider-${pi}"` range 2–150 step 0.5 `oninput="liveUpdateAlcanceM(...)"` and label `alclabel-${pi}` → `fmtM`;
  - add `Altura (m)`: `<input type="number" id="altura-${pi}" min=1 max=40 step=0.5 style="width:60px">` with `oninput="liveUpdateAltura(...)"`;
  - add `<span id="cego-${pi}">Ponto cego: {fmtM}</span>`.
  
  `syncPinRowControls` keeps these in sync. Without a scale, the row is unchanged.
- [ ] **Label next to the camera**, Bullet/Dome with a scale only: `<div id="hlabel-${pi}" class="foco-rotulo">` showing `{fmtM(altura)} · {fmtM(alcance)}`. It sits 18px below the icon, font 10px, white background at 85% opacity, `pointer-events:none`, z 3. Repositioned in `updatePinDOM`.
- [ ] **ResizeObserver** attaches when the planta has walls **or** `temEscala(state.planta)`.

- [ ] **Step 1: Write the failing tests.**
  - Setup: image 400×400 canvas, `escala.metrosLargura = 40` (so 10 px/m at zoom 100 when the image is 400px wide; read the actual `plantaImg.clientWidth` and compute the expected value from it). Pins: one Bullet `{direcao:90, alcanceM:20, altura:18, abEsq:25, abDir:25}` and one PTZ.
  ```js
  const W1 = document.getElementById('plantaImg').clientWidth;
  const Lcone = ()=>parseFloat(document.getElementById('cone-0').getAttribute('width'));
  assert('escala: foco do Bullet com 20 m em px reais', near(Lcone(), 2*20*W1/40+4, 1));
  assert('escala: PTZ com raio fixo de 30 m', near(parseFloat(document.getElementById('cone-1').getAttribute('width')), 2*30*W1/40+4, 1));
  assert('ponto cego desenhado (path .cego com d)', (document.querySelector('#cone-0 path.cego')?.getAttribute('d')||'').length>5);
  window.zoomPlanta(100); await waitImg(); await frame();
  const W2 = document.getElementById('plantaImg').clientWidth;
  assert('escala: foco cresce com o zoom', near(Lcone(), 2*20*W2/40+4, 1) && W2 > W1*1.5);
  window.liveUpdateAltura(0, 3);
  assert('altura menor → ponto cego menor no rótulo', document.getElementById('cego-0').textContent.includes(ES.fmtM(ES.cegoDoPin(pl0.pins[0]))));
  delete pl0.escala; window.renderContent(); await waitImg();
  assert('sem escala: sem ponto cego, sem campo de altura, foco no tamanho antigo', !(document.querySelector('#cone-0 path.cego')?.getAttribute('d')) && !document.getElementById('altura-0') && near(Lcone(), 2*55+4, 1));
  ```
- [ ] **Step 2: Run the harness.** Expected: the new asserts FAIL.
- [ ] **Step 3: Implement** as described above.
- [ ] **Step 4: Run the harness.** Expected: all PASS, including the earlier aperture/wall editor asserts.
- [ ] **Step 5: Visual check.** Screenshot the editor with the `_scratch-ed.html` technique (copy of `index.html` plus an injected script that loads a planta with a scale, a wall, and a Bullet at 18 m / 40 m). Expected: red band near the camera, clipped by the wall; green focus beyond it; label `18 m · 40 m`.
- [ ] **Step 6: Commit** `Foco em metros na planta com escala + altura da câmera + ponto cego (Bullet/Dome) no editor`.

### Task 4: PDF Mapeamento + ficha

**Files:**
- Modify: `js/pdf.js` (`coneMapeamento`, `pageMapeamento`, `pageEquipamento` + its caller at ~line 512)
- Modify: `js/tabs/equipamentos.js` (`generateCropDataURL`; the Fichas tab card gets the same info line)
- Test: `test-harness.html`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `coneMapeamento(p, t, left, top, segs=[], ppm=null)`.
    - With `ppm`: L = `min(alcanceMDe(p)*ppm, PDF_L_MAX)` with `PDF_L_MAX = 1500`. For Bullet/Dome with `cegoDoPin(p) > 0`, the blind region is drawn on the same canvas after the focus (fill `#E5393555`, stroke `#E53935`, clipped by `segs`), and the `<img>` gets `data-cego="{metros.toFixed(1)}"`.
    - Without `ppm`: output identical to today.
  - `pageMapeamento` passes `ppm = pxPorMetro(pl, rect.w)`.
  - `infoFocoHtml(pin, pl) → string` (exported from `pdf.js`). With a scale and Bullet/Dome, it returns a line `Altura: 18 m · Alcance: 40 m · Ponto cego: 13,3 m` (15px, color `#33415A`); otherwise `''`.
  - `pageEquipamento(pin, numero, cropUrl, pl=null)` appends `infoFocoHtml(pin, pl)` after `legendaItem`; `gerarPDF` passes the planta of each pin.
  - `generateCropDataURL`: with a scale, `ppmC = (cw*dw/cropW)/pl.escala.metrosLargura`. Then focus R = `alcanceMDe(pin)*ppmC` (instead of `75*alc`), and the blind region of R = `cegoDoPin(pin)*ppmC` is drawn after the focus, same colours, clipped by `segs`. Without a scale it stays unchanged.

- [ ] **Step 1: Write the failing tests:**
  ```js
  const tb = U3.typeById('bullet');
  const pB = {tipoId:'bullet', direcao:90, alcanceM:40, altura:18, abEsq:25, abDir:25};
  const semEsc = PD2.coneMapeamento(pB, tb, 500, 400, []);
  assert('PDF sem escala: cone igual ao de hoje (sem data-cego)', !semEsc.includes('data-cego') && semEsc.includes('data-cone="72.0|'));
  const comEsc = PD2.coneMapeamento(pB, tb, 500, 400, [], 10);
  assert('PDF com escala: alcance em px reais + ponto cego', comEsc.includes('data-cone="400.0|') && /data-cego="13\.\d"/.test(comEsc));
  assert('PDF: foco gigante limitado (canvas não estoura)', PD2.coneMapeamento({...pB, alcanceM:150}, tb, 500, 400, [], 50).includes('data-cone="1500.0|'));
  assert('PDF: PTZ com escala = 30 m, sem ponto cego', (()=>{ const s = PD2.coneMapeamento({tipoId:'ptz'}, U3.typeById('ptz'), 500, 400, [], 10); return s.includes('data-cone="300.0|') && !s.includes('data-cego'); })());
  assert('ficha: linha de altura/alcance/ponto cego só com escala', PD2.infoFocoHtml(pB, {escala:{metrosLargura:50}}).includes('Ponto cego: 13,3 m') && PD2.infoFocoHtml(pB, {})==='' && PD2.infoFocoHtml({tipoId:'ptz'}, {escala:{metrosLargura:50}})==='');
  ```
  Multi-planta check: build a page with `pageMapeamento` for one scaled and one unscaled planta (as the existing PDF asserts do with `gerarPDF` pieces), or assert directly that `pageMapeamento` uses `pxPorMetro(pl, …)` of **its own** planta. Preferred: export `pageMapeamento` (if not already) and assert that the unscaled planta's HTML has no `data-cego`, while the scaled one has it.
- [ ] **Step 2: Run the harness.** Expected: the new asserts FAIL.
- [ ] **Step 3: Implement** as described above.
- [ ] **Step 4: Run the harness.** Expected: all PASS.
- [ ] **Step 5: Visual check.** Render the real PDF pages with the `real-pdf-*.sh` technique (scaled planta with a wall and a Bullet at 18 m / 40 m). Expected: the Mapeamento and the ficha crop show the red band clipped by the wall, and the ficha shows the info line.
- [ ] **Step 6: Commit** `PDF: foco em metros e ponto cego no Mapeamento e no recorte da ficha; linha Altura/Alcance/Ponto cego na ficha`.

### Task 5: docs + deploy

**Files:**
- Modify: `CLAUDE.md`. Cover the data model (`escala`, `alcanceM`, `altura`), the scale tool, the focus in meters, the blind spot in the editor/PDF/ficha, `js/escala.js` and `js/tabs/escalaTool.js` in the file list, a delivery 14 entry, the new assert count, and the "Próximos passos" list (remove "metragem com calibração" as *partially* done: the scale now exists, but cerca metragem is still open).
- Delete: the spec and this plan (the project rule removes executed specs/plans).

- [ ] **Step 1:** Update `CLAUDE.md`. Run the harness once more. Expected: all PASS.
- [ ] **Step 2:** Delete the spec and the plan, then commit `Docs: escala + ponto cego no CLAUDE.md`.
- [ ] **Step 3:** `git push origin master` and `firebase deploy --only hosting` (global CLI). Expected: "Deploy complete!".
