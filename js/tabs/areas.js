import { state } from '../state.js';
import { AREA_CATS } from '../constants.js';
import { areaCatById } from '../utils.js';
import { renderContent } from '../nav.js';

// ---------- templates ----------
export function tplAreaPalette(){
  const sel = state.planta.selectedAreaCat || 'area1';
  return `
    <div class="area-bar">
      <b>Demarcar área:</b>
      ${AREA_CATS.map(c=>`
        <button class="area-chip ${c.id===sel?'active':''}" style="--chip-cor:${c.color}" onclick="selectAreaCat('${c.id}')" title="${c.desc||'Descrição livre'}">${c.label}</button>`).join('')}
      <span class="hint" style="margin:0;">Clique e arraste na planta para desenhar. Arraste o corpo para mover; alça no canto para redimensionar.</span>
    </div>`;
}

export function tplAreaRows(){
  return state.planta.areas.map((a,ai)=>`
    <div class="pinrow">
      <span class="icon-dot" style="background:${areaCatById(a.catId).color}">▧</span>
      <b style="font-size:12px;color:var(--text-mid);width:24px;">A${ai+1}</b>
      <select onchange="setAreaCat(${ai}, this.value)">
        ${AREA_CATS.map(c=>`<option value="${c.id}" ${c.id===a.catId?'selected':''}>${c.label}</option>`).join('')}
      </select>
      <input type="text" style="flex:1;min-width:160px;" placeholder="${a.catId==='outro'?'Descreva a área':'Descrição'}" value="${a.descricao}" oninput="state.planta.areas[${ai}].descricao=this.value">
      <button class="btn danger small" onclick="removeArea(${ai})">✕</button>
    </div>`).join('');
}

// ---------- ações da lista/paleta ----------
export function selectAreaCat(id){ state.planta.selectedAreaCat = id; renderContent(); }
export function setAreaCat(ai, id){
  const a = state.planta.areas[ai];
  a.catId = id;
  a.descricao = areaCatById(id).desc || '';
  renderContent();
}
export function removeArea(ai){ state.planta.areas.splice(ai,1); renderContent(); }

// ---------- render na planta ----------
export function renderAreas(wrap){
  wrap.querySelectorAll('.area-rect').forEach(el=>el.remove());
  const interativo = state.planta.selectedTipo==='area';
  state.planta.areas.forEach((a,ai)=>wrap.appendChild(areaRectDiv(a, ai, interativo)));
}

function areaRectDiv(a, ai, interativo){
  const cat = areaCatById(a.catId);
  const d = document.createElement('div');
  d.className = 'area-rect';
  d.id = 'arearect-'+ai;
  d.style.cssText = `position:absolute;left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%;background:${cat.color}38;border:2px solid ${cat.color};border-radius:4px;z-index:1;box-sizing:border-box;${interativo?'cursor:move;touch-action:none;':'pointer-events:none;'}`;
  d.innerHTML = `<span class="area-chip-label" style="background:${cat.color};">${cat.label}</span>`;
  if(interativo){
    d.onpointerdown = (e)=>startAreaMove(e, ai);
    const h = document.createElement('div');
    h.className = 'area-handle';
    h.style.cssText = `position:absolute;right:-9px;bottom:-9px;background:#fff;border:2.5px solid ${cat.color};border-radius:50%;cursor:nwse-resize;touch-action:none;box-shadow:0 1px 3px rgba(0,0,0,.35);`;
    h.onpointerdown = (e)=>startAreaResize(e, ai);
    d.appendChild(h);
  }
  return d;
}

// ---------- desenho / mover / redimensionar ----------
let areaDrag = null;
const MIN_DIM = 1.5; // % mínimo de largura/altura

export function areaDragAtivo(){ return areaDrag !== null; }

function pctPoint(e){
  const img = document.getElementById('plantaImg');
  const rect = img.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((e.clientX-rect.left)/rect.width)*100)),
    y: Math.max(0, Math.min(100, ((e.clientY-rect.top)/rect.height)*100)),
  };
}

