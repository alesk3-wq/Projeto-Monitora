// Geometria dos muros e da visão das câmeras — funções puras, usadas pelo editor (planta.js/muros.js),
// pelo Mapeamento do PDF e pelo recorte da ficha. Pontos dos muros em % da imagem; cálculos em px
// (W×H = tamanho em que a planta está desenhada), porque % não é isotrópico.

// Tipos de cenário que "grudam" num muro quando colocados perto dele
export const ABERTURAS_MURO = ['portao', 'porta', 'janela'];

// Segmentos dos muros em px ([{x,y},{x,y}]), deslocados por (ox,oy); muro fechado inclui o lado de volta
export function segmentosMuros(pl, W, H, ox=0, oy=0){
  const segs = [];
  (pl.muros||[]).forEach(m=>{
    const P = m.pontos.map(p=>({x: ox + p.x/100*W, y: oy + p.y/100*H}));
    for(let i=0;i<P.length-1;i++) segs.push([P[i], P[i+1]]);
    if(m.fechado && P.length>2) segs.push([P[P.length-1], P[0]]);
  });
  return segs;
}

// Distância (px) do raio que sai de (cx,cy) no ângulo deg (0 = norte, horário) até o primeiro muro.
// Ignora acertos a menos de 1px (câmera instalada em cima da própria parede).
function distRaio(cx, cy, deg, segs){
  const r = deg*Math.PI/180, dx = Math.sin(r), dy = -Math.cos(r);
  let best = Infinity;
  for(const [a,b] of segs){
    const ex = b.x-a.x, ey = b.y-a.y;
    const den = dx*ey - dy*ex;
    if(Math.abs(den) < 1e-9) continue;
    const ax = a.x-cx, ay = a.y-cy;
    const t = (ax*ey - ay*ex)/den, u = (ax*dy - ay*dx)/den;
    if(t > 1 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}

// Polígono de visão (px absolutos): setor de raio L entre a0 e a1 (graus) — ou círculo inteiro com
// cheio=true, sem o vértice central — cortado pelos muros. Retorna null quando nenhum muro corta:
// quem chama desenha o setor/círculo normal (arco perfeito).
export function poligonoVisao(cx, cy, L, a0, a1, segs, cheio=false){
  if(!segs.length) return null;
  const angs = [];
  for(let a=a0; a<a1; a+=1) angs.push(a);
  angs.push(a1);
  // raios rentes aos cantos dos muros, para a sombra começar exatamente no canto
  for(const [p,q] of segs) for(const v of [p,q]){
    if(Math.hypot(v.x-cx, v.y-cy) >= L) continue;
    const ang = a0 + (((Math.atan2(v.x-cx, -(v.y-cy))*180/Math.PI - a0) % 360) + 360) % 360;
    if(ang > a1) continue; // canto fora do setor
    if(ang - 0.05 >= a0) angs.push(ang - 0.05);
    if(ang + 0.05 <= a1) angs.push(ang + 0.05);
  }
  angs.sort((x,y)=>x-y);
  let cortou = false;
  const pts = angs.map(a=>{
    let d = distRaio(cx, cy, a, segs);
    if(d < L) cortou = true; else d = L;
    const r = a*Math.PI/180;
    return {x: cx + d*Math.sin(r), y: cy - d*Math.cos(r)};
  });
  if(!cortou) return null;
  return cheio ? pts : [{x:cx, y:cy}, ...pts];
}

// Path SVG de um polígono, com os pontos deslocados por (ox,oy)
export function poligonoPath(pts, ox=0, oy=0){
  return pts.map((p,i)=>`${i?'L':'M'}${(p.x+ox).toFixed(1)},${(p.y+oy).toFixed(1)}`).join(' ') + ' Z';
}

// Segmento de muro mais próximo de (x,y)% dentro de limitePx (medido em px de W×H) → {muroId, seg, t, d} ou null
export function muroMaisProximo(pl, x, y, W, H, limitePx){
  let best = null;
  const px = x/100*W, py = y/100*H;
  (pl.muros||[]).forEach(m=>{
    const n = m.pontos.length, nseg = m.fechado && n>2 ? n : n-1;
    for(let i=0;i<nseg;i++){
      const a = m.pontos[i], b = m.pontos[(i+1)%n];
      const ax = a.x/100*W, ay = a.y/100*H, ex = b.x/100*W - ax, ey = b.y/100*H - ay;
      const L2 = ex*ex + ey*ey;
      const t = L2 ? Math.max(0, Math.min(1, ((px-ax)*ex + (py-ay)*ey)/L2)) : 0;
      const d = Math.hypot(px - (ax + t*ex), py - (ay + t*ey));
      if(d <= limitePx && (!best || d < best.d)) best = {muroId:m.id, seg:i, t, d};
    }
  });
  return best;
}

// Abertura (portão/porta/janela) presa a um muro: posição (%) e ângulo da parede (graus, em px de W×H).
// null se o pin não é abertura, não está preso, ou o muro/segmento não existe mais.
export function geomNoMuro(pin, pl, W=1, H=1){
  if(!pin.muroId || !ABERTURAS_MURO.includes(pin.tipoId)) return null;
  const m = (pl.muros||[]).find(mm=>mm.id===pin.muroId);
  if(!m) return null;
  const n = m.pontos.length, i = pin.seg;
  if(!(i>=0) || i >= (m.fechado && n>2 ? n : n-1)) return null;
  const a = m.pontos[i], b = m.pontos[(i+1)%n], t = pin.t||0;
  return {x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t, ang: Math.atan2((b.y-a.y)*H, (b.x-a.x)*W)*180/Math.PI};
}

// Prende (ou solta) a abertura no muro mais próximo; atualiza x,y quando presa
export function encaixarNoMuro(pin, pl, W, H, limitePx=16){
  if(!ABERTURAS_MURO.includes(pin.tipoId)) return;
  const s = muroMaisProximo(pl, pin.x, pin.y, W, H, limitePx);
  if(s){
    pin.muroId = s.muroId; pin.seg = s.seg; pin.t = s.t;
    const g = geomNoMuro(pin, pl);
    pin.x = g.x; pin.y = g.y;
  } else {
    delete pin.muroId; delete pin.seg; delete pin.t;
  }
}

// Depois de mexer num muro: aberturas presas acompanham a parede
export function sincronizarAberturas(pl){
  pl.pins.forEach(p=>{ const g = geomNoMuro(p, pl); if(g){ p.x = g.x; p.y = g.y; } });
}
