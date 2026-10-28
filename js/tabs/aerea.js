// Vista aérea no editor (aba 02 · Planta): tudo que difere de uma planta quando state.planta.aerea.
// planta.js delega para cá (como faz com areas.js, muros.js…). Vista sem imagem (ou em "Trocar
// imagem") mostra o mapa de satélite (Leaflet + Esri) com busca, Capturar e upload próprio.
import { state, novaAerea, limparPlanta } from '../state.js';
import { ICONS } from '../constants.js';
import { typeById, escHtml, showToast } from '../utils.js';
import { pontosPorTipo, numeroDoPinEm } from '../numeracao.js';
import { novaRef, refsColocadas, pinOriginal, TILE_URL, CREDITO_ESRI, MAPA_ZOOM_MAX, CAPTURA_MAX, metrosPorPixel, escalaCaptura, lerCoordenadas, latDoPixelY } from '../aerea.js';
import { renderContent, resetRolagem } from '../nav.js';
import { cancelarTraco, tplControlesFoco } from './planta.js';

// Ferramentas de desenho que continuam valendo na vista (além dos itens de cenário)
export const FERRAMENTAS_VISTA = ['area', 'etiqueta', 'muro', 'escala'];

export function temConteudoVista(v){
  return !!(v && ((v.pins||[]).length || (v.areas||[]).length || (v.etiquetas||[]).length || (v.cercas||[]).length || v.escala));
}

// ---------- mini-abas ----------
export function selectAerea(i){
  if(i===state.aereaAtiva || !state.aereas[i]) return;
  cancelarTraco();
  state.aereaAtiva = i;
  renderContent();
}
export function addAerea(){
  cancelarTraco();
  state.aereas.push(novaAerea('Vista aérea '+(state.aereas.length+1)));
  state.aereaAtiva = state.aereas.length-1;
  renderContent();
}
export function removeAerea(i){
  const v = state.aereas[i];
  if(!v) return;
  const temConteudo = v.imagem || temConteudoVista(v) || (v.muros||[]).length;
  if(temConteudo && !confirm(`Excluir a vista aérea "${v.nome||('Vista aérea '+(i+1))}" e tudo que está nela?`)) return;
  cancelarTraco();
  state.aereas.splice(i, 1);
  state.aereaAtiva = null; // volta para a planta ativa
  renderContent();
}

// Abas das vistas (depois das plantas) + botão de adicionar
export function tplAbasVistas(){
  return state.aereas.map((v,i)=>`
          <button class="planta-tab aerea ${i===state.aereaAtiva?'active':''}" onclick="selectAerea(${i})">🛰 ${escHtml(v.nome||('Vista aérea '+(i+1)))}</button>`).join('');
}

// ---------- imagem de fundo: mapa de satélite / troca ----------
let mapa = null;   // instância Leaflet viva (no máx. uma; destruída a cada renderContent)
let troca = null;  // vista em "Trocar imagem" (mostra o mapa mesmo já tendo imagem)
let resultadosBusca = [];   // últimos resultados do Nominatim…
let resultadosPl = null;    // …e a vista a que pertencem (sobrevivem a renderContent)
let resultadoAtivo = -1;
let buscando = false;
let vistaMapa = null;       // último enquadramento do mapa {pl, lat, lng, zoom} (atualizado no moveend)
let avisouSemMapa = false;  // toast "Mapa indisponível" só uma vez por sessão
let capturaId = 0;          // token da captura em andamento (uma mais nova ou mudança de tela descarta a anterior)

// Enquadramento inicial do mapa: o último visto nesta vista (sobrevive a renderContent),
// senão o salvo na captura (pl.mapa), senão o Brasil.
export function vistaInicial(pl){
  if(vistaMapa && vistaMapa.pl===pl) return {lat: vistaMapa.lat, lng: vistaMapa.lng, zoom: vistaMapa.zoom};
  if(pl?.mapa) return {lat: pl.mapa.lat, lng: pl.mapa.lng, zoom: pl.mapa.zoom};
  return {lat:-15.8, lng:-47.9, zoom:4};
}
export function lembrarVista(pl, lat, lng, zoom){ vistaMapa = {pl, lat, lng, zoom}; }

