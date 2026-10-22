import { state } from '../state.js';
import { escHtml } from '../utils.js';
import { renderContent } from '../nav.js';

// Etiquetas de anotação com seta na planta (não são equipamentos: sem Ponto N,
// sem Estrutura, sem ficha). Dado: planta.etiquetas = [{texto, x, y, ax, ay}]
// x,y = canto sup.-esq. da caixa; ax,ay = ponta da seta — tudo em % da imagem.

export const ETQ_COR = '#E0A800';
const ARROW_LEN = 12;   // px, comprimento da ponta de seta
const ARROW_HALF = 7;   // px, meia-largura da ponta de seta
// (a alça .etq-tip é um anel vazado maior que a seta, centrado na ponta: a seta fica visível dentro dele)

const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));

export function novaEtiqueta(ax, ay){
  return { texto:'Nova etiqueta', x:clamp(ax+6, 0, 90), y:clamp(ay-8, 0, 95), ax, ay };
}

// Geometria (px) da perninha: do centro da caixa até a ponta. Compartilhada com o PDF.
export function etqGeom(boxX, boxY, boxW, boxH, tipX, tipY){
  const x1 = boxX + boxW/2, y1 = boxY + boxH/2;
  const dx = tipX - x1, dy = tipY - y1;
  const len = Math.hypot(dx, dy);
  const ang = len===0 ? 0 : Math.atan2(dy, dx)*180/Math.PI;
  return { x1, y1, len, ang };
}

// ---------- lista ----------
export function tplEtiquetaRows(){
  return state.planta.etiquetas.map((t,i)=>`
    <div class="pinrow">
      <span class="icon-dot" style="background:${ETQ_COR}">🏷</span>
      <b style="font-size:12px;color:var(--text-mid);width:24px;">E${i+1}</b>
      <input type="text" class="etiqueta-texto" id="etqtxt-${i}" style="flex:1;min-width:160px;" placeholder="Texto da etiqueta" value="${escHtml(t.texto)}" oninput="setEtiquetaTexto(${i}, this.value)">
      <button class="btn danger small" onclick="removeEtiqueta(${i})">✕</button>
    </div>`).join('');
}

export function setEtiquetaTexto(i, texto){
  const t = state.planta.etiquetas[i];
  if(!t) return;
  t.texto = texto;
  const box = document.getElementById('etqbox-'+i);
  if(box){ box.textContent = texto; updateEtiquetaDOM(i); }
}

// Mantém a caixa inteira dentro da imagem (medindo a caixa já renderizada).
// Sem medida disponível (imagem ainda sem tamanho), cai no clamp 0–95.
function clampCaixa(t, box, W, H){
  const maxX = (W && box) ? Math.max(0, 100 - box.offsetWidth/W*100) : 95;
  const maxY = (H && box) ? Math.max(0, 100 - box.offsetHeight/H*100) : 95;
  t.x = clamp(t.x, 0, maxX);
  t.y = clamp(t.y, 0, maxY);
}

// Encaixa a caixa da etiqueta i dentro da imagem (usado logo após criar)
export function encaixarEtiqueta(i){
  const t = state.planta.etiquetas[i];
  const wrap = document.getElementById('plantaWrap');
  const box = document.getElementById('etqbox-'+i);
  if(!t || !wrap || !box || !wrap.offsetWidth || !wrap.offsetHeight) return;
  clampCaixa(t, box, wrap.offsetWidth, wrap.offsetHeight);
  updateEtiquetaDOM(i);
}

export function removeEtiqueta(i){ state.planta.etiquetas.splice(i,1); renderContent(); }

// ---------- render na planta ----------
let resizeObs = null;

export function renderEtiquetas(wrap){
  wrap.querySelectorAll('.etq-line, .etq-arrow, .etq-box, .etq-tip').forEach(el=>el.remove());
  state.planta.etiquetas.forEach((t,i)=>{
    const line = document.createElement('div');
    line.className = 'etq-line'; line.id = 'etqline-'+i;
    const arrow = document.createElement('div');
    arrow.className = 'etq-arrow'; arrow.id = 'etqarrow-'+i;
    arrow.style.cssText = `border-left:${ARROW_HALF}px solid transparent;border-right:${ARROW_HALF}px solid transparent;border-top:${ARROW_LEN}px solid #333;`;
    const box = document.createElement('div');
    box.className = 'etq-box'; box.id = 'etqbox-'+i;
    box.title = 'Arraste para mover a etiqueta';
    box.textContent = t.texto;
    box.onpointerdown = (e)=>startEtqDrag(e, i, 'box');
    const tip = document.createElement('div');
    // acima dos pins só com a ferramenta Etiqueta; senão abaixo, para o pin ser arrastável
    tip.className = 'etq-tip' + (state.planta.selectedTipo==='etiqueta' ? ' etq-tool' : ''); tip.id = 'etqtip-'+i;
    tip.title = 'Arraste para mover a ponta da seta';
    tip.onpointerdown = (e)=>startEtqDrag(e, i, 'tip');
    wrap.append(line, arrow, box, tip);
    updateEtiquetaDOM(i);
  });
  // A geometria da perninha mistura % (posições) e px (tamanho da caixa):
  // recalcula sempre que o wrap muda de tamanho (zoom, pinch, decode da imagem, janela).
  if(resizeObs) resizeObs.disconnect();
  resizeObs = null;
  if(state.planta.etiquetas.length && typeof ResizeObserver!=='undefined'){
    resizeObs = new ResizeObserver(()=>{
      if(!wrap.isConnected){ resizeObs && resizeObs.disconnect(); return; }
      state.planta.etiquetas.forEach((_,i)=>updateEtiquetaDOM(i));
    });
    resizeObs.observe(wrap);
  }
}

