import { state } from '../state.js';
import { ICONS } from '../constants.js';
import { typeById, novoId, showToast, escHtml } from '../utils.js';
import { renderContent } from '../nav.js';
import { sincronizarAberturas } from '../visao.js';

// Muros / paredes da aba Planta: traçados ponto a ponto como a cerca; "Concluir" deixa a linha aberta
// (muro) e "Fechar" (ou clicar de novo no 1º ponto) fecha o local (edificação, com preenchimento).
// Bloqueiam a visão das câmeras (js/visao.js). Item de cenário: sem número, ficha nem validação.
// planta.js delega para cá.

export const MURO_COR = typeById('muro').color;
const FECHAR_PX = 14; // clicar a até 14px do 1º ponto fecha o local

let tracoMuro = null; // [{x,y},...] durante o desenho; null = sem traçado
let muroDrag = null;  // {mi, vi} durante o arraste de um vértice
let onMuroMudou = null; // callback do planta.js: reposiciona aberturas presas e focos das câmeras

export function cancelarTracoMuro(){ tracoMuro = null; }
export function muroDragAtivo(){ return muroDrag !== null; }

// ---------- templates ----------
export function tplMuroBar(){
  const n = tracoMuro ? tracoMuro.length : 0;
  return `
    <div class="cerca-bar muro-bar">
      <b>Traçado de muro / parede:</b>
      <span>${n} ponto(s)</span>
      <button class="btn ghost small" onclick="muroDesfazer()">↩ Desfazer último</button>
      <button class="btn primary small" onclick="muroConcluir(false)">✔ Concluir (muro aberto)</button>
      <button class="btn primary small" onclick="muroConcluir(true)">⬠ Fechar local</button>
      <button class="btn danger small" onclick="muroCancelar()">✕ Cancelar</button>
      <span class="hint" style="margin:0;">Toque na planta para adicionar pontos; tocar de novo no 1º ponto fecha o local. Com esta ferramenta ativa, os cantos dos muros prontos podem ser arrastados.</span>
    </div>`;
}

export function tplMuroRows(){
  return (state.planta.muros||[]).map((m,mi)=>`
    <div class="pinrow">
      <span class="icon-dot" style="background:${MURO_COR}">${ICONS.muro}</span>
      <b style="font-size:12px;color:var(--text-mid);width:24px;">M${mi+1}</b>
      <input type="text" style="flex:1;min-width:140px;" placeholder="Rótulo (ex: Prédio administrativo)" value="${escHtml(m.label||'')}" oninput="state.planta.muros[${mi}].label=this.value">
      <span style="font-size:11px;color:var(--text-mid);">${m.fechado ? 'local fechado' : 'muro aberto'} · ${m.pontos.length} pontos</span>
      <button class="btn danger small" onclick="removeMuro(${mi})">✕</button>
    </div>`).join('');
}

// ---------- ações ----------
// Clique na planta com a ferramenta Muro: adiciona um ponto ou, perto do 1º (≥3 pontos), fecha o local
export function muroClique(x, y, imgRect){
  tracoMuro = tracoMuro || [];
  if(tracoMuro.length >= 3){
    const p0 = tracoMuro[0];
    const d = Math.hypot((x-p0.x)/100*imgRect.width, (y-p0.y)/100*imgRect.height);
    if(d <= FECHAR_PX){ muroConcluir(true); return; }
  }
  tracoMuro.push({x, y});
  renderContent();
}
export function muroDesfazer(){
  if(tracoMuro && tracoMuro.length) tracoMuro.pop();
  renderContent();
}
export function muroConcluir(fechar){
  const min = fechar ? 3 : 2;
  if(!tracoMuro || tracoMuro.length < min){
    if(fechar && tracoMuro && tracoMuro.length===2){ showToast('Para fechar um local são precisos pelo menos 3 pontos.'); return; }
    tracoMuro = null; renderContent(); return;
  }
  (state.planta.muros = state.planta.muros||[]).push({id:novoId(), label: fechar ? 'Edificação' : 'Muro / Parede', fechado: !!fechar, pontos: tracoMuro});
  tracoMuro = null;
  showToast(fechar ? 'Local fechado adicionado.' : 'Muro adicionado.');
  renderContent();
}
export function muroCancelar(){ tracoMuro = null; renderContent(); }
export function removeMuro(mi){
  const pl = state.planta, m = pl.muros[mi];
  if(!m) return;
  // aberturas presas a este muro ficam soltas onde estão
  pl.pins.forEach(p=>{ if(p.muroId===m.id){ delete p.muroId; delete p.seg; delete p.t; } });
  pl.muros.splice(mi, 1);
  renderContent();
}

