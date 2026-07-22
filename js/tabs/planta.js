import { state, novaPlanta, pinOffsetGlobal } from '../state.js';
import { EQUIP_TYPES, ICONS } from '../constants.js';
import { typeById, fileToDataURL, showToast } from '../utils.js';
import { renderContent } from '../nav.js';
import { tplAreaPalette, tplAreaRows, renderAreas, startAreaDraw, areaDragAtivo, cancelAreaDraw } from './areas.js';
import { isPdfFile, handlePlantaPdfUpload } from './plantaPdf.js';

export function tplPlanta(){
  const pl = state.planta;
  const off = pinOffsetGlobal(state.plantaAtiva);
  return `
    <h1 class="pagetitle">02 · Planta / Mapeamento</h1>
    <p class="pagesub">Envie a planta baixa, escolha o tipo de equipamento e clique para posicionar. Depois é só arrastar o ícone para reposicionar, e (para câmeras) arrastar o ponto branco ao redor dele para girar a direção de visualização.</p>
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
      <input type="file" accept="image/*,application/pdf" onchange="handlePlantaUpload(event)" style="margin-bottom:4px;">
      <div class="hint">PDF com mais de uma página: você escolhe qual usar.</div>
      <div class="toolbar-types">
        ${EQUIP_TYPES.map(t=>`
          <button class="type-btn ${pl.selectedTipo===t.id?'active':''}" onclick="selectTipo('${t.id}')">
            <span class="icon-dot" style="background:${t.color}">${ICONS[t.id]}</span>${t.label}
          </button>`).join('')}
        <button class="type-btn ${pl.selectedTipo==='area'?'active':''}" onclick="selectTipo('area')">
          <span class="icon-dot" style="background:#5A6B82">▧</span>Demarcar Área
        </button>
      </div>
      ${pl.imagem ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <button class="btn ghost small" onclick="zoomPlanta(-20)">➖ Zoom</button>
        <span id="zoomLabel" style="font-size:13px;font-weight:700;min-width:44px;text-align:center;">${pl.zoom||100}%</span>
        <button class="btn ghost small" onclick="zoomPlanta(20)">➕ Zoom</button>
        <button class="btn ghost small" onclick="resetZoom()">Resetar</button>
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
      ${pl.selectedTipo==='area' && pl.imagem ? tplAreaPalette() : ''}
      <div id="plantaScroll" class="${pl.selectedTipo==='area' ? 'modo-area' : ''}">
        ${pl.imagem
          ? `<div id="plantaWrap" style="position:relative;width:${pl.zoom||100}%;">
               <img id="plantaImg" src="${pl.imagem}">
             </div>`
          : `<div class="empty-hint">Envie uma imagem da planta baixa para começar a posicionar os equipamentos.</div>`}
      </div>
      <div class="pinlist">
        ${(pl.pins.length===0 && pl.cercas.length===0 && pl.areas.length===0) ? `<div class="hint">Nenhum equipamento posicionado ainda.</div>` : pl.pins.map((p,pi)=>`
          <div class="pinrow">
            <span class="icon-dot" style="background:${typeById(p.tipoId).color}">${ICONS[p.tipoId]}</span>
            <b style="font-size:12px;color:var(--text-mid);width:18px;">${off+pi+1}</b>
            <select onchange="state.planta.pins[${pi}].tipoId=this.value; renderContent();">
              ${EQUIP_TYPES.map(t=>`<option value="${t.id}" ${t.id===p.tipoId?'selected':''}>${t.label}</option>`).join('')}
            </select>
            <input type="text" style="flex:1;min-width:140px;" placeholder="Rótulo (ex: Monitoramento bombas/Pit)" value="${p.label}" oninput="state.planta.pins[${pi}].label=this.value">
            <input type="number" min="1" style="width:60px" value="${p.qtd}" oninput="state.planta.pins[${pi}].qtd=this.value">
            ${typeById(p.tipoId).cameraLike && !typeById(p.tipoId).foco360 ? `<span style="font-size:11px;color:var(--text-mid);">Direção</span><input id="dirslider-${pi}" type="range" min="0" max="359" value="${p.direcao||0}" style="width:80px;margin-bottom:0;" oninput="liveUpdateCone(${pi}, this.value)"><span id="deglabel-${pi}" style="font-size:11px;color:var(--text-mid);width:32px;">${p.direcao||0}°</span>` : ''}
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
        ${tplAreaRows()}
      </div>
    </div>
  `;
}

let dragState = null;
let suppressNextClick = false;
let pinch = null;
let tracoAtual = null; // [{x,y},...] durante o desenho de uma cerca; null = sem traçado

export function cancelarTraco(){ tracoAtual = null; }
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
  const temConteudo = pt.imagem || pt.pins.length || pt.cercas.length || pt.areas.length;
  if(temConteudo && !confirm(`Excluir a planta "${pt.nome||('Planta '+(i+1))}" e tudo que está nela?`)) return;
  cancelarTraco();
  state.plantas.splice(i,1);
  if(state.plantas.length===0) state.plantas.push(novaPlanta('Planta 1'));
  if(i < state.plantaAtiva) state.plantaAtiva--;
  state.plantaAtiva = Math.max(0, Math.min(state.plantaAtiva, state.plantas.length-1));
  renderContent();
}
export function selectTipo(id){
  if(state.planta.selectedTipo==='cerca' && id!=='cerca') tracoAtual = null;
  state.planta.selectedTipo = id;
  renderContent();
}
export function cercaDesfazer(){
  if(tracoAtual && tracoAtual.length) tracoAtual.pop();
  renderContent();
}
export function cercaConcluir(){
  if(!tracoAtual || tracoAtual.length<2){ tracoAtual = null; renderContent(); return; }
  state.planta.cercas.push({label:'Cerca / Concertina', pontos:tracoAtual});
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
    if(dragState || areaDragAtivo()) return;
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
  const off = pinOffsetGlobal(state.plantaAtiva);
  if(img){
    img.onclick = (e)=>{
      if(suppressNextClick){ suppressNextClick = false; return; }
      if(state.planta.selectedTipo==='area') return;
      const rect = img.getBoundingClientRect();
      const x = ((e.clientX-rect.left)/rect.width)*100;
      const y = ((e.clientY-rect.top)/rect.height)*100;
      if(state.planta.selectedTipo==='cerca'){
        tracoAtual = tracoAtual || [];
        tracoAtual.push({x, y});
        renderContent();
        return;
      }
      const t = typeById(state.planta.selectedTipo);
      state.planta.pins.push({tipoId:t.id, label:t.label, qtd:1, x, y, direcao:0, fotoLocal:null, fotoView:null});
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
        // PTZ/Speed Dome enxerga 360° — círculo translúcido, sem handle de rotação.
        // Usa o mesmo id 'cone-' para o updatePinDOM mover junto (o rotate() é inócuo num círculo).
        const circ = document.createElement('div');
        circ.id = 'cone-'+pi;
        circ.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;width:110px;height:110px;border-radius:50%;transform:translate(-50%,-50%);background:${t.color}40;border:1.5px solid ${t.color}88;box-sizing:border-box;pointer-events:none;z-index:1;`;
        wrap.appendChild(circ);
      } else if(t.cameraLike){
        const cone = document.createElement('div');
        cone.id = 'cone-'+pi;
        cone.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;width:110px;height:110px;transform:translate(-50%,-50%) rotate(${p.direcao||0}deg);transform-origin:50% 50%;clip-path:polygon(50% 50%, 26% 0%, 74% 0%);background:${t.color}55;pointer-events:none;z-index:1;`;
        wrap.appendChild(cone);

        const R = 58;
        const rad = (p.direcao||0) * Math.PI/180;
        const hx = R*Math.sin(rad), hy = -R*Math.cos(rad);
        const handle = document.createElement('div');
        handle.id = 'rothandle-'+pi;
        handle.className = 'planta-rothandle';
        handle.title = 'Arraste para girar a direção';
        handle.style.cssText = `position:absolute;left:calc(${p.x}% + ${hx}px);top:calc(${p.y}% + ${hy}px);border-radius:50%;background:#fff;border:2.5px solid ${t.color};transform:translate(-50%,-50%);cursor:grab;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.45);touch-action:none;`;
        handle.onpointerdown = (e)=>startRotateDrag(e, pi);
        wrap.appendChild(handle);
      }
      const pin = document.createElement('div');
      pin.id = 'pinicon-'+pi;
      pin.className = 'planta-pin';
      pin.title = 'Arraste para reposicionar';
      pin.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:3;cursor:grab;touch-action:none;`;
      pin.innerHTML = ICONS[t.id] + `<span style="position:absolute;top:-7px;right:-7px;background:#111;color:#fff;font-size:9px;font-weight:800;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${off+pi+1}</span>`;
      pin.onpointerdown = (e)=>startPinDrag(e, pi);
      wrap.appendChild(pin);
    });
    renderCercas(wrap);
    renderAreas(wrap);
    if(img && !img.complete){
      img.addEventListener('load', ()=>{
        const w = document.getElementById('plantaWrap');
        if(w) renderCercas(w);
      });
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
  dragState = {type:'rotate', index:pi};
  const el = document.getElementById('rothandle-'+pi);
  if(el) el.style.cursor = 'grabbing';
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
  } else if(dragState.type==='rotate'){
    const cx = rect.left + (pin.x/100)*rect.width;
    const cy = rect.top + (pin.y/100)*rect.height;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    let deg = Math.atan2(dx, -dy) * 180/Math.PI;
    if(deg < 0) deg += 360;
    pin.direcao = Math.round(deg);
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
  const coneEl = document.getElementById('cone-'+pi);
  const handleEl = document.getElementById('rothandle-'+pi);
  if(pinEl){ pinEl.style.left = pin.x+'%'; pinEl.style.top = pin.y+'%'; }
  if(coneEl){
    coneEl.style.left = pin.x+'%'; coneEl.style.top = pin.y+'%';
    coneEl.style.transform = `translate(-50%,-50%) rotate(${pin.direcao||0}deg)`;
  }
  if(handleEl){
    const R = 58;
    const rad = (pin.direcao||0) * Math.PI/180;
    const hx = R*Math.sin(rad), hy = -R*Math.cos(rad);
    handleEl.style.left = `calc(${pin.x}% + ${hx}px)`;
    handleEl.style.top = `calc(${pin.y}% + ${hy}px)`;
  }
}
export function syncPinRowControls(){
  state.planta.pins.forEach((p,pi)=>{
    const slider = document.getElementById('dirslider-'+pi);
    const lbl = document.getElementById('deglabel-'+pi);
    if(slider) slider.value = p.direcao||0;
    if(lbl) lbl.textContent = (p.direcao||0)+'°';
  });
}

export function zoomPlanta(delta){
  const z = (state.planta.zoom||100) + delta;
  state.planta.zoom = Math.min(400, Math.max(60, z));
  renderContent();
}
export function resetZoom(){ state.planta.zoom = 100; renderContent(); }
export function liveUpdateCone(pi, deg){
  state.planta.pins[pi].direcao = parseInt(deg);
  const el = document.getElementById('cone-'+pi);
  if(el) el.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
  const lbl = document.getElementById('deglabel-'+pi);
  if(lbl) lbl.textContent = deg+'°';
  updatePinDOM(pi);
}

export function removePin(pi){ state.planta.pins.splice(pi,1); renderContent(); }

export async function handlePlantaUpload(e){
  const f = e.target.files[0]; if(!f) return;
  if(isPdfFile(f)){ await handlePlantaPdfUpload(f); e.target.value=''; return; }
  state.planta.imagem = await fileToDataURL(f);
  state.planta.pins = [];
  state.planta.cercas = [];
  state.planta.areas = [];
  state.planta.zoom = 100;
  renderContent();
}