export function startAreaDraw(e){
  e.preventDefault();
  const p = pctPoint(e);
  areaDrag = {type:'draw', start:p, rect:null};
  const wrap = document.getElementById('plantaWrap');
  const cat = areaCatById(state.planta.selectedAreaCat||'area1');
  const d = document.createElement('div');
  d.id = 'area-preview';
  d.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;width:0;height:0;background:${cat.color}38;border:2px dashed ${cat.color};border-radius:4px;z-index:5;pointer-events:none;box-sizing:border-box;`;
  wrap.appendChild(d);
  document.addEventListener('pointermove', onAreaPointerMove);
  document.addEventListener('pointerup', endAreaPointer);
}

function startAreaMove(e, ai){
  e.preventDefault(); e.stopPropagation();
  const p = pctPoint(e);
  const a = state.planta.areas[ai];
  areaDrag = {type:'move', index:ai, start:p, orig:{x:a.x, y:a.y}};
  document.addEventListener('pointermove', onAreaPointerMove);
  document.addEventListener('pointerup', endAreaPointer);
}

function startAreaResize(e, ai){
  e.preventDefault(); e.stopPropagation();
  areaDrag = {type:'resize', index:ai};
  document.addEventListener('pointermove', onAreaPointerMove);
  document.addEventListener('pointerup', endAreaPointer);
}

function onAreaPointerMove(e){
  if(!areaDrag) return;
  const img = document.getElementById('plantaImg');
  if(!img) return;
  const p = pctPoint(e);
  if(areaDrag.type==='draw'){
    const s = areaDrag.start;
    const x = Math.min(s.x, p.x), y = Math.min(s.y, p.y);
    const w = Math.abs(p.x-s.x), h = Math.abs(p.y-s.y);
    areaDrag.rect = {x, y, w, h};
    const d = document.getElementById('area-preview');
    if(d){ d.style.left=x+'%'; d.style.top=y+'%'; d.style.width=w+'%'; d.style.height=h+'%'; }
  } else if(areaDrag.type==='move'){
    const a = state.planta.areas[areaDrag.index];
    if(!a) return;
    const dx = p.x - areaDrag.start.x, dy = p.y - areaDrag.start.y;
    a.x = Math.max(0, Math.min(100-a.w, areaDrag.orig.x+dx));
    a.y = Math.max(0, Math.min(100-a.h, areaDrag.orig.y+dy));
    updateAreaDOM(areaDrag.index);
  } else if(areaDrag.type==='resize'){
    const a = state.planta.areas[areaDrag.index];
    if(!a) return;
    a.w = Math.max(MIN_DIM, Math.min(100-a.x, p.x-a.x));
    a.h = Math.max(MIN_DIM, Math.min(100-a.y, p.y-a.y));
    updateAreaDOM(areaDrag.index);
  }
}

function updateAreaDOM(ai){
  const a = state.planta.areas[ai];
  const d = document.getElementById('arearect-'+ai);
  if(d){ d.style.left=a.x+'%'; d.style.top=a.y+'%'; d.style.width=a.w+'%'; d.style.height=a.h+'%'; }
}

function endAreaPointer(){
  document.removeEventListener('pointermove', onAreaPointerMove);
  document.removeEventListener('pointerup', endAreaPointer);
  const drag = areaDrag;
  areaDrag = null;
  if(drag && drag.type==='draw'){
    const d = document.getElementById('area-preview');
    if(d) d.remove();
    const r = drag.rect;
    if(r && r.w>=MIN_DIM && r.h>=MIN_DIM){
      const catId = state.planta.selectedAreaCat||'area1';
      state.planta.areas.push({catId, descricao: areaCatById(catId).desc||'', x:r.x, y:r.y, w:r.w, h:r.h});
      renderContent();
    }
  }
}