// ---------- render no editor ----------
// SVG por cima da imagem em coordenadas % (viewBox 0 0 100 100, sem manter proporção) com traço em px
// (vector-effect) — acompanha zoom/pinch sem re-render.
export function renderMuros(wrap, onChange){
  onMuroMudou = onChange;
  wrap.querySelectorAll('.muro-svg, .muro-vertex').forEach(el=>el.remove());
  const muros = state.planta.muros||[];
  if(!muros.length && !(tracoMuro && tracoMuro.length)) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'muro-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:2;';
  const pts = arr=>arr.map(p=>`${p.x},${p.y}`).join(' ');
  svg.innerHTML = muros.map((m,mi)=>
    `<${m.fechado?'polygon':'polyline'} id="muro-${mi}" points="${pts(m.pontos)}" fill="${m.fechado ? MURO_COR+'33' : 'none'}" stroke="${MURO_COR}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join('')
    + (tracoMuro && tracoMuro.length ? `<polyline points="${pts(tracoMuro)}" fill="none" stroke="${MURO_COR}" stroke-width="4" stroke-dasharray="8 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : '');
  wrap.appendChild(svg);
  // cantos arrastáveis só com a ferramenta Muro ativa (fora dela não atrapalham pins e câmeras)
  if(state.planta.selectedTipo==='muro'){
    muros.forEach((m,mi)=>m.pontos.forEach((pt,vi)=>{
      const v = document.createElement('div');
      v.className = 'muro-vertex';
      v.id = `murov-${mi}-${vi}`;
      v.title = 'Arraste para ajustar o muro';
      v.style.cssText = `position:absolute;left:${pt.x}%;top:${pt.y}%;transform:translate(-50%,-50%);background:#fff;border:2.5px solid ${MURO_COR};border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.35);cursor:grab;z-index:5;touch-action:none;`;
      v.onpointerdown = (e)=>startMuroVertexDrag(e, mi, vi);
      wrap.appendChild(v);
    }));
  }
  if(tracoMuro) tracoMuro.forEach((pt,i)=>{
    const v = document.createElement('div');
    v.className = 'muro-vertex';
    const fechavel = i===0 && tracoMuro.length>=3;
    v.title = fechavel ? 'Toque aqui para fechar o local' : '';
    v.style.cssText = `position:absolute;left:${pt.x}%;top:${pt.y}%;transform:translate(-50%,-50%)${fechavel?' scale(1.35)':''};background:${MURO_COR};border:2.5px solid #fff;border-radius:50%;pointer-events:none;z-index:5;`;
    wrap.appendChild(v);
  });
}

function startMuroVertexDrag(e, mi, vi){
  e.preventDefault(); e.stopPropagation();
  muroDrag = {mi, vi};
  document.addEventListener('pointermove', onMuroDrag);
  document.addEventListener('pointerup', endMuroDrag);
}
function onMuroDrag(e){
  if(!muroDrag) return;
  const img = document.getElementById('plantaImg');
  const m = state.planta.muros[muroDrag.mi];
  if(!img || !m) return;
  const r = img.getBoundingClientRect();
  const pt = m.pontos[muroDrag.vi];
  pt.x = Math.max(0, Math.min(100, (e.clientX-r.left)/r.width*100));
  pt.y = Math.max(0, Math.min(100, (e.clientY-r.top)/r.height*100));
  document.getElementById('muro-'+muroDrag.mi)?.setAttribute('points', m.pontos.map(p=>`${p.x},${p.y}`).join(' '));
  const v = document.getElementById(`murov-${muroDrag.mi}-${muroDrag.vi}`);
  if(v){ v.style.left = pt.x+'%'; v.style.top = pt.y+'%'; }
  sincronizarAberturas(state.planta);
  if(onMuroMudou) onMuroMudou();
}
function endMuroDrag(){
  document.removeEventListener('pointermove', onMuroDrag);
  document.removeEventListener('pointerup', endMuroDrag);
  setTimeout(()=>{ muroDrag = null; }, 80); // segura o click que vem logo depois do arraste
}
