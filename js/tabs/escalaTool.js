import { state } from '../state.js';
import { showToast } from '../utils.js';
import { renderContent } from '../nav.js';
import { metrosLarguraDe, temEscala, fmtM } from '../escala.js';

// Ferramenta "📏 Escala" da aba Planta: o usuário marca 2 pontos na planta e informa a distância real entre
// eles; grava planta.escala = {a, b, metros, metrosLargura}. planta.js delega para cá.

// Número em pt-BR: "12", "12,5", "12.5", "1.000", "1.000,5"; rejeita lixo, zero e negativos
export function lerMetros(str){
  let s = String(str ?? '').trim();
  if(s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if(!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export const ESCALA_COR = '#0B7285';

let marcacao = null; // [{x,y},...] (0–2 pontos) durante a marcação; null = sem marcação em andamento

export function cancelarEscala(){ marcacao = null; }

// ---------- templates ----------
export function tplEscalaBar(){
  const pl = state.planta;
  let corpo;
  if(!marcacao && temEscala(pl)){
    corpo = `<b>Escala: ${fmtM(pl.escala.metros)}</b>
      <button class="btn ghost small" onclick="escalaRefazer()">Refazer</button>
      <button class="btn danger small" onclick="escalaRemover()">Remover</button>`;
  } else if(marcacao && marcacao.length>=2){
    corpo = `<b>Distância entre os 2 pontos:</b>
      <input id="escalaMetros" inputmode="decimal" placeholder="Distância real (m)" style="width:170px;margin:0;">
      <button class="btn primary small" onclick="escalaConfirmar()">✔ Confirmar</button>
      <button class="btn danger small" onclick="escalaCancelar()">✕ Cancelar</button>`;
  } else {
    const n = marcacao ? marcacao.length : 0;
    corpo = `<b>${n===0 ? 'Marque o 1º ponto' : 'Marque o 2º ponto'}</b>
      <span class="hint" style="margin:0;">Toque em dois pontos da planta cuja distância real você conhece (ex.: um muro, uma porta).</span>
      ${marcacao ? `<button class="btn danger small" onclick="escalaCancelar()">✕ Cancelar</button>` : ''}`;
  }
  return `<div class="cerca-bar escala-bar">${corpo}</div>`;
}

export function tplEscalaStatus(){
  const pl = state.planta;
  return temEscala(pl) ? `<span class="escala-chip" style="font-size:12px;font-weight:700;color:${ESCALA_COR};background:#E3F4F7;border-radius:12px;padding:2px 10px;">📏 Escala: ${fmtM(pl.escala.metros)}</span>` : '';
}

// ---------- ações ----------
export function escalaClique(x, y){
  if(!marcacao || marcacao.length>=2) marcacao = [];
  marcacao.push({x, y});
  renderContent();
}

export function escalaConfirmar(){
  const pl = state.planta;
  const img = document.getElementById('plantaImg');
  if(!marcacao || marcacao.length<2 || !img) return;
  const metros = lerMetros(document.getElementById('escalaMetros')?.value);
  if(metros === null){ showToast('Digite a distância em metros.'); return; }
  const [a, b] = marcacao;
  const metrosLargura = metrosLarguraDe(a, b, metros, img.naturalWidth, img.naturalHeight);
  if(metrosLargura === null){
    marcacao = null; showToast('Os dois pontos estão muito próximos.'); renderContent(); return;
  }
  pl.escala = {a:{x:a.x, y:a.y}, b:{x:b.x, y:b.y}, metros, metrosLargura};
  marcacao = null;
  showToast('Escala definida.');
  renderContent();
}
export function escalaCancelar(){ marcacao = null; renderContent(); }
export function escalaRefazer(){ marcacao = []; renderContent(); }
export function escalaRemover(){
  if(!confirm('Remover a escala desta planta?')) return;
  delete state.planta.escala; marcacao = null; renderContent();
}

// ---------- render no editor ----------
// Só com a ferramenta Escala ativa. SVG em % (viewBox 0 0 100 100) como o dos muros; traço em px.
export function renderEscala(wrap){
  wrap.querySelectorAll('.escala-svg, .escala-ponto').forEach(el=>el.remove());
  const pl = state.planta;
  if(pl.selectedTipo!=='escala') return;
  const pts = marcacao ? marcacao : (temEscala(pl) ? [pl.escala.a, pl.escala.b] : []);
  if(!pts.length) return;
  if(pts.length>=2){
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'escala-svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:5;';
    svg.innerHTML = `<line x1="${pts[0].x}" y1="${pts[0].y}" x2="${pts[1].x}" y2="${pts[1].y}" stroke="${ESCALA_COR}" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    wrap.appendChild(svg);
  }
  pts.forEach(pt=>{
    const v = document.createElement('div');
    v.className = 'escala-ponto';
    v.style.cssText = `position:absolute;left:${pt.x}%;top:${pt.y}%;transform:translate(-50%,-50%);width:12px;height:12px;background:${ESCALA_COR};border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.35);pointer-events:none;z-index:5;`;
    wrap.appendChild(v);
  });
}
