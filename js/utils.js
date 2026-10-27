import { EQUIP_TYPES, AREA_CATS } from './constants.js';

// Id estável (único por sessão e entre imports) para pins e cercas
export function novoId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

export function todayISO(){ return new Date().toISOString().slice(0,10); }

export function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

export function fileToDataURL(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function typeById(id){ return EQUIP_TYPES.find(t=>t.id===id) || EQUIP_TYPES[EQUIP_TYPES.length-1]; }

// Alcance do foco (Bullet/Dome — tipos com ajustaAlcance): fator sobre o comprimento padrão do cone.
// Mais longe = cone mais comprido e um pouco mais estreito (câmera inclinada para a frente); mais
// perto = cone curto e mais aberto (câmera olhando para baixo). Pins sem alcance (ou de outros tipos) = 1.
export const ALCANCE_MIN = 0.7, ALCANCE_MAX = 1.8;
export function alcanceDe(pin){
  if(!typeById(pin.tipoId).ajustaAlcance) return 1;
  const a = parseFloat(pin.alcance);
  return Number.isFinite(a) ? Math.min(ALCANCE_MAX, Math.max(ALCANCE_MIN, a)) : 1;
}
// Multiplicador do meio-ângulo do cone: ~1.08× no alcance mínimo, 1× no padrão, 0.8× no máximo.
export function aberturaFator(a){ return 1.25 - 0.25*a; }

export function areaCatById(id){ return AREA_CATS.find(c=>c.id===id) || AREA_CATS[AREA_CATS.length-1]; }

export function fmtDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${parseInt(d)} | ${meses[parseInt(m)-1]} | ${y}`;
}

// Fração da planta recortada na ficha: adaptativa à resolução
// (plantas grandes recortam fração menor = mais zoom; clamp 15%–50%)
export function defaultCropFrac(naturalWidth){
  return Math.min(0.50, Math.max(0.15, 800/naturalWidth));
}

// Escapa texto livre para interpolar em HTML/atributos (usado pelas etiquetas)
export function escHtml(s){
  if(s===null || s===undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