// Resultados da busca de uma vista (gravados para re-render)
export function definirResultados(pl, lista){
  resultadosPl = pl;
  resultadosBusca = Array.isArray(lista) ? lista.slice(0, 5) : [];
  resultadoAtivo = -1;
}
export function tplResultados(pl){
  if(resultadosPl!==pl) return '';
  if(!resultadosBusca.length) return '<div class="hint" style="margin:0;">Nenhum resultado. Tente outro termo ou cole as coordenadas (lat, long).</div>';
  return resultadosBusca.map((it,i)=>`<button class="mapa-resultado ${i===resultadoAtivo?'active':''}" onclick="irParaResultado(${i})">${escHtml(it.display_name||'')}</button>`).join('');
}

// A vista mostra o mapa (em vez do editor) quando não tem imagem ou está trocando a imagem
export function mostrandoMapa(pl){
  return !!pl?.aerea && (!pl.imagem || troca===pl);
}
export function fimTrocaImagem(){ troca = null; }
export function trocarImagemAerea(){
  if(!state.planta?.aerea) return;
  cancelarTraco();
  troca = state.planta;
  resetRolagem();
  renderContent();
}
export function cancelarTrocaImagem(){ troca = null; renderContent(); }

// Vista com imagem: botão "Trocar imagem" (+ crédito quando veio do mapa). Na tela do mapa, nada.
export function tplVistaImagem(pl){
  if(mostrandoMapa(pl)) return '';
  return `
      <div class="vista-imagem-bar">
        <button class="btn ghost small" onclick="trocarImagemAerea()">🛰 Trocar imagem</button>
        <span class="hint" style="margin:0;">${pl.fonte==='mapa' ? escHtml(CREDITO_ESRI)+' · escala definida pela captura' : 'Imagem enviada'}</span>
      </div>`;
}

// Tela do mapa: busca, ações (Capturar, Enviar imagem própria, Cancelar na troca) e o mapa.
// As ações ficam acima do mapa para Capturar estar sempre à vista (o mapa é alto).
export function tplMapaAereo(pl){
  const temL = !!window.L;
  return `
      <label>Imagem aérea (imagem ou PDF)</label>
      ${temL ? `
      <div class="mapa-busca">
        <input type="text" id="mapaBusca" placeholder="Endereço, cidade ou coordenadas (ex.: -22.6029, -48.8031)" onkeydown="if(event.key==='Enter'){event.preventDefault();buscarLocal();}">
        <button class="btn primary small" id="mapaBuscarBtn" onclick="buscarLocal()">Buscar</button>
      </div>
      <div id="mapaResultados" class="mapa-resultados">${tplResultados(pl)}</div>` : `
      <div class="mapa-aviso">Mapa de satélite indisponível (sem conexão?). Envie uma imagem própria: print do Google Earth/Maps, foto de drone ou PDF.</div>`}
      <div class="mapa-acoes">
        ${temL ? `<button class="btn primary" id="mapaCapturarBtn" onclick="capturarMapa()">📷 Capturar</button>` : ''}
        <label class="btn ghost mapa-upload">⬆ Enviar imagem própria
          <input type="file" accept="image/*,application/pdf,.pdf" onchange="handlePlantaUpload(event)" style="display:none;">
        </label>
        ${pl.imagem ? `<button class="btn ghost" onclick="cancelarTrocaImagem()">Cancelar</button>` : ''}
        <span class="hint" style="margin:0;">${temL ? 'Enquadre o local e clique em Capturar: a imagem vira o fundo da vista já com a escala. ' : ''}Imagem própria: print do Google Earth/Maps, foto de drone ou PDF (sem escala — use 📏 Escala).</span>
      </div>
      ${temL ? `<div id="mapaAereo"></div>` : ''}`;
}

export function destruirMapa(){
  if(mapa){ try{ mapa.remove(); }catch(e){ /* container já saiu do DOM */ } mapa = null; }
}
// Chamado por afterPlantaRender: cria o mapa no #mapaAereo quando a vista mostra o mapa
export function montarMapa(){
  destruirMapa();
  const pl = state.planta;
  if(!mostrandoMapa(pl)) return;
  if(!window.L){
    if(!avisouSemMapa){ avisouSemMapa = true; showToast('Mapa indisponível (sem conexão?). Envie uma imagem própria.'); }
    return;
  }
  const el = document.getElementById('mapaAereo');
  if(!el) return;
  const L = window.L;
  mapa = L.map(el, {zoomSnap:1, maxZoom:MAPA_ZOOM_MAX});
  L.tileLayer(TILE_URL, {maxZoom:MAPA_ZOOM_MAX, attribution:CREDITO_ESRI, crossOrigin:'anonymous'}).addTo(mapa);
  const c = vistaInicial(pl);
  mapa.setView([c.lat, c.lng], c.zoom);
  mapa.invalidateSize();
  const m = mapa;
  mapa.on('moveend', ()=>{ if(m===mapa){ const ce = m.getCenter(); lembrarVista(pl, ce.lat, ce.lng, m.getZoom()); } });
}
export const mapaAtual = ()=>mapa;