function updateEtiquetaDOM(i){
  const t = state.planta.etiquetas[i];
  const wrap = document.getElementById('plantaWrap');
  const box = document.getElementById('etqbox-'+i);
  const line = document.getElementById('etqline-'+i);
  const arrow = document.getElementById('etqarrow-'+i);
  const tip = document.getElementById('etqtip-'+i);
  if(!t || !wrap || !box) return;
  box.style.left = t.x+'%'; box.style.top = t.y+'%';
  if(tip){ tip.style.left = t.ax+'%'; tip.style.top = t.ay+'%'; }
  const W = wrap.offsetWidth, H = wrap.offsetHeight;
  const g = etqGeom(t.x/100*W, t.y/100*H, box.offsetWidth, box.offsetHeight, t.ax/100*W, t.ay/100*H);
  if(line){
    line.style.left = g.x1+'px'; line.style.top = (g.y1-1)+'px';
    line.style.width = Math.max(0, g.len-ARROW_LEN)+'px';
    line.style.transform = `rotate(${g.ang}deg)`;
  }
  if(arrow){
    arrow.style.left = t.ax+'%'; arrow.style.top = t.ay+'%';
    // triângulo aponta para baixo (90°) com o vértice no ponto; gira para a direção da linha
    arrow.style.transform = `translate(-50%,-100%) rotate(${g.ang-90}deg)`;
    arrow.style.display = g.len > ARROW_LEN ? '' : 'none';
  }
}

// ---------- arraste (caixa ou ponta) ----------
let etqDrag = null;
let suppressClick = false;

export function etiquetaDragAtivo(){ return etqDrag !== null; }

// Consultado pelo img.onclick da planta: true = ignorar este clique (fim de um arraste)
export function etiquetaSuprimeClique(){
  if(suppressClick){ suppressClick = false; return true; }
  return false;
}

function pctPoint(e){
  const img = document.getElementById('plantaImg');
  const rect = img.getBoundingClientRect();
  return {
    x: ((e.clientX-rect.left)/rect.width)*100,
    y: ((e.clientY-rect.top)/rect.height)*100,
  };
}

function startEtqDrag(e, i, alvo){
  if(e.isPrimary===false) return;
  e.preventDefault(); e.stopPropagation();
  const t = state.planta.etiquetas[i];
  if(!t || !document.getElementById('plantaImg')) return;
  const p = pctPoint(e);
  etqDrag = { index:i, alvo, offX: p.x - t.x, offY: p.y - t.y };
  const el = document.getElementById((alvo==='box'?'etqbox-':'etqtip-')+i);
  if(el) el.style.cursor = 'grabbing';
  document.addEventListener('pointermove', onEtqPointerMove);
  document.addEventListener('pointerup', endEtqDrag);
  document.addEventListener('pointercancel', endEtqDrag);
}

function onEtqPointerMove(e){
  if(e.isPrimary===false || !etqDrag) return;
  const t = state.planta.etiquetas[etqDrag.index];
  if(!t || !document.getElementById('plantaImg')) return;
  const p = pctPoint(e);
  if(etqDrag.alvo==='box'){
    t.x = p.x - etqDrag.offX;
    t.y = p.y - etqDrag.offY;
    const wrap = document.getElementById('plantaWrap');
    clampCaixa(t, document.getElementById('etqbox-'+etqDrag.index), wrap?.offsetWidth, wrap?.offsetHeight);
  } else {
    t.ax = clamp(p.x, 0, 100);
    t.ay = clamp(p.y, 0, 100);
  }
  updateEtiquetaDOM(etqDrag.index);
}

function endEtqDrag(e){
  if(e && e.isPrimary===false) return;
  document.removeEventListener('pointermove', onEtqPointerMove);
  document.removeEventListener('pointerup', endEtqDrag);
  document.removeEventListener('pointercancel', endEtqDrag);
  if(etqDrag){
    const el = document.getElementById((etqDrag.alvo==='box'?'etqbox-':'etqtip-')+etqDrag.index);
    if(el) el.style.cursor = '';
    suppressClick = true;
    setTimeout(()=>{ suppressClick = false; }, 80);
  }
  etqDrag = null;
}
