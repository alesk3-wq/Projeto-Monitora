import { state } from './state.js';
import { BRAND, ICONS, PW, PH } from './constants.js';
import { showToast, fmtDate, typeById, areaCatById } from './utils.js';
import { generateCropDataURL } from './tabs/equipamentos.js';
import { validarProposta } from './validacao.js';

function loadImageDims(src){
  return new Promise((resolve)=>{
    if(!src){ resolve(null); return; }
    const img = new Image();
    img.onload = ()=>resolve({w: img.naturalWidth, h: img.naturalHeight});
    img.onerror = ()=>resolve(null);
    img.src = src;
  });
}
// Retângulo efetivo onde background-size:contain desenha a imagem dentro da caixa
function containRect(imgW, imgH, boxW, boxH){
  const scale = Math.min(boxW/imgW, boxH/imgH);
  const w = imgW*scale, h = imgH*scale;
  return { x:(boxW-w)/2, y:(boxH-h)/2, w, h };
}
// Triângulo decorativo compatível com html2canvas (clip-path é ignorado na rasterização):
// quadrado rotacionado 45° cuja aresta superior coincide com a hipotenusa do antigo
// clip-path:polygon(100% 0,100% 100%,0 100%). Passar os mesmos size/right/top|bottom do div antigo.
function triDecor({size, right, top=null, bottom=null, background, opacity=1}){
  const L = size*Math.SQRT2;
  const vert = top!==null ? `top:${top + size - L/2}px;` : `bottom:${bottom - L/2}px;`;
  return `<div style="position:absolute;right:${right - L/2}px;${vert}width:${L}px;height:${L}px;transform:rotate(45deg);background:${background};opacity:${opacity};"></div>`;
}

function pageShell(inner){
  return `<div style="width:${PW}px;height:${PH}px;position:relative;overflow:hidden;background:#fff;font-family:'Inter',sans-serif;">${inner}</div>`;
}
function pageHeader(num, title){
  return `
    <div style="position:absolute;top:50px;left:64px;display:flex;align-items:center;gap:20px;">
      <div style="width:60px;height:60px;border-radius:50%;background:${BRAND.corSecundaria};color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;">${num}</div>
      <div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:32px;color:${BRAND.cor};">${title}</div>
        <div style="width:110px;height:4px;background:${BRAND.corAcento};margin-top:6px;"></div>
      </div>
    </div>`;
}
function footerBrand(){
  return `<div style="position:absolute;bottom:30px;left:64px;display:flex;align-items:center;gap:10px;color:#8FA3BF;font-size:11px;font-weight:600;">
    <img src="${BRAND.logo}" style="height:20px;object-fit:contain;">
    <span>${BRAND.nome} · ${BRAND.departamento}</span>
  </div>`;
}