// Busca: coordenadas coladas saltam direto (sem rede); senão 1 requisição ao Nominatim por clique
export async function buscarLocal(){
  const inp = document.getElementById('mapaBusca');
  if(!inp || !mapa) return;
  const q = inp.value.trim();
  if(!q) return;
  const pl = state.planta;
  const box = document.getElementById('mapaResultados');
  const c = lerCoordenadas(q);
  if(c){ resultadosPl = null; if(box) box.innerHTML = ''; mapa.setView([c.lat, c.lng], 18); return; }
  if(buscando) return;
  buscando = true;
  const btn = document.getElementById('mapaBuscarBtn');
  if(btn) btn.disabled = true;
  try{
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=pt-BR&q='+encodeURIComponent(q);
    const r = await fetch(url, {headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const lista = await r.json();
    definirResultados(pl, lista);
    const box2 = document.getElementById('mapaResultados');
    if(!box2 || !mapa || state.planta!==pl) return; // a tela trocou durante a busca
    box2.innerHTML = tplResultados(pl);
    if(resultadosBusca.length) irParaResultado(0);
  }catch(e){
    console.error(e);
    showToast('Busca indisponível. Cole as coordenadas (lat, long) do Google Maps.');
  }finally{
    buscando = false;
    const b2 = document.getElementById('mapaBuscarBtn');
    if(b2) b2.disabled = false;
  }
}
export function irParaResultado(i){
  const it = resultadosBusca[i];
  if(!it || !mapa) return;
  resultadoAtivo = i;
  document.querySelectorAll('.mapa-resultado').forEach((b,j)=>b.classList.toggle('active', j===i));
  const bb = (it.boundingbox||[]).map(Number); // [sul, norte, oeste, leste]
  if(bb.length===4 && bb.every(Number.isFinite)) mapa.fitBounds([[bb[0], bb[2]], [bb[1], bb[3]]], {maxZoom:18});
  else mapa.setView([+it.lat, +it.lon], 17);
}

// Carrega um tile com CORS (sem isso o canvas fica "sujo" e toDataURL falha)
function carregarTile(url){
  return new Promise((res, rej)=>{
    const im = new Image();
    im.crossOrigin = 'anonymous';
    const t = setTimeout(()=>rej(new Error('tempo esgotado: '+url)), 20000);
    im.onload = ()=>{ clearTimeout(t); res(im); };
    im.onerror = ()=>{ clearTimeout(t); rej(new Error('falha no tile: '+url)); };
    im.src = url;
  });
}

// Tile "Map data not yet available" da Esri: quase todo cinza #CCCCCC (com texto branco).
// Medido: 94% dos pixels exatamente 204,204,204 e 97,6% a ±6. Tile inteiro (256×256), cinza neutro
// a ±3 de 204 em >90% dos pixels — foto real (pátio de concreto, telhado) tem ruído e não passa.
// (Lança se o tile sujou o canvas.)
const amostra = document.createElement('canvas');
amostra.width = amostra.height = 256;
export function tileSemDados(img){
  const g = amostra.getContext('2d', {willReadFrequently:true});
  g.clearRect(0, 0, 256, 256);
  g.drawImage(img, 0, 0, 256, 256);
  const d = g.getImageData(0, 0, 256, 256).data;
  let n = 0;
  for(let i=0; i<d.length; i+=4){
    if(Math.abs(d[i]-204)<=3 && Math.abs(d[i+1]-204)<=3 && Math.abs(d[i+2]-204)<=3) n++;
  }
  return n > 0.9*65536;
}

// Monta a captura: bounds em pixels de mundo no zoom z ({x0,y0,x1,y1}); desenha os tiles de z
// num canvas (reduzido se o lado passar de CAPTURA_MAX). carregar(url) → Promise<imagem/canvas>
// é injetável (testes sem rede). Algum tile falhou → null. Canvas sujo (CORS) → lança.
// semDados = quantos tiles vieram como "Map data not yet available".
export async function montarCaptura(bounds, z, carregar = carregarTile){
  const x0 = Math.round(bounds.x0), y0 = Math.round(bounds.y0);
  const w = Math.round(bounds.x1 - bounds.x0), h = Math.round(bounds.y1 - bounds.y0);
  if(!(w>0 && h>0)) return null;
  const lado = Math.max(w, h);
  const f = lado > CAPTURA_MAX ? CAPTURA_MAX/lado : 1;
  const largura = Math.max(1, Math.round(w*f)), altura = Math.max(1, Math.round(h*f));
  const n = Math.pow(2, z);
  const tiles = [];
  for(let ty=Math.floor(y0/256); ty<=Math.floor((y0+h-1)/256); ty++){
    if(ty<0 || ty>=n) continue;
    for(let tx=Math.floor(x0/256); tx<=Math.floor((x0+w-1)/256); tx++){
      const xw = ((tx % n) + n) % n; // dá a volta no antimeridiano
      tiles.push({tx, ty, url: TILE_URL.replace('{z}', z).replace('{y}', ty).replace('{x}', xw)});
    }
  }
  if(!tiles.length) return null;
  const res = await Promise.allSettled(tiles.map(t=>carregar(t.url)));
  if(res.some(r=>r.status!=='fulfilled')) return null;
  const semDados = res.filter(r=>tileSemDados(r.value)).length;
  const cv = document.createElement('canvas');
  cv.width = largura; cv.height = altura;
  const g = cv.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, largura, altura);
  g.scale(largura/w, altura/h);
  res.forEach((r, i)=>{
    const t = tiles[i];
    g.drawImage(r.value, t.tx*256 - x0, t.ty*256 - y0, 256, 256);
  });
  const dataURL = cv.toDataURL('image/jpeg', 0.9); // lança SecurityError se algum tile sujou o canvas
  const mpp = metrosPorPixel(latDoPixelY(y0 + h/2, z), z) * (w/largura);
  return { dataURL, largura, altura, mpp, semDados };
}

// Captura em zc (mais nítido); se algum tile não tem imagem nesse zoom (comum em z19 fora das
// capitais), refaz no zoom do mapa z. bounds em pixels de mundo no zoom zc. → resultado + {zoom}
export async function capturaComZoom(bounds, z, zc, carregar = carregarTile){
  let r = await montarCaptura(bounds, zc, carregar);
  if(r && r.semDados>0 && zc>z){
    const k = Math.pow(2, zc - z);
    const r2 = await montarCaptura({x0: bounds.x0/k, y0: bounds.y0/k, x1: bounds.x1/k, y1: bounds.y1/k}, z, carregar);
    if(r2) return {...r2, zoom: z};
  }
  return r ? {...r, zoom: zc} : null;
}

// Capturar: tiles um nível acima do zoom do mapa (mais nítido), cobrindo o enquadramento visível
export async function capturarMapa(){
  const pl = state.planta;
  if(!mapa || !pl?.aerea) return;
  if(temConteudoVista(pl) && !confirm('Trocar a imagem apaga o que está posicionado nesta vista (muros ficam). Continuar?')) return;
  const z = Math.round(mapa.getZoom());
  const zc = Math.min(z+1, MAPA_ZOOM_MAX);
  const k = Math.pow(2, zc - z);
  const pb = mapa.getPixelBounds();
  const centro = mapa.getCenter();
  const bounds = {x0: pb.min.x*k, y0: pb.min.y*k, x1: pb.max.x*k, y1: pb.max.y*k};
  const restaura = ()=>{ const b = document.getElementById('mapaCapturarBtn'); if(b){ b.disabled = false; b.textContent = '📷 Capturar'; } };
  const btn = document.getElementById('mapaCapturarBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Capturando…'; }
  const meu = ++capturaId;
  // ainda vale? (sem captura mais nova, mesma vista ativa e ainda na tela do mapa)
  const valida = ()=>meu===capturaId && state.planta===pl && mostrandoMapa(pl);
  let r;
  try{
    r = await capturaComZoom(bounds, z, zc);
  }catch(e){
    console.error(e);
    if(!valida()) return;
    showToast('O servidor de satélite bloqueou a captura. Envie uma imagem própria.');
    restaura(); return;
  }
  if(!valida()) return; // a vista mudou durante o download (troca de vista, upload, exclusão…): descarta
  if(!r){
    showToast('Não foi possível carregar as imagens de satélite. Verifique a conexão e tente de novo.');
    restaura(); return;
  }
  limparPlanta(pl);
  pl.imagem = r.dataURL;
  pl.escala = escalaCaptura(r.largura, r.mpp);
  pl.fonte = 'mapa';
  pl.mapa = {lat: centro.lat, lng: centro.lng, zoom: z};
  troca = null;
  resetRolagem();
  renderContent();
  showToast(r.semDados ? 'Imagem capturada com escala, mas parte da área não tem foto de satélite nesse zoom. Afaste o zoom e capture de novo.' : 'Imagem capturada com escala.');
}

// ---------- equipamentos da planta (referências) ----------
const nomePlanta = i=>state.plantas[i]?.nome || ('Planta '+(i+1));

// Botão "Equipamentos da planta" + painel (por clique, como o Inserir) agrupado por tipo
export function tplEquipPlanta(pl){
  const colocados = refsColocadas(pl);
  const grupos = pontosPorTipo();
  const armado = (pl.selectedTipo||'').startsWith('ref:') ? pinOriginal(pl.selectedTipo.slice(4)) : null;
  const tArm = armado ? typeById(armado.pin.tipoId) : null;
  return `
    <div class="inserir-wrap equip-wrap">
      <button class="type-btn inserir-btn" onclick="toggleMenuEquip()">📍 Equipamentos da planta ▾</button>
      <div id="menuEquip" class="inserir-menu">
        ${grupos.length ? grupos.map(g=>`
          <div class="inserir-sec">
            <div class="inserir-titulo">${g.tipo.label}</div>
            <div class="inserir-itens">
              ${g.pontos.map(pt=>{ const ja = colocados.has(pt.pin.id); return `
                <button class="type-btn ${ja?'colocado':''}" data-ref="${escHtml(pt.pin.id)}" ${ja?'disabled title="Já está nesta vista"':''} onclick="selectRef('${escHtml(pt.pin.id)}')">
                  <span class="icon-dot" style="background:${g.tipo.color}">${ICONS[g.tipo.id]}</span>${g.tipo.label} ${pt.numero} · ${escHtml(nomePlanta(pt.plantaIdx))}${ja?' ✓':''}
                </button>`; }).join('')}
            </div>
          </div>`).join('') : `<div class="hint">Nenhum equipamento posicionado nas plantas ainda. Equipamentos nascem na planta.</div>`}
      </div>
    </div>
    ${armado ? `<span class="type-btn active equip-atual" onclick="toggleMenuEquip()" title="Toque na imagem para posicionar"><span class="icon-dot" style="background:${tArm.color}">${ICONS[tArm.id]}</span>${tArm.label} ${numeroDoPinEm(state.plantas[armado.plantaIdx], armado.pinIdx)} — toque na imagem</span>` : ''}`;
}
export function toggleMenuEquip(){
  document.getElementById('menuInserir')?.classList.remove('open');
  document.getElementById('menuEquip')?.classList.toggle('open');
}
document.addEventListener('pointerdown', e=>{
  const m = document.getElementById('menuEquip');
  if(m && m.classList.contains('open') && !e.target.closest('.equip-wrap, .equip-atual')) m.classList.remove('open');
});
export function selectRef(pinId){
  cancelarTraco();
  state.planta.selectedTipo = 'ref:'+pinId;
  renderContent();
}
// Clique na imagem com uma referência armada: coloca o equipamento (uma vez por vista) e desarma
export function criarRefNoClique(x, y){
  const pl = state.planta;
  const id = (pl.selectedTipo||'').startsWith('ref:') ? pl.selectedTipo.slice(4) : null;
  pl.selectedTipo = 'nenhum';
  if(id && pinOriginal(id) && !refsColocadas(pl).has(id)) pl.pins.push(novaRef(id, x, y));
  renderContent();
}
export function removeRef(pi){
  state.planta.pins.splice(pi, 1);
  renderContent();
}
// Linha da lista para uma referência: tipo/número/rótulo só leitura; foco próprio da vista
export function tplRefRow(p, pi){
  const pl = state.planta, t = typeById(p.tipoId), o = pinOriginal(p.ref);
  return `
          <div class="pinrow pinrow-ref">
            <span class="icon-dot" style="background:${t.color}">${ICONS[t.id]}</span>
            <b style="font-size:12px;color:var(--text-mid);width:18px;">${numeroDoPinEm(pl, pi)}</b>
            <span style="flex:1;min-width:140px;font-size:13px;">${t.label} — ${escHtml(p.label)}${o ? ` <span style="color:var(--text-mid);font-size:11px;">· ${escHtml(nomePlanta(o.plantaIdx))}</span>` : ''}</span>
            ${tplControlesFoco(p, pi, pl)}
            <button class="btn danger small" title="Remover desta vista" onclick="removeRef(${pi})">✕</button>
          </div>`;
}
