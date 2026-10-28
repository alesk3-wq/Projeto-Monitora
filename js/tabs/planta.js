import { state, novaPlanta, limparPlanta } from '../state.js';
import { numeroDoPin } from '../numeracao.js';
import { EQUIP_TYPES, ICONS, CATEGORIAS_INSERIR } from '../constants.js';
import { typeById, fileToDataURL, showToast, novoId, alcanceDe, ALCANCE_MIN, ALCANCE_MAX, aberturaDe, fixarAbertura, setorPath, pontoNaDirecao, ABERTURA_MIN, ABERTURA_MAX } from '../utils.js';
import { renderContent, resetRolagem } from '../nav.js';
import { tplAreaPalette, tplAreaRows, renderAreas, startAreaDraw, areaDragAtivo, cancelAreaDraw } from './areas.js';
import { isPdfFile, handlePlantaPdfUpload } from './plantaPdf.js';
import { novaEtiqueta, tplEtiquetaRows, renderEtiquetas, etiquetaDragAtivo, etiquetaSuprimeClique, encaixarEtiqueta, ETQ_COR } from './etiquetas.js';
import { tplMuroBar, tplMuroRows, renderMuros, muroClique, muroDragAtivo, cancelarTracoMuro } from './muros.js';
import { tplEscalaBar, tplEscalaStatus, escalaClique, renderEscala, cancelarEscala } from './escalaTool.js';
import { segmentosMuros, poligonoVisao, poligonoPath, geomNoMuro, encaixarNoMuro, ABERTURAS_MURO } from '../visao.js';

