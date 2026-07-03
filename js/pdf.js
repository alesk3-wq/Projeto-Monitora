import { state } from './state.js';
import { BRAND, ICONS, PW, PH } from './constants.js';
import { showToast, fmtDate, typeById } from './utils.js';
import { generateCropDataURL } from './tabs/equipamentos.js';

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
      <div style="position:absolute;right:-110px;bottom:-160px;width:760px;height:760px;background:${BRAND.cor};clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.97;"></div>
      <div style="position:absolute;right:-30px;bottom:-90px;width:480px;height:480px;background:${BRAND.corSecundaria};clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.9;"></div>
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
    <div style="position:absolute;right:-140px;top:-160px;width:560px;height:560px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.92;"></div>
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
    <div style="position:absolute;right:-140px;top:-160px;width:420px;height:420px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.85;"></div>
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
  return Object.values(map);
}
function pageEstrutura(){
  const legend = equipamentoLegend();
  return pageShell(`
    ${pageHeader('03','Estrutura')}
    <div style="position:absolute;right:-140px;top:-160px;width:420px;height:420px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.85;"></div>
    <div style="position:absolute;top:165px;left:64px;right:530px;bottom:70px;overflow:hidden;">
      ${state.estrutura.map(g=>`
        <div style="margin-bottom:20px;">
          <div style="font-weight:800;color:${BRAND.corSecundaria};font-size:15px;margin-bottom:8px;">${g.titulo||'Grupo'}</div>
          ${g.itens.map(it=>`
            <div style="font-size:13.5px;color:#33415A;line-height:1.5;margin-bottom:4px;">
              <b>${it.qtd||0}x ${it.nome||''}</b>${it.desc?': '+it.desc:''}
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
    </div>
    ${footerBrand()}
  `);
}
function pageMapeamento(){
  const pinsHtml = state.planta.pins.map(p=>{
    const t = typeById(p.tipoId);
    const cone = t.cameraLike ? `<div style="position:absolute;left:${p.x}%;top:${p.y}%;width:0;height:0;border-left:24px solid transparent;border-right:24px solid transparent;border-top:50px solid ${t.color}55;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(${p.direcao||0}deg);"></div>` : '';
    return `${cone}<div style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">${ICONS[t.id]}</div>`;
  }).join('');
  return pageShell(`
    ${pageHeader('02','Mapeamento')}
    <div style="position:absolute;top:165px;left:64px;right:64px;height:770px;border-radius:8px;overflow:hidden;background:#F4F6F9;border:1px solid #E3E8EF;">
      ${state.planta.imagem ? `<div style="width:100%;height:100%;background-image:url('${state.planta.imagem}');background-size:contain;background-position:center;background-repeat:no-repeat;"></div>` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8FA3BF;font-size:14px;">Planta não anexada</div>`}
      ${pinsHtml}
    </div>
    ${footerBrand()}
  `);
}
function pageEquipamento(pin, index, cropUrl){
  const t = typeById(pin.tipoId);
  const boxStyle = 'width:100%;height:290px;object-fit:cover;border-radius:8px;border:1px solid #E3E8EF;background:#F4F6F9;';
  const placeholder = (txt)=>`<div style="${boxStyle}display:flex;align-items:center;justify-content:center;color:#9AA7BA;font-size:13px;">${txt}</div>`;
  return pageShell(`
    ${pageHeader(String(index+1), t.label + (pin.label?' — '+pin.label:''))}
    <div style="position:absolute;right:-140px;top:-160px;width:420px;height:420px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.85;"></div>
    <div style="position:absolute;top:170px;left:64px;right:64px;bottom:70px;display:flex;gap:24px;">
      <div style="flex:1;">
        <div style="font-weight:800;color:${BRAND.cor};font-size:13px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Localização na Planta</div>
        ${cropUrl ? `<img src="${cropUrl}" style="${boxStyle}">` : placeholder('Planta não anexada')}
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
    <div style="position:absolute;right:-140px;top:-160px;width:420px;height:420px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.85;"></div>
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
      <div style="position:absolute;right:-100px;top:-140px;width:520px;height:520px;background:linear-gradient(135deg, ${BRAND.corAcento}, ${BRAND.corSecundaria});clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.92;"></div>
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
  const pages = [
    pageCapa(), pageSumario(), pageObjetivo(), pageMapeamento(), pageEstrutura(),
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
