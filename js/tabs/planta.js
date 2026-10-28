import { state, novaPlanta, limparPlanta, temVistaAtiva } from '../state.js';
import { numeroDoPinEm } from '../numeracao.js';
import { limparRefsOrfas, refsDaPlanta } from '../aerea.js';
import { tplAbasVistas, tplVistaImagem, tplMapaAereo, mostrandoMapa, montarMapa, fimTrocaImagem, tplEquipPlanta, tplRefRow, criarRefNoClique, temConteudoVista, FERRAMENTAS_VISTA } from './aerea.js';
import { EQUIP_TYPES, ICONS, CATEGORIAS_INSERIR } from '../constants.js';
import { typeById, fileToDataURL, showToast, novoId, alcanceDe, ALCANCE_MIN, ALCANCE_MAX, aberturaDe, fixarAbertura, setorPath, pontoNaDirecao, ABERTURA_MIN, ABERTURA_MAX } from '../utils.js';
import { renderContent, resetRolagem } from '../nav.js';
import { tplAreaPalette, tplAreaRows, renderAreas, startAreaDraw, areaDragAtivo, cancelAreaDraw } from './areas.js';
import { isPdfFile, handlePlantaPdfUpload } from './plantaPdf.js';
import { novaEtiqueta, tplEtiquetaRows, renderEtiquetas, etiquetaDragAtivo, etiquetaSuprimeClique, encaixarEtiqueta, ETQ_COR } from './etiquetas.js';
import { tplMuroBar, tplMuroRows, renderMuros, muroClique, muroDragAtivo, cancelarTracoMuro } from './muros.js';
import { tplEscalaBar, tplEscalaStatus, escalaClique, renderEscala, cancelarEscala } from './escalaTool.js';
import { pxPorMetro, temEscala, alcanceMDe, alturaDe, cegoDoPin, fmtM, ALCANCE_M_MIN, ALCANCE_M_MAX, ALTURA_MIN, ALTURA_MAX, COR_CEGO } from '../escala.js';
import { segmentosMuros, poligonoVisao, poligonoPath, geomNoMuro, encaixarNoMuro, ABERTURAS_MURO } from '../visao.js';