export function tplPlanta(){
  const pl = state.planta;
  return `
    <h1 class="pagetitle">02 · Planta / Mapeamento</h1>
    <p class="pagesub">Envie a planta baixa, escolha o tipo de equipamento e clique para posicionar. Depois é só arrastar o ícone para reposicionar, e (para câmeras) arrastar o ponto branco ao redor dele para girar a direção de visualização (em Bullet e Dome, afastar ou aproximar o ponto do ícone aumenta ou encurta o alcance do foco, e os pontos nas bordas do arco abrem ou fecham cada lado do foco).</p>
    <div class="card">
      <div class="planta-tabs">
        ${state.plantas.map((pt,i)=>`
          <button class="planta-tab ${i===state.plantaAtiva?'active':''}" onclick="selectPlanta(${i})">${pt.nome||('Planta '+(i+1))}</button>`).join('')}
        <button class="planta-tab add" onclick="addPlanta()">+ Nova planta</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <label style="margin:0;">Nome da planta</label>
        <input type="text" style="width:220px;margin:0;" value="${pl.nome||''}" oninput="state.plantas[${state.plantaAtiva}].nome=this.value" onchange="renderContent()">
        ${state.plantas.length>1 ? `<button class="btn danger small" onclick="removePlanta(${state.plantaAtiva})">Excluir planta</button>` : ''}
      </div>
      <label>Planta baixa (imagem ou PDF)</label>
      <input type="file" accept="image/*,application/pdf,.pdf" onchange="handlePlantaUpload(event)" style="margin-bottom:4px;">
      <div class="hint">PDF com mais de uma página: você escolhe qual usar.</div>
      <div class="toolbar-types">
        ${tplMenuInserir(pl)}
        <button class="type-btn ${pl.selectedTipo==='area'?'active':''}" onclick="selectTipo('area')">
          <span class="icon-dot" style="background:#5A6B82">▧</span>Demarcar Área
        </button>
        <button class="type-btn ${pl.selectedTipo==='etiqueta'?'active':''}" onclick="selectTipo('etiqueta')">
          <span class="icon-dot" style="background:${ETQ_COR}">🏷</span>Etiqueta
        </button>
        <button class="type-btn ${pl.selectedTipo==='escala'?'active':''}" onclick="selectTipo('escala')">
          <span class="icon-dot" style="background:#0B7285">📏</span>Escala
        </button>
      </div>
      ${pl.imagem ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <button class="btn ghost small" onclick="zoomPlanta(-20)">➖ Zoom</button>
        <span id="zoomLabel" style="font-size:13px;font-weight:700;min-width:44px;text-align:center;">${pl.zoom||100}%</span>
        <button class="btn ghost small" onclick="zoomPlanta(20)">➕ Zoom</button>
        <button class="btn ghost small" onclick="resetZoom()">Resetar</button>
        ${tplEscalaStatus()}
        <span class="hint" style="margin:0;">Dê zoom para posicionar com mais precisão; role a área para navegar.</span>
      </div>` : ''}
      ${pl.selectedTipo==='cerca' && pl.imagem ? `
      <div class="cerca-bar">
        <b>Traçado de cerca:</b>
        <span>${tracoAtual ? tracoAtual.length : 0} ponto(s)</span>
        <button class="btn ghost small" onclick="cercaDesfazer()">↩ Desfazer último</button>
        <button class="btn primary small" onclick="cercaConcluir()">✔ Concluir</button>
        <button class="btn danger small" onclick="cercaCancelar()">✕ Cancelar</button>
        <span class="hint" style="margin:0;">Toque na planta para adicionar pontos (mín. 2). Concluir com menos de 2 descarta.</span>
      </div>` : ''}
      ${pl.selectedTipo==='muro' && pl.imagem ? tplMuroBar() : ''}
      ${pl.selectedTipo==='escala' && pl.imagem ? tplEscalaBar() : ''}
      ${pl.selectedTipo==='area' && pl.imagem ? tplAreaPalette() : ''}
      <div id="plantaScroll" class="${pl.selectedTipo==='area' ? 'modo-area' : ''}">
        ${pl.imagem
          ? `<div id="plantaWrap" style="position:relative;width:${pl.zoom||100}%;">
               <img id="plantaImg" src="${pl.imagem}">
             </div>`
          : `<div class="empty-hint">Envie uma imagem da planta baixa para começar a posicionar os equipamentos.</div>`}
      </div>
      <div class="pinlist">
        ${(pl.pins.length===0 && pl.cercas.length===0 && pl.areas.length===0 && pl.etiquetas.length===0 && !(pl.muros||[]).length) ? `<div class="hint">Nenhum equipamento posicionado ainda.</div>` : pl.pins.map((p,pi)=>`
          <div class="pinrow">
            <span class="icon-dot" style="background:${typeById(p.tipoId).color}">${ICONS[p.tipoId]}</span>
            <b style="font-size:12px;color:var(--text-mid);width:18px;">${typeById(p.tipoId).cenario ? '' : numeroDoPin(state.plantaAtiva, pi)}</b>
            <select onchange="state.planta.pins[${pi}].tipoId=this.value; renderContent();">
              ${CATEGORIAS_INSERIR.map(c=>{
                const ops = c.tipos.filter(id=>(id!=='cerca' && id!=='muro') || p.tipoId===id);
                return ops.length ? `<optgroup label="${c.label}">${ops.map(id=>`<option value="${id}" ${id===p.tipoId?'selected':''}>${typeById(id).label}</option>`).join('')}</optgroup>` : '';
              }).join('')}
            </select>
            <input type="text" style="flex:1;min-width:140px;" placeholder="Rótulo (ex: Monitoramento bombas/Pit)" value="${p.label}" oninput="state.planta.pins[${pi}].label=this.value">
            <input type="number" min="1" style="width:60px" value="${p.qtd}" oninput="state.planta.pins[${pi}].qtd=this.value">
            ${typeById(p.tipoId).cameraLike && !typeById(p.tipoId).foco360 ? `<span style="font-size:11px;color:var(--text-mid);">Direção</span><input id="dirslider-${pi}" type="range" min="0" max="359" value="${p.direcao||0}" style="width:80px;margin-bottom:0;" oninput="liveUpdateCone(${pi}, this.value)"><span id="deglabel-${pi}" style="font-size:11px;color:var(--text-mid);width:32px;">${p.direcao||0}°</span>` : ''}
            ${typeById(p.tipoId).ajustaAlcance ? `<span style="font-size:11px;color:var(--text-mid);">Alcance</span><input id="alcslider-${pi}" type="range" min="${ALCANCE_MIN*100}" max="${ALCANCE_MAX*100}" value="${Math.round(alcanceDe(p)*100)}" style="width:80px;margin-bottom:0;" oninput="liveUpdateAlcance(${pi}, this.value)"><span id="alclabel-${pi}" style="font-size:11px;color:var(--text-mid);width:36px;">${Math.round(alcanceDe(p)*100)}%</span>${tplAberturaControles(p, pi)}` : ''}
            <button class="btn danger small" onclick="removePin(${pi})">✕</button>
          </div>
        `).join('')}
        ${pl.cercas.map((c,ci)=>`
          <div class="pinrow">
            <span class="icon-dot" style="background:#EB5757">${ICONS.cerca}</span>
            <b style="font-size:12px;color:var(--text-mid);width:24px;">C${ci+1}</b>
            <input type="text" style="flex:1;min-width:140px;" placeholder="Rótulo (ex: Perímetro norte)" value="${c.label}" oninput="state.planta.cercas[${ci}].label=this.value">
            <span style="font-size:11px;color:var(--text-mid);">${c.pontos.length} pontos</span>
            <button class="btn danger small" onclick="removeCerca(${ci})">✕</button>
          </div>`).join('')}
        ${tplMuroRows()}
        ${tplAreaRows()}
        ${tplEtiquetaRows()}
      </div>
    </div>
  `;
}

let dragState = null;
let suppressNextClick = false;
let pinch = null;
let tracoAtual = null; // [{x,y},...] durante o desenho de uma cerca; null = sem traçado

export function cancelarTraco(){ tracoAtual = null; cancelarTracoMuro(); cancelarEscala(); }
export function selectPlanta(i){
  if(i===state.plantaAtiva) return;
  cancelarTraco();
  state.plantaAtiva = i;
  renderContent();
}
export function addPlanta(){
  cancelarTraco();
  state.plantas.push(novaPlanta('Planta '+(state.plantas.length+1)));
  state.plantaAtiva = state.plantas.length-1;
  renderContent();
}
export function removePlanta(i){
  const pt = state.plantas[i];
  if(!pt) return;
  const temConteudo = pt.imagem || pt.pins.length || pt.cercas.length || pt.areas.length || pt.etiquetas.length || (pt.muros||[]).length;
  if(temConteudo && !confirm(`Excluir a planta "${pt.nome||('Planta '+(i+1))}" e tudo que está nela?`)) return;
  cancelarTraco();
  state.plantas.splice(i,1);
  if(state.plantas.length===0) state.plantas.push(novaPlanta('Planta 1'));
  if(i < state.plantaAtiva) state.plantaAtiva--;
  state.plantaAtiva = Math.max(0, Math.min(state.plantaAtiva, state.plantas.length-1));
  renderContent();
}
// Menu "Inserir": botão que abre um painel com os tipos agrupados por categoria (CATEGORIAS_INSERIR).
// Painel por clique (não por hover) para funcionar no toque; fecha ao escolher ou ao tocar fora.
function tplMenuInserir(pl){
  const sel = EQUIP_TYPES.find(t=>t.id===pl.selectedTipo);
  return `
    <div class="inserir-wrap">
      <button class="type-btn inserir-btn" onclick="toggleMenuInserir()">＋ Inserir ▾</button>
      <div id="menuInserir" class="inserir-menu">
        ${CATEGORIAS_INSERIR.map(c=>`
          <div class="inserir-sec">
            <div class="inserir-titulo">${c.label}</div>
            <div class="inserir-itens">
              ${c.tipos.map(id=>{ const t = typeById(id); return `
                <button class="type-btn ${pl.selectedTipo===id?'active':''}" onclick="selectTipo('${id}')">
                  <span class="icon-dot" style="background:${t.color}">${ICONS[id]}</span>${t.label}
                </button>`; }).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>
    ${sel ? `<span class="type-btn active inserir-atual" onclick="toggleMenuInserir()" title="Item selecionado — clique na planta para posicionar"><span class="icon-dot" style="background:${sel.color}">${ICONS[sel.id]}</span>${sel.label}</span>` : ''}`;
}
export function toggleMenuInserir(){
  document.getElementById('menuInserir')?.classList.toggle('open');
}
document.addEventListener('pointerdown', e=>{
  const m = document.getElementById('menuInserir');
  if(m && m.classList.contains('open') && !e.target.closest('.inserir-wrap, .inserir-atual')) m.classList.remove('open');
});
export function selectTipo(id){
  if(state.planta.selectedTipo==='cerca' && id!=='cerca') tracoAtual = null;
  if(state.planta.selectedTipo==='muro' && id!=='muro') cancelarTracoMuro();
  if(state.planta.selectedTipo==='escala' && id!=='escala') cancelarEscala();
  state.planta.selectedTipo = id;
  renderContent();
}
export function cercaDesfazer(){
  if(tracoAtual && tracoAtual.length) tracoAtual.pop();
  renderContent();
}
export function cercaConcluir(){
  if(!tracoAtual || tracoAtual.length<2){ tracoAtual = null; renderContent(); return; }
  state.planta.cercas.push({id:novoId(), label:'Cerca / Concertina', pontos:tracoAtual});
  tracoAtual = null;
  showToast('Traçado de cerca adicionado.');
  renderContent();
}
export function cercaCancelar(){ tracoAtual = null; renderContent(); }
export function removeCerca(ci){ state.planta.cercas.splice(ci,1); renderContent(); }

function touchDist(e){
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.hypot(dx, dy);
}

function attachPinchZoom(){
  const scroll = document.getElementById('plantaScroll');
  const wrap = document.getElementById('plantaWrap');
  if(!scroll || !wrap) return;
  scroll.addEventListener('touchstart', (e)=>{
    if(e.touches.length===2) cancelAreaDraw();
    if(dragState || areaDragAtivo() || etiquetaDragAtivo()) return;
    if(e.touches.length===2){
      pinch = {
        dist: touchDist(e) || 1,
        zoom: state.planta.zoom||100,
        midX: (e.touches[0].clientX+e.touches[1].clientX)/2,
        midY: (e.touches[0].clientY+e.touches[1].clientY)/2,
      };
    }
  }, {passive:false});
  scroll.addEventListener('touchmove', (e)=>{
    if(e.touches.length===2 && pinch){
      e.preventDefault(); // impede o zoom de página do navegador
      const z = Math.min(400, Math.max(60, pinch.zoom * (touchDist(e)/pinch.dist)));
      // âncora: mantém o ponto da planta sob o centro do gesto
      const r = scroll.getBoundingClientRect();
      const fx = (scroll.scrollLeft + pinch.midX - r.left) / wrap.offsetWidth;
      const fy = (scroll.scrollTop + pinch.midY - r.top) / wrap.offsetHeight;
      wrap.style.width = z + '%';
      scroll.scrollLeft = fx*wrap.offsetWidth - (pinch.midX - r.left);
      scroll.scrollTop  = fy*wrap.offsetHeight - (pinch.midY - r.top);
      state.planta.zoom = Math.round(z);
      const lbl = document.getElementById('zoomLabel');
      if(lbl) lbl.textContent = Math.round(z)+'%';
    }
  }, {passive:false});
  scroll.addEventListener('touchend', (e)=>{
    if(e.touches.length<2) pinch = null;
  });
  scroll.addEventListener('touchcancel', ()=>{ pinch = null; });
}

function cercaSegmentDiv(a, b, wrapW, wrapH){
  const dx = (b.x-a.x)/100*wrapW, dy = (b.y-a.y)/100*wrapH;
  const lenPct = Math.hypot(dx, dy)/wrapW*100;
  const ang = Math.atan2(dy, dx)*180/Math.PI;
  const d = document.createElement('div');
  d.className = 'cerca-seg';
  d.style.cssText = `position:absolute;left:${a.x}%;top:calc(${a.y}% - 2px);width:${lenPct}%;height:4px;border-radius:2px;background:#EB5757;transform-origin:0 2px;transform:rotate(${ang}deg);pointer-events:none;z-index:2;`;
  return d;
}

function renderCercas(wrap){
  wrap.querySelectorAll('.cerca-seg, .cerca-vertex').forEach(el=>el.remove());
  const wrapW = wrap.offsetWidth, wrapH = wrap.offsetHeight;
  state.planta.cercas.forEach((c,ci)=>{
    for(let i=0;i<c.pontos.length-1;i++) wrap.appendChild(cercaSegmentDiv(c.pontos[i], c.pontos[i+1], wrapW, wrapH));
    c.pontos.forEach((pt,vi)=>{
      const v = document.createElement('div');
      v.className = 'cerca-vertex';
      v.title = 'Arraste para ajustar o traçado';
      v.style.cssText = `position:absolute;left:${pt.x}%;top:${pt.y}%;transform:translate(-50%,-50%);background:#fff;border:2.5px solid #EB5757;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.35);cursor:grab;z-index:4;touch-action:none;`;
      v.onpointerdown = (e)=>startVertexDrag(e, ci, vi);
      wrap.appendChild(v);
    });
  });
  if(tracoAtual && tracoAtual.length){
    for(let i=0;i<tracoAtual.length-1;i++) wrap.appendChild(cercaSegmentDiv(tracoAtual[i], tracoAtual[i+1], wrapW, wrapH));
    tracoAtual.forEach(pt=>{
      const v = document.createElement('div');
      v.className = 'cerca-vertex';
      v.style.cssText = `position:absolute;left:${pt.x}%;top:${pt.y}%;transform:translate(-50%,-50%);background:#EB5757;border:2.5px solid #fff;border-radius:50%;pointer-events:none;z-index:4;`;
      wrap.appendChild(v);
    });
  }
}

export function afterPlantaRender(){
  const img = document.getElementById('plantaImg');
  const wrap = document.getElementById('plantaWrap');
  if(img){
    img.onclick = (e)=>{
      if(suppressNextClick){ suppressNextClick = false; return; }
      if(etiquetaSuprimeClique() || muroDragAtivo()) return;
      if(state.planta.selectedTipo==='area') return;
      const rect = img.getBoundingClientRect();
      const x = ((e.clientX-rect.left)/rect.width)*100;
      const y = ((e.clientY-rect.top)/rect.height)*100;
      if(state.planta.selectedTipo==='etiqueta'){
        state.planta.etiquetas.push(novaEtiqueta(x, y));
        renderContent();
        encaixarEtiqueta(state.planta.etiquetas.length-1);
        const inp = document.getElementById('etqtxt-'+(state.planta.etiquetas.length-1));
        if(inp){ inp.focus({preventScroll:true}); inp.select(); }
        return;
      }
      if(state.planta.selectedTipo==='muro'){ muroClique(x, y, rect); return; }
      if(state.planta.selectedTipo==='escala'){ escalaClique(x, y); return; }
      if(state.planta.selectedTipo==='cerca'){
        tracoAtual = tracoAtual || [];
        tracoAtual.push({x, y});
        renderContent();
        return;
      }
      const t = typeById(state.planta.selectedTipo);
      const novo = {id:novoId(), tipoId:t.id, label:t.label, qtd:1, x, y, direcao:0, fotoLocal:null, fotoView:null};
      encaixarNoMuro(novo, state.planta, rect.width, rect.height); // portão/porta/janela perto de um muro grudam nele
      state.planta.pins.push(novo);
      renderContent();
    };
    img.onpointerdown = (e)=>{
      if(state.planta.selectedTipo==='area' && e.isPrimary) startAreaDraw(e);
    };
  }
  if(wrap){
    state.planta.pins.forEach((p,pi)=>{
      const t = typeById(p.tipoId);
      if(t.cameraLike && t.foco360){
        // PTZ/Speed Dome enxerga 360° — círculo translúcido (cortado pelos muros), sem handle de rotação
        const circ = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        circ.id = 'cone-'+pi;
        circ.innerHTML = `<path fill="${t.color}40" stroke="${t.color}88" stroke-width="1.5"/>`;
        circ.style.cssText = 'position:absolute;transform:translate(-50%,-50%);overflow:visible;pointer-events:none;z-index:1;';
        wrap.appendChild(circ);
        posicionarFoco(pi);
      } else if(t.cameraLike){
        // Foco em setor com a ponta em arco (SVG em px, posição em % — acompanha o zoom)
        const cone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        cone.id = 'cone-'+pi;
        cone.innerHTML = `<path fill="${t.color}55" stroke="${t.color}" stroke-opacity="0.85" stroke-width="1.5"/>`;
        cone.style.cssText = 'position:absolute;transform:translate(-50%,-50%);overflow:visible;pointer-events:none;z-index:1;';
        wrap.appendChild(cone);

        const handle = document.createElement('div');
        handle.id = 'rothandle-'+pi;
        handle.className = 'planta-rothandle';
        handle.title = t.ajustaAlcance ? 'Arraste para girar a direção; afaste ou aproxime do ícone para mudar o alcance' : 'Arraste para girar a direção';
        handle.style.cssText = `position:absolute;border-radius:50%;background:#fff;border:2.5px solid ${t.color};transform:translate(-50%,-50%);cursor:grab;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.45);touch-action:none;`;
        handle.onpointerdown = (e)=>startRotateDrag(e, pi);
        wrap.appendChild(handle);
        if(t.ajustaAlcance){
          // Bullet/Dome: um ponto em cada borda do arco abre/fecha aquele lado do foco
          ['esq','dir'].forEach(lado=>{
            const h = document.createElement('div');
            h.id = `abhandle-${lado}-${pi}`;
            h.className = 'planta-abhandle';
            h.title = 'Arraste para abrir ou fechar este lado do foco';
            h.style.cssText = `position:absolute;border-radius:50%;background:${t.color};border:2px solid #fff;transform:translate(-50%,-50%);cursor:grab;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.45);touch-action:none;`;
            h.onpointerdown = (e)=>startAberturaDrag(e, pi, lado);
            wrap.appendChild(h);
          });
        }
        posicionarFoco(pi);
      }
      const pin = document.createElement('div');
      pin.id = 'pinicon-'+pi;
      pin.className = 'planta-pin';
      pin.title = 'Arraste para reposicionar';
      pin.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:3;cursor:grab;touch-action:none;`;
      pin.innerHTML = ICONS[t.id] + (t.cenario ? '' : `<span style="position:absolute;top:-7px;right:-7px;background:#111;color:#fff;font-size:9px;font-weight:800;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${numeroDoPin(state.plantaAtiva, pi)}</span>`);
      pin.onpointerdown = (e)=>startPinDrag(e, pi);
      wrap.appendChild(pin);
      posicionarMarcaMuro(pi);
    });
    renderMuros(wrap, ()=>state.planta.pins.forEach((_,i)=>updatePinDOM(i)));
    renderCercas(wrap);
    renderEscala(wrap);
    renderAreas(wrap);
    renderEtiquetas(wrap);
    if(img && !img.complete){
      img.addEventListener('load', ()=>{
        const w = document.getElementById('plantaWrap');
        if(w) renderCercas(w);
        atualizarFocos();
      });
    }
    // zoom/pinch mudam o tamanho da planta em px: o corte dos focos pelos muros (calculado em px) é refeito
    if(focoObs) focoObs.disconnect();
    focoObs = null;
    if((state.planta.muros||[]).length && typeof ResizeObserver!=='undefined'){
      focoObs = new ResizeObserver(()=>{
        if(!wrap.isConnected){ focoObs && focoObs.disconnect(); return; }
        atualizarFocos();
      });
      focoObs.observe(wrap);
    }
  }
  attachPinchZoom();
}

export function startPinDrag(e, pi){
  e.preventDefault(); e.stopPropagation();
  dragState = {type:'move', index:pi};
  const el = document.getElementById('pinicon-'+pi);
  if(el) el.style.cursor = 'grabbing';
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
export function startRotateDrag(e, pi){
  e.preventDefault(); e.stopPropagation();
  fixarAbertura(state.planta.pins[pi]);
  dragState = {type:'rotate', index:pi};
  const el = document.getElementById('rothandle-'+pi);
  if(el) el.style.cursor = 'grabbing';
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
export function startAberturaDrag(e, pi, lado){
  e.preventDefault(); e.stopPropagation();
  fixarAbertura(state.planta.pins[pi]);
  dragState = {type:'abertura', index:pi, lado};
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
export function startVertexDrag(e, ci, vi){
  e.preventDefault(); e.stopPropagation();
  dragState = {type:'vertex', ci, vi};
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
export function onPointerDrag(e){
  if(!dragState) return;
  const img = document.getElementById('plantaImg');
  if(!img) return;
  const rect = img.getBoundingClientRect();
  if(dragState.type==='vertex'){
    const pt = state.planta.cercas[dragState.ci]?.pontos[dragState.vi];
    if(!pt) return;
    pt.x = Math.max(0, Math.min(100, ((e.clientX-rect.left)/rect.width)*100));
    pt.y = Math.max(0, Math.min(100, ((e.clientY-rect.top)/rect.height)*100));
    const wrap = document.getElementById('plantaWrap');
    if(wrap) renderCercas(wrap);
    return;
  }
  const pi = dragState.index;
  const pin = state.planta.pins[pi];
  if(!pin) return;
  if(dragState.type==='move'){
    let x = ((e.clientX-rect.left)/rect.width)*100;
    let y = ((e.clientY-rect.top)/rect.height)*100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    pin.x = x; pin.y = y;
    encaixarNoMuro(pin, state.planta, rect.width, rect.height);
  } else if(dragState.type==='rotate'){
    const cx = rect.left + (pin.x/100)*rect.width;
    const cy = rect.top + (pin.y/100)*rect.height;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    // o ponto fica no meio do arco: com abertura assimétrica a direção é o ângulo do ponteiro menos o desvio do meio
    const ab = aberturaDe(pin);
    let deg = Math.atan2(dx, -dy) * 180/Math.PI - (ab.dir - ab.esq)/2;
    deg = ((deg % 360) + 360) % 360;
    pin.direcao = Math.round(deg) % 360;
    // Bullet/Dome: a distância do ponto ao ícone define o alcance (o ponto fica na ponta do cone)
    if(typeById(pin.tipoId).ajustaAlcance){
      const a = (Math.hypot(dx, dy) - 3) / CONE_L0;
      pin.alcance = Math.round(Math.min(ALCANCE_MAX, Math.max(ALCANCE_MIN, a))*100)/100;
    }
  } else if(dragState.type==='abertura'){
    // ângulo do ponteiro em relação à direção da câmera → abertura daquele lado
    const cx = rect.left + (pin.x/100)*rect.width;
    const cy = rect.top + (pin.y/100)*rect.height;
    const ang = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180/Math.PI;
    let rel = ((ang - (pin.direcao||0)) % 360 + 540) % 360 - 180; // -180..180, + = horário
    if(dragState.lado==='esq') rel = -rel;
    const v = Math.round(Math.min(ABERTURA_MAX, Math.max(ABERTURA_MIN, rel)));
    if(dragState.lado==='esq') pin.abEsq = v; else pin.abDir = v;
  }
  updatePinDOM(pi);
}
export function endPointerDrag(){
  if(dragState){
    suppressNextClick = true;
    setTimeout(()=>{ suppressNextClick = false; }, 80);
  }
  const wasIndex = dragState ? dragState.index : null;
  dragState = null;
  document.removeEventListener('pointermove', onPointerDrag);
  document.removeEventListener('pointerup', endPointerDrag);
  if(wasIndex!==null){
    const pinEl = document.getElementById('pinicon-'+wasIndex);
    const handleEl = document.getElementById('rothandle-'+wasIndex);
    if(pinEl) pinEl.style.cursor = 'grab';
    if(handleEl) handleEl.style.cursor = 'grab';
  }
  syncPinRowControls();
}
export function updatePinDOM(pi){
  const pin = state.planta.pins[pi];
  const pinEl = document.getElementById('pinicon-'+pi);
  if(pinEl){ pinEl.style.left = pin.x+'%'; pinEl.style.top = pin.y+'%'; }
  const t = typeById(pin.tipoId);
  if(t.cameraLike) posicionarFoco(pi);
  posicionarMarcaMuro(pi);
}
let focoObs = null;
function atualizarFocos(){
  state.planta.pins.forEach((p,pi)=>{ if(typeById(p.tipoId).cameraLike) posicionarFoco(pi); });
}
// Muros da planta ativa em px do tamanho atual da imagem no editor
function segsEditor(){
  const img = document.getElementById('plantaImg');
  if(!img || !img.clientWidth || !img.clientHeight || !(state.planta.muros||[]).length) return {segs:[], W:0, H:0};
  const W = img.clientWidth, H = img.clientHeight;
  return {segs: segmentosMuros(state.planta, W, H), W, H};
}
// Portão/porta/janela presos a um muro: barra na cor do item, alinhada com a parede, por baixo do ícone
function posicionarMarcaMuro(pi){
  const pin = state.planta.pins[pi], wrap = document.getElementById('plantaWrap');
  let el = document.getElementById('abmark-'+pi);
  const img = document.getElementById('plantaImg');
  const g = (pin && ABERTURAS_MURO.includes(pin.tipoId)) ? geomNoMuro(pin, state.planta, img?.clientWidth||1, img?.clientHeight||1) : null;
  if(!g){ if(el) el.remove(); return; }
  if(!el && wrap){
    el = document.createElement('div');
    el.id = 'abmark-'+pi;
    el.className = 'abertura-muro';
    el.style.cssText = `position:absolute;width:62px;height:10px;border-radius:2px;background:${typeById(pin.tipoId).color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);pointer-events:none;z-index:2;`;
    wrap.appendChild(el);
  }
  if(el){
    el.style.left = g.x+'%'; el.style.top = g.y+'%';
    el.style.transform = `translate(-50%,-50%) rotate(${g.ang}deg)`;
  }
}
// Redesenha o setor do foco e reposiciona os pontos (ponta = direção/alcance, bordas = abertura)
function posicionarFoco(pi){
  const pin = state.planta.pins[pi];
  const t = typeById(pin.tipoId);
  const L = t.foco360 ? PTZ_R : CONE_L0*alcanceDe(pin), ab = aberturaDe(pin), dir = pin.direcao||0;
  const coneEl = document.getElementById('cone-'+pi);
  if(coneEl){
    const S = 2*L + 4, c = S/2;
    coneEl.setAttribute('width', S); coneEl.setAttribute('height', S);
    coneEl.style.left = pin.x+'%'; coneEl.style.top = pin.y+'%';
    // muros cortam o foco: polígono de visão em px; sem corte, setor/círculo com arco perfeito
    const {segs, W, H} = segsEditor();
    const px = pin.x/100*W, py = pin.y/100*H;
    const poly = segs.length ? (t.foco360 ? poligonoVisao(px, py, L, 0, 360, segs, true) : poligonoVisao(px, py, L, dir-ab.esq, dir+ab.dir, segs)) : null;
    const path = coneEl.querySelector('path');
    if(path) path.setAttribute('d', poly ? poligonoPath(poly, c-px, c-py)
      : t.foco360 ? `M${c-L},${c} A${L},${L} 0 1 0 ${c+L},${c} A${L},${L} 0 1 0 ${c-L},${c} Z` : setorPath(c, c, L, dir, ab));
  }
  if(t.foco360) return;
  const coloca = (el, r, deg)=>{
    if(!el) return;
    const q = pontoNaDirecao(0, 0, r, deg);
    el.style.left = `calc(${pin.x}% + ${q.x}px)`;
    el.style.top = `calc(${pin.y}% + ${q.y}px)`;
  };
  // ponto da ponta no meio do arco, mas nunca colado no ícone (fica pegável no alcance mínimo)
  coloca(document.getElementById('rothandle-'+pi), Math.max(L+3, 44), dir + (ab.dir - ab.esq)/2);
  const rb = Math.max(L, 40);
  coloca(document.getElementById('abhandle-esq-'+pi), rb, dir-ab.esq);
  coloca(document.getElementById('abhandle-dir-'+pi), rb, dir+ab.dir);
}
export function syncPinRowControls(){
  state.planta.pins.forEach((p,pi)=>{
    const slider = document.getElementById('dirslider-'+pi);
    const lbl = document.getElementById('deglabel-'+pi);
    if(slider) slider.value = p.direcao||0;
    if(lbl) lbl.textContent = (p.direcao||0)+'°';
    const as = document.getElementById('alcslider-'+pi), al = document.getElementById('alclabel-'+pi);
    if(as) as.value = Math.round(alcanceDe(p)*100);
    if(al) al.textContent = Math.round(alcanceDe(p)*100)+'%';
    const ab = aberturaDe(p);
    const ae = document.getElementById('abesq-'+pi), ad = document.getElementById('abdir-'+pi), alb = document.getElementById('ablabel-'+pi);
    if(ae) ae.value = Math.round(ab.esq);
    if(ad) ad.value = Math.round(ab.dir);
    if(alb) alb.textContent = Math.round(ab.esq+ab.dir)+'°';
  });
}

function aplicarZoomAncorado(novoZoom){
  const sc = document.getElementById('plantaScroll');
  const wrap = document.getElementById('plantaWrap');
  let fx = 0.5, fy = 0.5;
  if(sc && wrap && wrap.offsetWidth && wrap.offsetHeight){
    fx = (sc.scrollLeft + sc.clientWidth/2)/wrap.offsetWidth;
    fy = (sc.scrollTop + sc.clientHeight/2)/wrap.offsetHeight;
  }
  state.planta.zoom = novoZoom;
  renderContent();
  if(!wrap) return;
  const aplicar = ()=>{
    const s2 = document.getElementById('plantaScroll');
    const w2 = document.getElementById('plantaWrap');
    if(!s2 || !w2) return;
    s2.scrollLeft = fx*w2.offsetWidth - s2.clientWidth/2;
    s2.scrollTop = fy*w2.offsetHeight - s2.clientHeight/2;
  };
  aplicar();
  const img = document.getElementById('plantaImg');
  if(img && !img.complete) img.addEventListener('load', aplicar, {once:true});
}
export function zoomPlanta(delta){
  aplicarZoomAncorado(Math.min(400, Math.max(60, (state.planta.zoom||100) + delta)));
}
export function resetZoom(){ aplicarZoomAncorado(100); }
export function liveUpdateCone(pi, deg){
  state.planta.pins[pi].direcao = parseInt(deg);
  const lbl = document.getElementById('deglabel-'+pi);
  if(lbl) lbl.textContent = deg+'°';
  updatePinDOM(pi);
}

export function liveUpdateAlcance(pi, pct){
  fixarAbertura(state.planta.pins[pi]);
  state.planta.pins[pi].alcance = parseInt(pct)/100;
  const lbl = document.getElementById('alclabel-'+pi);
  if(lbl) lbl.textContent = parseInt(pct)+'%';
  updatePinDOM(pi);
}
// Sliders de abertura (lado esquerdo / direito) na linha do pin — Bullet/Dome
function tplAberturaControles(p, pi){
  const ab = aberturaDe(p);
  const sl = (lado, v)=>`<input id="ab${lado}-${pi}" type="range" min="${ABERTURA_MIN}" max="${ABERTURA_MAX}" value="${Math.round(v)}" title="Abertura do lado ${lado==='esq'?'esquerdo':'direito'}" style="width:60px;margin-bottom:0;" oninput="liveUpdateAbertura(${pi}, '${lado}', this.value)">`;
  return `<span style="font-size:11px;color:var(--text-mid);">Abertura E/D</span>${sl('esq', ab.esq)}${sl('dir', ab.dir)}<span id="ablabel-${pi}" style="font-size:11px;color:var(--text-mid);width:32px;">${Math.round(ab.esq+ab.dir)}°</span>`;
}
export function liveUpdateAbertura(pi, lado, deg){
  const pin = state.planta.pins[pi];
  fixarAbertura(pin);
  if(lado==='esq') pin.abEsq = parseInt(deg); else pin.abDir = parseInt(deg);
  const ab = aberturaDe(pin), lbl = document.getElementById('ablabel-'+pi);
  if(lbl) lbl.textContent = Math.round(ab.esq+ab.dir)+'°';
  updatePinDOM(pi);
}
// Comprimento padrão do foco no editor (px); o alcance (Bullet/Dome) multiplica.
const CONE_L0 = 55, PTZ_R = 55;

export function removePin(pi){ state.planta.pins.splice(pi,1); renderContent(); }

export async function handlePlantaUpload(e){
  const f = e.target.files[0]; if(!f) return;
  if(isPdfFile(f)){ await handlePlantaPdfUpload(f); e.target.value=''; return; }
  state.planta.imagem = await fileToDataURL(f);
  limparPlanta(state.planta);
  resetRolagem();
  renderContent();
}
