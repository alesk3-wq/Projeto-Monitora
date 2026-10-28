// Escala da planta, alcance/altura em metros e ponto cego das câmeras — funções puras.
import { typeById, aberturaDe } from './utils.js';

export const ALCANCE_M_MIN = 2, ALCANCE_M_MAX = 150, ALCANCE_M_PADRAO = 20;
export const ALTURA_MIN = 1, ALTURA_MAX = 40, ALTURA_PADRAO = 3;
export const ALCANCE_FIXO_M = { ptz: 30, lpr: 15 };
export const COR_CEGO = '#E53935';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Largura da planta em metros a partir de 2 pontos (% da imagem) e da distância real entre eles
export function metrosLarguraDe(a, b, metros, natW, natH){
  if(!(metros > 0)) return null;
  const dist = Math.hypot((b.x - a.x)/100*natW, (b.y - a.y)/100*natH);
  if(dist < 1) return null;
  return metros*natW/dist;
}

export function temEscala(pl){ return !!(pl && pl.escala && pl.escala.metrosLargura > 0); }

// Pixels por metro para a imagem desenhada com largura W
export function pxPorMetro(pl, W){
  if(!temEscala(pl) || !(W > 0)) return null;
  return W / pl.escala.metrosLargura;
}

export function alcanceMDe(pin){
  if(ALCANCE_FIXO_M[pin.tipoId]) return ALCANCE_FIXO_M[pin.tipoId];
  if(typeById(pin.tipoId).ajustaAlcance){
    const v = Number(pin.alcanceM);
    return clamp(Number.isFinite(v) && pin.alcanceM != null ? v : ALCANCE_M_PADRAO, ALCANCE_M_MIN, ALCANCE_M_MAX);
  }
  return ALCANCE_M_PADRAO;
}

export function alturaDe(pin){
  const v = Number(pin.altura);
  return clamp(Number.isFinite(v) && pin.altura != null ? v : ALTURA_PADRAO, ALTURA_MIN, ALTURA_MAX);
}

// Distância (m) do pé da câmera até onde o chão começa a ser visto; FOV vertical em 16:9
export function pontoCegoM(altura, alcanceM, aberturaTotal){
  const hfov = aberturaTotal*Math.PI/180;
  const vfov = 2*Math.atan(Math.tan(hfov/2)*9/16);
  const topo = Math.atan(altura/alcanceM);
  const base = topo + vfov;
  if(base >= Math.PI/2) return 0;
  return Math.min(alcanceM, altura/Math.tan(base));
}

export function cegoDoPin(pin){
  if(!typeById(pin.tipoId).ajustaAlcance) return 0;
  const ab = aberturaDe(pin);
  return pontoCegoM(alturaDe(pin), alcanceMDe(pin), ab.esq + ab.dir);
}

// 13.333 → "13,3 m"; 20 → "20 m"
export function fmtM(v){
  return (Math.round(v*10)/10).toString().replace('.', ',') + ' m';
}

// Linha Altura / Alcance / Ponto cego da ficha (Bullet/Dome numa planta com escala)
export function infoFocoHtml(pin, pl){
  if(!temEscala(pl) || !typeById(pin.tipoId).ajustaAlcance) return '';
  return `<div style="margin-top:6px;font-size:15px;line-height:1.5;color:#33415A;">Altura: ${fmtM(alturaDe(pin))} · Alcance: ${fmtM(alcanceMDe(pin))} · Ponto cego: ${fmtM(cegoDoPin(pin))}</div>`;
}
