// Vista aérea — funções puras (sem DOM): referências a pins da planta e geometria do mapa.
// Importa só state.js e utils.js (numeracao.js importa este módulo; não criar ciclo).
import { state } from './state.js';
import { novoId } from './utils.js';

export const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const CREDITO_ESRI = 'Imagens: Esri, Maxar, Earthstar Geographics';
export const MAPA_ZOOM_MAX = 19;
export const CAPTURA_MAX = 4096; // lado máximo da captura (limite de canvas do Safari iOS)

// Pin original (na planta) pelo id → {pin, plantaIdx, pinIdx} ou null. Só busca em state.plantas.
export function pinOriginal(id){
  if(!id) return null;
  const plantas = state.plantas || [];
  for(let plantaIdx=0; plantaIdx<plantas.length; plantaIdx++){
    const pins = plantas[plantaIdx].pins || [];
    for(let pinIdx=0; pinIdx<pins.length; pinIdx++){
      if(pins[pinIdx].id===id) return {pin: pins[pinIdx], plantaIdx, pinIdx};
    }
  }
  return null;
}

// Campos que uma referência lê do pin original (nunca gravados na própria ref).
const CAMPOS_ORIGINAL = ['tipoId', 'label', 'qtd', 'altura'];

// Define accessors não-enumeráveis (fora do JSON.stringify) que leem do original:
// tipoId/label/qtd só leitura; altura lê e grava no original. Idempotente.
export function vincularRef(ref){
  CAMPOS_ORIGINAL.forEach(k=>{
    const d = Object.getOwnPropertyDescriptor(ref, k);
    if(d && 'value' in d) delete ref[k]; // valor gravado (ex.: vindo de .json) é descartado
  });
  const orig = ()=>pinOriginal(ref.ref)?.pin;
  const def = (k, get, set)=>Object.defineProperty(ref, k, {get, set, enumerable:false, configurable:true});
  def('tipoId', ()=>orig()?.tipoId || 'outro');
  def('label', ()=>orig()?.label ?? '');
  def('qtd', ()=>orig()?.qtd ?? 1);
  def('altura', ()=>orig()?.altura, v=>{ const o = orig(); if(o) o.altura = v; });
  return ref;
}

// Nova referência a um pin da planta, já vinculada; direção inicial copiada do original.
export function novaRef(pinId, x, y){
  const o = pinOriginal(pinId)?.pin;
  return vincularRef({id: novoId(), ref: pinId, x, y, direcao: o?.direcao ?? 0});
}

// Remove de todas as vistas as referências cujo original não existe; revincula as demais.
export function limparRefsOrfas(){
  let removidos = 0;
  (state.aereas || []).forEach(v=>{
    if(!Array.isArray(v.pins)) return;
    v.pins = v.pins.filter(p=>{
      if(!p.ref) return true;
      if(!pinOriginal(p.ref)){ removidos++; return false; }
      vincularRef(p);
      return true;
    });
  });
  return removidos;
}

// Ids dos pins originais já colocados nesta vista.
export function refsColocadas(vista){
  return new Set((vista?.pins || []).filter(p=>p.ref).map(p=>p.ref));
}

// Metros por pixel de tile Web Mercator (256px) na latitude e zoom dados.
export function metrosPorPixel(lat, z){
  return 156543.03392 * Math.cos(lat*Math.PI/180) / Math.pow(2, z);
}

// Latitude de uma coordenada y em pixels de mundo Web Mercator (tiles de 256px) no zoom z.
export function latDoPixelY(y, z){
  const n = Math.PI * (1 - 2*y/(256*Math.pow(2, z)));
  return Math.atan(Math.sinh(n)) * 180/Math.PI;
}

// Escala no formato das plantas: linha horizontal no meio, de 10% a 90% da largura.
export function escalaCaptura(larguraPx, mpp){
  return { a:{x:10, y:50}, b:{x:90, y:50}, metros: 0.8*larguraPx*mpp, metrosLargura: larguraPx*mpp };
}

// "lat, lng" ou "lat lng" com ponto decimal (como o Google Maps copia) → {lat, lng} ou null.
export function lerCoordenadas(str){
  const m = /^\s*([+-]?\d+(?:\.\d+)?)\s*(?:,\s*|\s+)([+-]?\d+(?:\.\d+)?)\s*$/.exec(String(str ?? ''));
  if(!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  if(!(lat>=-90 && lat<=90 && lng>=-180 && lng<=180)) return null;
  return {lat, lng};
}