function pageCapa(){
  return pageShell(`
    <div style="width:100%;height:100%;background:#fff;position:relative;">
      ${triDecor({size:760, right:-110, bottom:-160, background:BRAND.cor, opacity:.97})}
      ${triDecor({size:480, right:-30, bottom:-90, background:BRAND.corSecundaria, opacity:.9})}
      <div style="position:absolute;left:74px;top:56px;font-size:12px;letter-spacing:1.5px;font-weight:800;color:${BRAND.cor};text-transform:uppercase;">PROJETO SEG. ELETRÔNICA</div>
      <div style="position:absolute;left:74px;top:78px;font-size:11px;letter-spacing:1px;font-weight:700;color:#8FA3BF;text-transform:uppercase;">DEPTO. ${BRAND.departamento.toUpperCase()}</div>
      <div style="position:absolute;left:74px;top:300px;max-width:640px;">
        <div style="color:#111;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:64px;line-height:.95;">PROJETO<br>SEG. ELETRÔNICA</div>
        <div style="display:inline-block;margin-top:24px;background:${BRAND.corSecundaria};color:#fff;padding:10px 22px;border-radius:6px;font-weight:800;font-size:18px;">${state.projeto.unidade || 'Unidade não definida'}</div>
        <div style="margin-top:24px;font-weight:800;font-size:15px;color:#111;">DEPTO. ${BRAND.departamento.toUpperCase()}</div>
        <div style="font-size:14px;color:#4A5A72;">${state.projeto.equipe||''}</div>
        <div style="margin-top:14px;font-size:13px;color:#4A5A72;font-weight:700;">${fmtDate(state.projeto.data)}</div>
      </div>
      <div style="position:absolute;left:74px;bottom:64px;">
        <img src="${BRAND.logo}" style="height:34px;object-fit:contain;">
      </div>
    </div>
  `);
}
function pageSumario(){
  const items = [['01','Problema & Solução'],['02','Mapeamento'],['03','Estrutura'],['04','Fichas de Equipamentos'],['05','Premissas']];
  return pageShell(`
    ${triDecor({size:560, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.92})}
    <div style="padding:70px 74px;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:40px;color:${BRAND.cor};margin-bottom:34px;">Sumário</div>
      ${items.map(([n,l])=>`
        <div style="display:flex;align-items:center;gap:18px;margin-bottom:18px;max-width:520px;">
          <div style="width:40px;height:40px;border-radius:50%;background:#EDEFF3;color:${BRAND.cor};display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed';font-weight:800;font-size:17px;flex-shrink:0;">${n}</div>
          <div style="font-size:18px;color:${BRAND.cor};font-weight:600;border-bottom:1px solid #E3E8EF;flex:1;padding-bottom:14px;">${l}</div>
        </div>`).join('')}
    </div>
    ${footerBrand()}
  `);
}
function pageObjetivo(){
  return pageShell(`
    ${pageHeader('01','Objetivo do Projeto')}
    ${triDecor({size:420, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.85})}
    <div style="position:absolute;top:170px;left:64px;right:64px;">
      <div style="font-weight:800;color:${BRAND.cor};font-size:16px;margin-bottom:8px;">Área a ser Monitorada</div>
      <div style="font-size:14.5px;line-height:1.6;color:#33415A;white-space:pre-wrap;margin-bottom:34px;">${state.objetivo.problema || '—'}</div>
      <div style="font-weight:800;color:${BRAND.cor};font-size:16px;margin-bottom:8px;">Diretriz da Proposta</div>
      <div style="font-size:14.5px;line-height:1.6;color:#33415A;white-space:pre-wrap;">${state.objetivo.solucao || '—'}</div>
    </div>
    ${footerBrand()}
  `);
}
function equipamentoLegend(){
  const map = {};
  state.planta.pins.forEach(p=>{
    const key = p.tipoId+'|'+p.label;
    if(!map[key]) map[key] = {tipoId:p.tipoId, label:p.label, qtd:0};
    map[key].qtd += (parseInt(p.qtd)||1);
  });
  const legend = Object.values(map);
  (state.planta.cercas||[]).forEach(c=>{
    legend.push({tipoId:'cerca', label:c.label, qtd:1});
  });
  return legend;
}
function pageEstrutura(){
  const legend = equipamentoLegend();
  return pageShell(`
    ${pageHeader('03','Estrutura')}
    ${triDecor({size:420, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.85})}
    <div style="position:absolute;top:165px;left:64px;right:530px;bottom:70px;overflow:hidden;">
      ${state.estrutura.map(g=>`
        <div style="margin-bottom:20px;">
          <div style="font-weight:800;color:${BRAND.corSecundaria};font-size:15px;margin-bottom:8px;">${g.titulo||'Grupo'}</div>
          ${g.itens.map(it=>`
            <div style="font-size:13.5px;color:#33415A;line-height:1.5;margin-bottom:4px;">
              <b>${(parseInt(it.qtd)||0)>=2 ? (parseInt(it.qtd)||0)+'x ' : ''}${it.nome||''}</b>${it.desc?': '+it.desc:''}
            </div>`).join('')}
        </div>`).join('')}
    </div>
    <div style="position:absolute;top:165px;right:64px;width:440px;background:#F9FAFB;border:1px solid #E3E8EF;border-radius:10px;padding:20px;">
      <div style="font-weight:800;color:${BRAND.cor};font-size:15px;margin-bottom:14px;">Legenda — Equipamentos na Planta</div>
      ${legend.length===0 ? `<div style="font-size:13px;color:#8FA3BF;">Nenhum equipamento posicionado.</div>` : legend.map(l=>`
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;">
          <div style="width:20px;height:20px;border-radius:50%;background:${typeById(l.tipoId).color};margin-top:1px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ICONS[l.tipoId]}</div>
          <div style="font-size:13px;color:#33415A;line-height:1.4;"><b>${l.qtd}x — ${typeById(l.tipoId).label}</b>${l.label && l.label!==typeById(l.tipoId).label ? '<br>'+l.label : ''}</div>
        </div>`).join('')}
      ${(state.planta.areas||[]).length ? `
        <div style="font-weight:800;color:${BRAND.cor};font-size:15px;margin:18px 0 12px;">Áreas Demarcadas</div>
        ${state.planta.areas.map(a=>{
          const cat = areaCatById(a.catId);
          return `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
            <div style="width:16px;height:16px;border-radius:4px;background:${cat.color}66;border:2px solid ${cat.color};margin-top:1px;flex-shrink:0;"></div>
            <div style="font-size:13px;color:#33415A;line-height:1.4;"><b>${cat.label}</b>${a.descricao ? ' — '+a.descricao : ''}</div>
          </div>`;
        }).join('')}` : ''}
    </div>
    ${footerBrand()}
  `);
}
function pageMapeamento(dims){
  const BOX_W = PW - 128, BOX_H = 770; // container: left/right:64, height:770
  const rect = dims ? containRect(dims.w, dims.h, BOX_W, BOX_H) : {x:0, y:0, w:BOX_W, h:BOX_H};
  const pinsHtml = state.planta.pins.map((p,pi)=>{
    const t = typeById(p.tipoId);
    const left = rect.x + (p.x/100)*rect.w;
    const top = rect.y + (p.y/100)*rect.h;
    const cone = t.cameraLike ? `<div style="position:absolute;left:${left}px;top:${top}px;width:0;height:0;border-left:24px solid transparent;border-right:24px solid transparent;border-top:50px solid ${t.color}55;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(${p.direcao||0}deg);"></div>` : '';
    const badge = `<span style="position:absolute;top:-7px;right:-7px;background:#111;color:#fff;font-size:9px;font-weight:800;border-radius:50%;width:15px;height:15px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${pi+1}</span>`;
    return `${cone}<div style="position:absolute;left:${left}px;top:${top}px;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">${ICONS[t.id]}${badge}</div>`;
  }).join('');
  const cercaHtml = (state.planta.cercas||[]).map(c=>{
    const segs = [];
    for(let i=0;i<c.pontos.length-1;i++){
      const a = c.pontos[i], b = c.pontos[i+1];
      const x1 = rect.x + (a.x/100)*rect.w, y1 = rect.y + (a.y/100)*rect.h;
      const x2 = rect.x + (b.x/100)*rect.w, y2 = rect.y + (b.y/100)*rect.h;
      const len = Math.hypot(x2-x1, y2-y1);
      const ang = Math.atan2(y2-y1, x2-x1)*180/Math.PI;
      segs.push(`<div style="position:absolute;left:${x1}px;top:${y1-2}px;width:${len}px;height:4px;border-radius:2px;background:#EB5757;transform-origin:0 2px;transform:rotate(${ang}deg);"></div>`);
    }
    return segs.join('');
  }).join('');
  const areasHtml = (state.planta.areas||[]).map(a=>{
    const cat = areaCatById(a.catId);
    const x = rect.x + (a.x/100)*rect.w, y = rect.y + (a.y/100)*rect.h;
    const w = (a.w/100)*rect.w, h = (a.h/100)*rect.h;
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${cat.color}38;border:2px solid ${cat.color};border-radius:4px;box-sizing:border-box;"><span style="position:absolute;top:2px;left:2px;background:${cat.color};color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:3px;">${cat.label}</span></div>`;
  }).join('');
  return pageShell(`
    ${pageHeader('02','Mapeamento')}
    <div style="position:absolute;top:165px;left:64px;right:64px;height:770px;border-radius:8px;overflow:hidden;background:#F4F6F9;border:1px solid #E3E8EF;">
      ${state.planta.imagem ? `<div style="width:100%;height:100%;background-image:url('${state.planta.imagem}');background-size:contain;background-position:center;background-repeat:no-repeat;"></div>` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8FA3BF;font-size:14px;">Planta não anexada</div>`}
      ${areasHtml}
      ${cercaHtml}
      ${pinsHtml}
    </div>
    ${footerBrand()}
  `);
}
// Item da Estrutura correspondente ao pin de índice `index` (procura "Ponto N" no nome,
// como o "Gerar a partir da planta" nomeia; \b evita que "Ponto 1" case com "Ponto 10")
function itemDoPonto(index){
  const re = new RegExp(`Ponto ${index+1}\\b`);
  for(const g of state.estrutura){
    for(const it of (g.itens||[])){
      if(it.nome && re.test(it.nome)) return it;
    }
  }
  return null;
}
function pageEquipamento(pin, index, cropUrl){
  const t = typeById(pin.tipoId);
  const boxStyle = 'width:100%;height:290px;object-fit:cover;border-radius:8px;border:1px solid #E3E8EF;background:#F4F6F9;';
  const placeholder = (txt)=>`<div style="${boxStyle}display:flex;align-items:center;justify-content:center;color:#9AA7BA;font-size:13px;">${txt}</div>`;
  const item = itemDoPonto(index);
  const legendaItem = item ? `<div style="margin-top:10px;font-size:13px;line-height:1.5;color:#33415A;"><b style="color:${BRAND.cor};">${item.nome}</b>${item.desc ? '<br>'+item.desc : ''}</div>` : '';
  return pageShell(`
    ${pageHeader(String(index+1), t.label + (pin.label?' — '+pin.label:''))}
    ${triDecor({size:420, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.85})}
    <div style="position:absolute;top:170px;left:64px;right:64px;bottom:70px;display:flex;gap:24px;">
      <div style="flex:1;">
        <div style="font-weight:800;color:${BRAND.cor};font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Localização na Planta</div>
        ${cropUrl ? `<img src="${cropUrl}" style="${boxStyle}">` : placeholder('Planta não anexada')}
        ${legendaItem}
      </div>
      <div style="flex:1;">
        <div style="font-weight:800;color:${BRAND.cor};font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Local de Instalação</div>
        ${pin.fotoLocal ? `<img src="${pin.fotoLocal}" style="${boxStyle}">` : placeholder('Foto não anexada')}
      </div>
      <div style="flex:1;">
        <div style="font-weight:800;color:${BRAND.cor};font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Visualização Esperada</div>
        ${pin.fotoView ? `<img src="${pin.fotoView}" style="${boxStyle}">` : placeholder('Foto não anexada')}
      </div>
    </div>
    ${footerBrand()}
  `);
}
function pagePremissas(){
  return pageShell(`
    ${pageHeader('05','Premissas do Projeto')}
    ${triDecor({size:420, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.85})}
    <div style="position:absolute;top:165px;left:64px;right:64px;bottom:70px;overflow:hidden;">
      ${state.premissas.map(p=>`
        <div style="margin-bottom:16px;font-size:14px;line-height:1.55;color:#33415A;">
          <b style="color:${BRAND.cor};">${p.titulo}:</b> ${p.desc}
        </div>`).join('')}
    </div>
    ${footerBrand()}
  `);
}
function pageEncerramento(){
  return pageShell(`
    <div style="width:100%;height:100%;position:relative;background:#fff;">
      ${triDecor({size:520, right:-100, top:-140, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.92})}
      <div style="position:absolute;left:74px;top:420px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:52px;color:${BRAND.cor};">${(BRAND.slogan||'').toUpperCase()}</div>
      <div style="position:absolute;left:74px;bottom:70px;"><img src="${BRAND.logo}" style="height:30px;object-fit:contain;"></div>
    </div>
  `);
}

export async function gerarPDF(){
  showToast('Gerando PDF…');
  const root = document.getElementById('pdf-render-root');
  root.innerHTML = '';
  const equipCrops = [];
  for(const p of state.planta.pins){ equipCrops.push(await generateCropDataURL(p)); }
  const plantaDims = await loadImageDims(state.planta.imagem);
  const pages = [
    pageCapa(), pageSumario(), pageObjetivo(), pageMapeamento(plantaDims), pageEstrutura(),
    ...state.planta.pins.map((p,i)=>pageEquipamento(p,i,equipCrops[i])),
    pagePremissas(), pageEncerramento()
  ];
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({orientation:'landscape', unit:'px', format:[PW,PH]});
  for(let i=0;i<pages.length;i++){
    const div = document.createElement('div');
    div.innerHTML = pages[i];
    root.appendChild(div);
    await new Promise(r=>setTimeout(r,60));
    const canvas = await html2canvas(div.firstElementChild, {scale:2, useCORS:true, backgroundColor:'#ffffff'});
    const imgData = canvas.toDataURL('image/jpeg', 0.93);
    if(i>0) pdf.addPage([PW,PH],'landscape');
    pdf.addImage(imgData, 'JPEG', 0, 0, PW, PH);
    root.removeChild(div);
  }
  const filename = `Proposta_Bracell_${(state.projeto.unidade||'Projeto').replace(/[^a-zA-Z0-9]+/g,'_')}.pdf`;
  pdf.save(filename);
  showToast('PDF gerado com sucesso!');
}

export function solicitarGerarPDF(){
  const pend = validarProposta();
  if(pend.length===0){ gerarPDF(); return; }
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">Itens pendentes na proposta</div>
      <ul class="modal-list">${pend.map(p=>`<li>${p.msg}</li>`).join('')}</ul>
      <div class="modal-actions">
        <button class="btn ghost" id="modalVoltar">Voltar e completar</button>
        <button class="btn primary" id="modalGerar">Gerar mesmo assim</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#modalVoltar').onclick = ()=>ov.remove();
  ov.querySelector('#modalGerar').onclick = ()=>{ ov.remove(); gerarPDF(); };
}