export function tplPlanta(){
  limparRefsOrfas(); // referências cujo original foi excluído somem das vistas aéreas
  const pl = state.planta;
  const vista = !!pl.aerea;
  const naTelaMapa = mostrandoMapa(pl); // vista sem imagem ou trocando a imagem: mapa em vez do editor
  return `
    <h1 class="pagetitle">02 · Planta / Mapeamento</h1>
    <p class="pagesub">${vista ? 'Busque o local no mapa de satélite e capture, ou envie uma imagem aérea própria; depois posicione os equipamentos da planta e ajuste o foco de cada câmera nesta vista.' : `Envie a planta baixa, escolha o tipo de equipamento e clique para posicionar. Depois é só arrastar o ícone para reposicionar, e (para câmeras) arrastar o ponto branco ao redor dele para girar a direção de visualização (em Bullet e Dome, afastar ou aproximar o ponto do ícone aumenta ou encurta o alcance do foco, e os pontos nas bordas do arco abrem ou fecham cada lado do foco).`}</p>
    <div class="card">
      <div class="planta-tabs">
        ${state.plantas.map((pt,i)=>`
          <button class="planta-tab ${i===state.plantaAtiva && !temVistaAtiva()?'active':''}" onclick="selectPlanta(${i})">${pt.nome||('Planta '+(i+1))}</button>`).join('')}
        ${tplAbasVistas()}
        <button class="planta-tab add" onclick="addPlanta()">+ Nova planta</button>
        <button class="vista-add" onclick="addAerea()">+ Vista aérea</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <label style="margin:0;">${vista ? 'Nome da vista' : 'Nome da planta'}</label>
        <input type="text" style="width:220px;margin:0;" value="${pl.nome||''}" oninput="state.planta.nome=this.value" onchange="renderContent()">
        ${vista ? `<button class="btn danger small" onclick="removeAerea(${state.aereaAtiva})">Excluir vista</button>`
          : state.plantas.length>1 ? `<button class="btn danger small" onclick="removePlanta(${state.plantaAtiva})">Excluir planta</button>` : ''}
      </div>
      ${vista ? tplVistaImagem(pl) : `
      <label>Planta baixa (imagem ou PDF)</label>
      <input type="file" accept="image/*,application/pdf,.pdf" onchange="handlePlantaUpload(event)" style="margin-bottom:4px;">
      <div class="hint">PDF com mais de uma página: você escolhe qual usar.</div>`}
      ${naTelaMapa ? tplMapaAereo(pl) : `
      <div class="toolbar-types">
        ${tplMenuInserir(pl)}
        ${vista ? tplEquipPlanta(pl) : ''}
        <button class="type-btn ${pl.selectedTipo==='area'?'active':''}" onclick="selectTipo('area')">
          <span class="icon-dot" style="background:#5A6B82">▧</span>Demarcar Área
        </button>
        <button class="type-btn ${pl.selectedTipo==='etiqueta'?'active':''}" onclick="selectTipo('etiqueta')">
          <span class="icon-dot" style="background:${ETQ_COR}">🏷</span>Etiqueta
        </button>
        <button class="type-btn ${pl.selectedTipo==='escala'?'active':''}" onclick="selectTipo('escala')">
          <span class="icon-dot" style="background:#0B7285">📏</span>Escala
        </button>
      </div>
      ${pl.imagem ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <button class="btn ghost small" onclick="zoomPlanta(-20)">➖ Zoom</button>
        <span id="zoomLabel" style="font-size:13px;font-weight:700;min-width:44px;text-align:center;">${pl.zoom||100}%</span>
        <button class="btn ghost small" onclick="zoomPlanta(20)">➕ Zoom</button>
        <button class="btn ghost small" onclick="resetZoom()">Resetar</button>
        ${tplEscalaStatus()}
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
      ${pl.selectedTipo==='muro' && pl.imagem ? tplMuroBar() : ''}
      ${pl.selectedTipo==='escala' && pl.imagem ? tplEscalaBar() : ''}
      ${pl.selectedTipo==='area' && pl.imagem ? tplAreaPalette() : ''}
      <div id="plantaScroll" class="${pl.selectedTipo==='area' ? 'modo-area' : ''}">
        ${pl.imagem
          ? `<div id="plantaWrap" style="position:relative;width:${pl.zoom||100}%;">
               <img id="plantaImg" src="${pl.imagem}">
             </div>`
          : `<div class="empty-hint">${vista ? 'Capture o local no mapa de satélite ou envie uma imagem aérea própria para começar.' : 'Envie uma imagem da planta baixa para começar a posicionar os equipamentos.'}</div>`}
      </div>`}
      <div class="pinlist">
        ${(pl.pins.length===0 && pl.cercas.length===0 && pl.areas.length===0 && pl.etiquetas.length===0 && !(pl.muros||[]).length) ? `<div class="hint">${vista ? 'Nada posicionado nesta vista ainda.' : 'Nenhum equipamento posicionado ainda.'}</div>` : pl.pins.map((p,pi)=> p.ref ? tplRefRow(p, pi) : `
          <div class="pinrow">
            <span class="icon-dot" style="background:${typeById(p.tipoId).color}">${ICONS[p.tipoId]}</span>
            <b style="font-size:12px;color:var(--text-mid);width:18px;">${typeById(p.tipoId).cenario ? '' : numeroDoPinEm(pl, pi)}</b>
            <select onchange="state.planta.pins[${pi}].tipoId=this.value; renderContent();">
              ${CATEGORIAS_INSERIR.map(c=>{
                const ops = c.tipos.filter(id=>((id!=='cerca' && id!=='muro') || p.tipoId===id) && (!pl.aerea || typeById(id).cenario)); // na vista só cenário
                return ops.length ? `<optgroup label="${c.label}">${ops.map(id=>`<option value="${id}" ${id===p.tipoId?'selected':''}>${typeById(id).label}</option>`).join('')}</optgroup>` : '';
              }).join('')}
            </select>
            <input type="text" style="flex:1;min-width:140px;" placeholder="Rótulo (ex: Monitoramento bombas/Pit)" value="${p.label}" oninput="state.planta.pins[${pi}].label=this.value">
            <input type="number" min="1" style="width:60px" value="${p.qtd}" oninput="state.planta.pins[${pi}].qtd=this.value">
            ${tplControlesFoco(p, pi, pl)}
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
        ${tplMuroRows()}
        ${tplAreaRows()}
        ${tplEtiquetaRows()}
      </div>
    </div>
  `;
}

let dragState = null;
let suppressNextClick = false;
let pinch = null;
let tracoAtual = null; // [{x,y},...] durante o desenho de uma cerca; null = sem traçado

export function cancelarTraco(){ tracoAtual = null; cancelarTracoMuro(); cancelarEscala(); fimTrocaImagem(); }
export function selectPlanta(i){
  if(i===state.plantaAtiva && !temVistaAtiva()) return;
  cancelarTraco();
  state.plantaAtiva = i;
  state.aereaAtiva = null;
  renderContent();
}
export function addPlanta(){
  cancelarTraco();
  state.plantas.push(novaPlanta('Planta '+(state.plantas.length+1)));
  state.plantaAtiva = state.plantas.length-1;
  state.aereaAtiva = null;
  renderContent();
}
export function removePlanta(i){
  const pt = state.plantas[i];
  if(!pt) return;
  const temConteudo = pt.imagem || pt.pins.length || pt.cercas.length || pt.areas.length || pt.etiquetas.length || (pt.muros||[]).length;
  const nRefs = refsDaPlanta(pt);
  const extra = nRefs ? ` ${nRefs} equipamento(s) colocados em vistas aéreas também saem.` : '';
  if(temConteudo && !confirm(`Excluir a planta "${pt.nome||('Planta '+(i+1))}" e tudo que está nela?${extra}`)) return;
  cancelarTraco();
  state.plantas.splice(i,1);
  if(state.plantas.length===0) state.plantas.push(novaPlanta('Planta 1'));
  if(i < state.plantaAtiva) state.plantaAtiva--;
  state.plantaAtiva = Math.max(0, Math.min(state.plantaAtiva, state.plantas.length-1));
  renderContent();
}
// Menu "Inserir": botão que abre um painel com os tipos agrupados por categoria (CATEGORIAS_INSERIR).
// Painel por clique (não por hover) para funcionar no toque; fecha ao escolher ou ao tocar fora.
function tplMenuInserir(pl){
  const sel = EQUIP_TYPES.find(t=>t.id===pl.selectedTipo);
  // na vista aérea só entra cenário (portão, poste, muro…): equipamento vem da planta, como referência
  const cats = pl.aerea
    ? CATEGORIAS_INSERIR.map(c=>({...c, tipos:c.tipos.filter(id=>typeById(id).cenario)})).filter(c=>c.tipos.length)
    : CATEGORIAS_INSERIR;
  return `
    <div class="inserir-wrap">
      <button class="type-btn inserir-btn" onclick="toggleMenuInserir()">＋ Inserir ▾</button>
      <div id="menuInserir" class="inserir-menu">
        ${cats.map(c=>`
          <div class="inserir-sec">
            <div class="inserir-titulo">${c.label}</div>
            <div class="inserir-itens">
              ${c.tipos.map(id=>{ const t = typeById(id); return `
                <button class="type-btn ${pl.selectedTipo===id?'active':''}" onclick="selectTipo('${id}')">
                  <span class="icon-dot" style="background:${t.color}">${ICONS[id]}</span>${t.label}
                </button>`; }).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>
    ${sel ? `<span class="type-btn active inserir-atual" onclick="toggleMenuInserir()" title="Item selecionado — clique na planta para posicionar"><span class="icon-dot" style="background:${sel.color}">${ICONS[sel.id]}</span>${sel.label}</span>` : ''}`;
}
export function toggleMenuInserir(){
  document.getElementById('menuEquip')?.classList.remove('open');
  document.getElementById('menuInserir')?.classList.toggle('open');
}
document.addEventListener('pointerdown', e=>{
  const m = document.getElementById('menuInserir');
  if(m && m.classList.contains('open') && !e.target.closest('.inserir-wrap, .inserir-atual')) m.classList.remove('open');
});
export function selectTipo(id){
  if(state.planta.selectedTipo==='cerca' && id!=='cerca') tracoAtual = null;
  if(state.planta.selectedTipo==='muro' && id!=='muro') cancelarTracoMuro();
  if(state.planta.selectedTipo==='escala' && id!=='escala') cancelarEscala();
  state.planta.selectedTipo = id;
  renderContent();
}
export function cercaDesfazer(){
  if(tracoAtual && tracoAtual.length) tracoAtual.pop();
  renderContent();
}
export function cercaConcluir(){
  if(!tracoAtual || tracoAtual.length<2){ tracoAtual = null; renderContent(); return; }
  state.planta.cercas.push({id:novoId(), label:'Cerca / Concertina', pontos:tracoAtual});
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
    if(dragState || areaDragAtivo() || etiquetaDragAtivo()) return;
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
  montarMapa(); // vista aérea na tela do mapa (destrói o mapa anterior; sem mapa, não faz nada)
  const img = document.getElementById('plantaImg');
  const wrap = document.getElementById('plantaWrap');
  if(img){
    img.onclick = (e)=>{
      if(suppressNextClick){ suppressNextClick = false; return; }
      if(etiquetaSuprimeClique() || muroDragAtivo()) return;
      if(state.planta.selectedTipo==='area') return;
      const rect = img.getBoundingClientRect();
      const x = ((e.clientX-rect.left)/rect.width)*100;
      const y = ((e.clientY-rect.top)/rect.height)*100;
      if(state.planta.aerea){
        const sel = state.planta.selectedTipo || '';
        if(sel.startsWith('ref:')){ criarRefNoClique(x, y); return; }
        // na vista, fora das ferramentas de desenho só cenário cria pin (equipamento entra como referência)
        if(!FERRAMENTAS_VISTA.includes(sel) && !EQUIP_TYPES.find(t=>t.id===sel)?.cenario) return;
      }
      if(state.planta.selectedTipo==='etiqueta'){
        state.planta.etiquetas.push(novaEtiqueta(x, y));
        renderContent();
        encaixarEtiqueta(state.planta.etiquetas.length-1);
        const inp = document.getElementById('etqtxt-'+(state.planta.etiquetas.length-1));
        if(inp){ inp.focus({preventScroll:true}); inp.select(); }
        return;
      }
      if(state.planta.selectedTipo==='muro'){ muroClique(x, y, rect); return; }
      if(state.planta.selectedTipo==='escala'){ escalaClique(x, y); return; }
      if(state.planta.selectedTipo==='cerca'){
        tracoAtual = tracoAtual || [];
        tracoAtual.push({x, y});
        renderContent();
        return;
      }
      const t = typeById(state.planta.selectedTipo);
      const novo = {id:novoId(), tipoId:t.id, label:t.label, qtd:1, x, y, direcao:0, fotoLocal:null, fotoView:null};
      encaixarNoMuro(novo, state.planta, rect.width, rect.height); // portão/porta/janela perto de um muro grudam nele
      state.planta.pins.push(novo);
      renderContent();
    };
    img.onpointerdown = (e)=>{
      if(state.planta.selectedTipo==='area' && e.isPrimary) startAreaDraw(e);
    };
  }
  if(wrap){
    // camada dos focos: cobre exatamente a imagem e corta o que passa dela (foco em metros pode ser enorme)
    wrap.querySelector('#focoLayer')?.remove();
    const focoLayer = document.createElement('div');
    focoLayer.id = 'focoLayer';
    focoLayer.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;z-index:1;';
    wrap.appendChild(focoLayer);
    state.planta.pins.forEach((p,pi)=>{
      const t = typeById(p.tipoId);
      if(t.cameraLike && t.foco360){
        // PTZ/Speed Dome enxerga 360° — círculo translúcido (cortado pelos muros), sem handle de rotação
        const circ = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        circ.id = 'cone-'+pi;
        circ.innerHTML = `<path fill="${t.color}40" stroke="${t.color}88" stroke-width="1.5"/>`;
        circ.style.cssText = 'position:absolute;transform:translate(-50%,-50%);overflow:visible;pointer-events:none;z-index:1;';
        focoLayer.appendChild(circ);
        posicionarFoco(pi);
      } else if(t.cameraLike){
        // Foco em setor com a ponta em arco (SVG em px, posição em % — acompanha o zoom)
        const cone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        cone.id = 'cone-'+pi;
        cone.innerHTML = `<path fill="${t.color}55" stroke="${t.color}" stroke-opacity="0.85" stroke-width="1.5"/><path class="cego" fill="${COR_CEGO}55" stroke="${COR_CEGO}" stroke-width="1"/>`;
        cone.style.cssText = 'position:absolute;transform:translate(-50%,-50%);overflow:visible;pointer-events:none;z-index:1;';
        focoLayer.appendChild(cone);

        const handle = document.createElement('div');
        handle.id = 'rothandle-'+pi;
        handle.className = 'planta-rothandle';
        handle.title = t.ajustaAlcance ? 'Arraste para girar a direção; afaste ou aproxime do ícone para mudar o alcance' : 'Arraste para girar a direção';
        handle.style.cssText = `position:absolute;border-radius:50%;background:#fff;border:2.5px solid ${t.color};transform:translate(-50%,-50%);cursor:grab;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.45);touch-action:none;`;
        handle.onpointerdown = (e)=>startRotateDrag(e, pi);
        wrap.appendChild(handle);
        if(t.ajustaAlcance){
          // Bullet/Dome: um ponto em cada borda do arco abre/fecha aquele lado do foco
          ['esq','dir'].forEach(lado=>{
            const h = document.createElement('div');
            h.id = `abhandle-${lado}-${pi}`;
            h.className = 'planta-abhandle';
            h.title = 'Arraste para abrir ou fechar este lado do foco';
            h.style.cssText = `position:absolute;border-radius:50%;background:${t.color};border:2px solid #fff;transform:translate(-50%,-50%);cursor:grab;z-index:4;box-shadow:0 1px 3px rgba(0,0,0,.45);touch-action:none;`;
            h.onpointerdown = (e)=>startAberturaDrag(e, pi, lado);
            wrap.appendChild(h);
          });
        }
        if(t.ajustaAlcance && temEscala(state.planta)){
          const hl = document.createElement('div');
          hl.id = 'hlabel-'+pi;
          hl.className = 'foco-rotulo';
          hl.style.cssText = 'position:absolute;transform:translate(-50%,0);font-size:10px;line-height:1.2;white-space:nowrap;background:rgba(255,255,255,.85);color:#222;padding:1px 4px;border-radius:3px;pointer-events:none;z-index:3;';
          wrap.appendChild(hl);
        }
        posicionarFoco(pi);
        atualizarRotulos(pi);
      }
      const pin = document.createElement('div');
      pin.id = 'pinicon-'+pi;
      pin.className = 'planta-pin';
      pin.title = 'Arraste para reposicionar';
      pin.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:3;cursor:grab;touch-action:none;`;
      pin.innerHTML = ICONS[t.id] + (t.cenario ? '' : `<span style="position:absolute;top:-7px;right:-7px;background:#111;color:#fff;font-size:9px;font-weight:800;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${numeroDoPinEm(state.planta, pi)}</span>`);
      pin.onpointerdown = (e)=>startPinDrag(e, pi);
      wrap.appendChild(pin);
      posicionarMarcaMuro(pi);
    });
    renderMuros(wrap, ()=>state.planta.pins.forEach((_,i)=>updatePinDOM(i)));
    renderCercas(wrap);
    renderEscala(wrap);
    renderAreas(wrap);
    renderEtiquetas(wrap);
    if(img && !img.complete){
      img.addEventListener('load', ()=>{
        const w = document.getElementById('plantaWrap');
        if(w) renderCercas(w);
        atualizarFocos();
      });
    }
    // zoom/pinch mudam o tamanho da planta em px: o corte dos focos pelos muros (calculado em px) é refeito
    if(focoObs) focoObs.disconnect();
    focoObs = null;
    if(((state.planta.muros||[]).length || temEscala(state.planta)) && typeof ResizeObserver!=='undefined'){
      focoObs = new ResizeObserver(()=>{
        if(!wrap.isConnected){ focoObs && focoObs.disconnect(); return; }
        atualizarFocos();
      });
      focoObs.observe(wrap);
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
  fixarAbertura(state.planta.pins[pi]);
  const pin0 = state.planta.pins[pi], img0 = document.getElementById('plantaImg');
  dragState = {type:'rotate', index:pi};
  if(img0){
    const r0 = img0.getBoundingClientRect();
    dragState.d0 = Math.hypot(e.clientX - (r0.left + pin0.x/100*r0.width), e.clientY - (r0.top + pin0.y/100*r0.height));
    dragState.m0 = alcanceMDe(pin0);
  }
  const el = document.getElementById('rothandle-'+pi);
  if(el) el.style.cursor = 'grabbing';
  document.addEventListener('pointermove', onPointerDrag);
  document.addEventListener('pointerup', endPointerDrag);
}
export function startAberturaDrag(e, pi, lado){
  e.preventDefault(); e.stopPropagation();
  fixarAbertura(state.planta.pins[pi]);
  dragState = {type:'abertura', index:pi, lado};
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
    encaixarNoMuro(pin, state.planta, rect.width, rect.height);
  } else if(dragState.type==='rotate'){
    const cx = rect.left + (pin.x/100)*rect.width;
    const cy = rect.top + (pin.y/100)*rect.height;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    // o ponto fica no meio do arco: com abertura assimétrica a direção é o ângulo do ponteiro menos o desvio do meio
    const ab = aberturaDe(pin);
    let deg = Math.atan2(dx, -dy) * 180/Math.PI - (ab.dir - ab.esq)/2;
    deg = ((deg % 360) + 360) % 360;
    pin.direcao = Math.round(deg) % 360;
    // Bullet/Dome: a distância do ponto ao ícone define o alcance (o ponto fica na ponta do cone)
    const ppm = ppmEditor();
    if(typeById(pin.tipoId).ajustaAlcance && ppm && dragState.d0 != null){
      // com escala o arraste é relativo (em metros): afastar/aproximar o ponto soma/subtrai metros
      const m = dragState.m0 + (Math.hypot(dx, dy) - dragState.d0)/ppm;
      pin.alcanceM = Math.min(ALCANCE_M_MAX, Math.max(ALCANCE_M_MIN, Math.round(m*2)/2));
    } else if(typeById(pin.tipoId).ajustaAlcance){
      const a = (Math.hypot(dx, dy) - 3) / CONE_L0;
      pin.alcance = Math.round(Math.min(ALCANCE_MAX, Math.max(ALCANCE_MIN, a))*100)/100;
    }
  } else if(dragState.type==='abertura'){
    // ângulo do ponteiro em relação à direção da câmera → abertura daquele lado
    const cx = rect.left + (pin.x/100)*rect.width;
    const cy = rect.top + (pin.y/100)*rect.height;
    const ang = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180/Math.PI;
    let rel = ((ang - (pin.direcao||0)) % 360 + 540) % 360 - 180; // -180..180, + = horário
    if(dragState.lado==='esq') rel = -rel;
    const v = Math.round(Math.min(ABERTURA_MAX, Math.max(ABERTURA_MIN, rel)));
    if(dragState.lado==='esq') pin.abEsq = v; else pin.abDir = v;
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
  if(pinEl){ pinEl.style.left = pin.x+'%'; pinEl.style.top = pin.y+'%'; }
  const t = typeById(pin.tipoId);
  if(t.cameraLike){ posicionarFoco(pi); atualizarRotulos(pi); }
  posicionarMarcaMuro(pi);
}
let focoObs = null;
function atualizarFocos(){
  state.planta.pins.forEach((p,pi)=>{ if(typeById(p.tipoId).cameraLike) posicionarFoco(pi); });
}
// Muros da planta ativa em px do tamanho atual da imagem no editor
function segsEditor(){
  const img = document.getElementById('plantaImg');
  if(!img || !img.clientWidth || !img.clientHeight || !(state.planta.muros||[]).length) return {segs:[], W:0, H:0};
  const W = img.clientWidth, H = img.clientHeight;
  return {segs: segmentosMuros(state.planta, W, H), W, H};
}
// Portão/porta/janela presos a um muro: barra na cor do item, alinhada com a parede, por baixo do ícone
function posicionarMarcaMuro(pi){
  const pin = state.planta.pins[pi], wrap = document.getElementById('plantaWrap');
  let el = document.getElementById('abmark-'+pi);
  const img = document.getElementById('plantaImg');
  const g = (pin && ABERTURAS_MURO.includes(pin.tipoId)) ? geomNoMuro(pin, state.planta, img?.clientWidth||1, img?.clientHeight||1) : null;
  if(!g){ if(el) el.remove(); return; }
  if(!el && wrap){
    el = document.createElement('div');
    el.id = 'abmark-'+pi;
    el.className = 'abertura-muro';
    el.style.cssText = `position:absolute;width:62px;height:10px;border-radius:2px;background:${typeById(pin.tipoId).color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);pointer-events:none;z-index:2;`;
    wrap.appendChild(el);
  }
  if(el){
    el.style.left = g.x+'%'; el.style.top = g.y+'%';
    el.style.transform = `translate(-50%,-50%) rotate(${g.ang}deg)`;
  }
}
// Redesenha o setor do foco e reposiciona os pontos (ponta = direção/alcance, bordas = abertura)
function posicionarFoco(pi){
  const pin = state.planta.pins[pi];
  const t = typeById(pin.tipoId);
  const ppm = ppmEditor();
  const L = ppm ? alcanceMDe(pin)*ppm : t.foco360 ? PTZ_R : CONE_L0*alcanceDe(pin), ab = aberturaDe(pin), dir = pin.direcao||0;
  const coneEl = document.getElementById('cone-'+pi);
  if(coneEl){
    const S = 2*L + 4, c = S/2;
    coneEl.setAttribute('width', S); coneEl.setAttribute('height', S);
    coneEl.style.left = pin.x+'%'; coneEl.style.top = pin.y+'%';
    // muros cortam o foco: polígono de visão em px; sem corte, setor/círculo com arco perfeito
    const {segs, W, H} = segsEditor();
    const px = pin.x/100*W, py = pin.y/100*H;
    const poly = segs.length ? (t.foco360 ? poligonoVisao(px, py, L, 0, 360, segs, true) : poligonoVisao(px, py, L, dir-ab.esq, dir+ab.dir, segs)) : null;
    const path = coneEl.querySelector('path');
    if(path) path.setAttribute('d', poly ? poligonoPath(poly, c-px, c-py)
      : t.foco360 ? `M${c-L},${c} A${L},${L} 0 1 0 ${c+L},${c} A${L},${L} 0 1 0 ${c-L},${c} Z` : setorPath(c, c, L, dir, ab));
    // ponto cego (Bullet/Dome com escala): faixa vermelha junto à câmera, também cortada pelos muros
    const cegoPath = coneEl.querySelector('path.cego');
    if(cegoPath){
      const cm = (ppm && t.ajustaAlcance) ? cegoDoPin(pin) : 0;
      if(cm > 0){
        const R = cm*ppm;
        const pc = segs.length ? poligonoVisao(px, py, R, dir-ab.esq, dir+ab.dir, segs) : null;
        cegoPath.setAttribute('d', pc ? poligonoPath(pc, c-px, c-py) : setorPath(c, c, R, dir, ab));
      } else cegoPath.setAttribute('d', '');
    }
  }
  if(t.foco360) return;
  const coloca = (el, r, deg)=>{
    if(!el) return;
    const q = pontoNaDirecao(0, 0, r, deg);
    // com foco em metros a ponta pode cair fora da imagem: mantém a alça visível dentro dela
    const im = document.getElementById('plantaImg'), W = im?.clientWidth||0, H = im?.clientHeight||0;
    const px = pin.x/100*W, py = pin.y/100*H;
    const cx = W>28 ? Math.min(W-14, Math.max(14, px+q.x)) : px+q.x;
    const cy = H>28 ? Math.min(H-14, Math.max(14, py+q.y)) : py+q.y;
    el.style.left = `calc(${pin.x}% + ${cx-px}px)`;
    el.style.top = `calc(${pin.y}% + ${cy-py}px)`;
  };
  // ponto da ponta no meio do arco, mas nunca colado no ícone (fica pegável no alcance mínimo)
  coloca(document.getElementById('rothandle-'+pi), Math.max(L+3, 44), dir + (ab.dir - ab.esq)/2);
  const rb = Math.max(L, 40);
  coloca(document.getElementById('abhandle-esq-'+pi), rb, dir-ab.esq);
  coloca(document.getElementById('abhandle-dir-'+pi), rb, dir+ab.dir);
}
export function ppmEditor(){
  const img = document.getElementById('plantaImg');
  return img ? pxPorMetro(state.planta, img.clientWidth) : null;
}
// Rótulo "altura · alcance" ao lado da câmera e "Ponto cego" na linha do pin
function atualizarRotulos(pi){
  const pin = state.planta.pins[pi];
  if(!pin) return;
  const hl = document.getElementById('hlabel-'+pi);
  if(hl){
    hl.textContent = fmtM(alturaDe(pin)) + ' · ' + fmtM(alcanceMDe(pin));
    hl.style.left = pin.x+'%'; hl.style.top = `calc(${pin.y}% + 20px)`;
  }
  const cg = document.getElementById('cego-'+pi);
  if(cg) cg.textContent = 'Ponto cego: ' + fmtM(cegoDoPin(pin));
}
export function syncPinRowControls(){
  state.planta.pins.forEach((p,pi)=>{
    const slider = document.getElementById('dirslider-'+pi);
    const lbl = document.getElementById('deglabel-'+pi);
    if(slider) slider.value = p.direcao||0;
    if(lbl) lbl.textContent = (p.direcao||0)+'°';
    const as = document.getElementById('alcslider-'+pi), al = document.getElementById('alclabel-'+pi);
    const comEsc = temEscala(state.planta);
    if(as) as.value = comEsc ? alcanceMDe(p) : Math.round(alcanceDe(p)*100);
    if(al) al.textContent = comEsc ? fmtM(alcanceMDe(p)) : Math.round(alcanceDe(p)*100)+'%';
    const alt = document.getElementById('altura-'+pi);
    if(alt && document.activeElement !== alt) alt.value = alturaDe(p);
    atualizarRotulos(pi);
    const ab = aberturaDe(p);
    const ae = document.getElementById('abesq-'+pi), ad = document.getElementById('abdir-'+pi), alb = document.getElementById('ablabel-'+pi);
    if(ae) ae.value = Math.round(ab.esq);
    if(ad) ad.value = Math.round(ab.dir);
    if(alb) alb.textContent = Math.round(ab.esq+ab.dir)+'°';
  });
}

function aplicarZoomAncorado(novoZoom){
  const sc = document.getElementById('plantaScroll');
  const wrap = document.getElementById('plantaWrap');
  let fx = 0.5, fy = 0.5;
  if(sc && wrap && wrap.offsetWidth && wrap.offsetHeight){
    fx = (sc.scrollLeft + sc.clientWidth/2)/wrap.offsetWidth;
    fy = (sc.scrollTop + sc.clientHeight/2)/wrap.offsetHeight;
  }
  state.planta.zoom = novoZoom;
  renderContent();
  if(!wrap) return;
  const aplicar = ()=>{
    const s2 = document.getElementById('plantaScroll');
    const w2 = document.getElementById('plantaWrap');
    if(!s2 || !w2) return;
    s2.scrollLeft = fx*w2.offsetWidth - s2.clientWidth/2;
    s2.scrollTop = fy*w2.offsetHeight - s2.clientHeight/2;
  };
  aplicar();
  const img = document.getElementById('plantaImg');
  if(img && !img.complete) img.addEventListener('load', aplicar, {once:true});
}
export function zoomPlanta(delta){
  aplicarZoomAncorado(Math.min(400, Math.max(60, (state.planta.zoom||100) + delta)));
}
export function resetZoom(){ aplicarZoomAncorado(100); }
export function liveUpdateCone(pi, deg){
  state.planta.pins[pi].direcao = parseInt(deg);
  const lbl = document.getElementById('deglabel-'+pi);
  if(lbl) lbl.textContent = deg+'°';
  updatePinDOM(pi);
}

export function liveUpdateAlcance(pi, pct){
  fixarAbertura(state.planta.pins[pi]);
  state.planta.pins[pi].alcance = parseInt(pct)/100;
  const lbl = document.getElementById('alclabel-'+pi);
  if(lbl) lbl.textContent = parseInt(pct)+'%';
  updatePinDOM(pi);
}
// Controles do foco na linha do pin (direção, alcance, abertura; altura com escala) — planta e vista aérea
export function tplControlesFoco(p, pi, pl){
  const t = typeById(p.tipoId);
  return `${t.cameraLike && !t.foco360 ? `<span style="font-size:11px;color:var(--text-mid);">Direção</span><input id="dirslider-${pi}" type="range" min="0" max="359" value="${p.direcao||0}" style="width:80px;margin-bottom:0;" oninput="liveUpdateCone(${pi}, this.value)"><span id="deglabel-${pi}" style="font-size:11px;color:var(--text-mid);width:32px;">${p.direcao||0}°</span>` : ''}
            ${t.ajustaAlcance && temEscala(pl) ? tplAlcanceMetros(p, pi) + tplAberturaControles(p, pi) : ''}
            ${t.ajustaAlcance && !temEscala(pl) ? `<span style="font-size:11px;color:var(--text-mid);">Alcance</span><input id="alcslider-${pi}" type="range" min="${ALCANCE_MIN*100}" max="${ALCANCE_MAX*100}" value="${Math.round(alcanceDe(p)*100)}" style="width:80px;margin-bottom:0;" oninput="liveUpdateAlcance(${pi}, this.value)"><span id="alclabel-${pi}" style="font-size:11px;color:var(--text-mid);width:36px;">${Math.round(alcanceDe(p)*100)}%</span>${tplAberturaControles(p, pi)}` : ''}`;
}
// Alcance em metros + altura + ponto cego (Bullet/Dome numa planta com escala)
function tplAlcanceMetros(p, pi){
  return `<span style="font-size:11px;color:var(--text-mid);">Alcance</span><input id="alcslider-${pi}" type="range" min="${ALCANCE_M_MIN}" max="${ALCANCE_M_MAX}" step="0.5" value="${alcanceMDe(p)}" style="width:80px;margin-bottom:0;" oninput="liveUpdateAlcanceM(${pi}, this.value)"><span id="alclabel-${pi}" style="font-size:11px;color:var(--text-mid);width:44px;">${fmtM(alcanceMDe(p))}</span><span style="font-size:11px;color:var(--text-mid);">Altura (m)</span><input type="number" id="altura-${pi}" min="${ALTURA_MIN}" max="${ALTURA_MAX}" step="0.5" value="${alturaDe(p)}" style="width:60px" oninput="liveUpdateAltura(${pi}, this.value)" onchange="syncAlturaCampo(${pi})"><span id="cego-${pi}" style="font-size:11px;color:var(--text-mid);">Ponto cego: ${fmtM(cegoDoPin(p))}</span>`;
}
export function liveUpdateAlcanceM(pi, m){
  const pin = state.planta.pins[pi];
  const v = parseFloat(m);
  if(!pin || !Number.isFinite(v)) return;
  fixarAbertura(pin);
  pin.alcanceM = Math.min(ALCANCE_M_MAX, Math.max(ALCANCE_M_MIN, v));
  const lbl = document.getElementById('alclabel-'+pi);
  if(lbl) lbl.textContent = fmtM(pin.alcanceM);
  updatePinDOM(pi);
}
export function liveUpdateAltura(pi, m){
  const pin = state.planta.pins[pi];
  const v = parseFloat(m);
  if(!pin || !Number.isFinite(v)) return;
  pin.altura = Math.min(ALTURA_MAX, Math.max(ALTURA_MIN, v));
  updatePinDOM(pi);
}
// ao sair do campo, grava de volta o valor limitado
export function syncAlturaCampo(pi){
  const pin = state.planta.pins[pi], el = document.getElementById('altura-'+pi);
  if(pin && el) el.value = alturaDe(pin);
}
// Sliders de abertura (lado esquerdo / direito) na linha do pin — Bullet/Dome
function tplAberturaControles(p, pi){
  const ab = aberturaDe(p);
  const sl = (lado, v)=>`<input id="ab${lado}-${pi}" type="range" min="${ABERTURA_MIN}" max="${ABERTURA_MAX}" value="${Math.round(v)}" title="Abertura do lado ${lado==='esq'?'esquerdo':'direito'}" style="width:60px;margin-bottom:0;" oninput="liveUpdateAbertura(${pi}, '${lado}', this.value)">`;
  return `<span style="font-size:11px;color:var(--text-mid);">Abertura E/D</span>${sl('esq', ab.esq)}${sl('dir', ab.dir)}<span id="ablabel-${pi}" style="font-size:11px;color:var(--text-mid);width:32px;">${Math.round(ab.esq+ab.dir)}°</span>`;
}
export function liveUpdateAbertura(pi, lado, deg){
  const pin = state.planta.pins[pi];
  fixarAbertura(pin);
  if(lado==='esq') pin.abEsq = parseInt(deg); else pin.abDir = parseInt(deg);
  const ab = aberturaDe(pin), lbl = document.getElementById('ablabel-'+pi);
  if(lbl) lbl.textContent = Math.round(ab.esq+ab.dir)+'°';
  updatePinDOM(pi);
}
// Comprimento padrão do foco no editor (px); o alcance (Bullet/Dome) multiplica.
const CONE_L0 = 55, PTZ_R = 55;

export function removePin(pi){ state.planta.pins.splice(pi,1); renderContent(); }

export async function handlePlantaUpload(e){
  const f = e.target.files[0]; if(!f) return;
  if(state.planta.aerea && temConteudoVista(state.planta) && !confirm('Trocar a imagem apaga o que está posicionado nesta vista (muros ficam). Continuar?')){ e.target.value=''; return; }
  const nRefs = state.planta.aerea ? 0 : refsDaPlanta(state.planta);
  if(nRefs && !confirm(`Trocar a imagem apaga os equipamentos desta planta, e ${nRefs} equipamento(s) colocados em vistas aéreas também saem. Continuar?`)){ e.target.value=''; return; }
  if(isPdfFile(f)){ await handlePlantaPdfUpload(f); e.target.value=''; return; }
  state.planta.imagem = await fileToDataURL(f);
  limparPlanta(state.planta);
  if(state.planta.aerea){ state.planta.fonte = 'upload'; fimTrocaImagem(); }
  resetRolagem();
  renderContent();
}
