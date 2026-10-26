import { state } from './state.js';
import { numeroDoPin, pontosPorTipo, trechosCerca } from './numeracao.js';
import { BRAND, ICONS, PW, PH } from './constants.js';
import { showToast, fmtDate, typeById, areaCatById, escHtml } from './utils.js';
import { etqGeom, ETQ_COR } from './tabs/etiquetas.js';
import { generateCropDataURL } from './tabs/equipamentos.js';
import { gruposGerados, secaoGerada } from './tabs/estrutura.js';
import { exportarProjeto } from './persistence.js';
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

// Float invisível que faz o texto desviar do triângulo decorativo padrão das páginas internas
// (triDecor size:420, right:-140, top:-160). Vai como 1º filho de um container de texto com
// right:64px e top ≈165–170px. shape-outside segue a diagonal do triângulo com ~24px de folga;
// funciona no PDF porque o html2canvas usa o layout do próprio navegador para posicionar o texto.
function desviaTriangulo(){
  return `<div style="float:right;width:240px;height:330px;shape-outside:polygon(91px 0, 240px 0, 240px 330px, 0 90px);"></div>`;
}
const TEXTO_JUST = 'text-align:justify;hyphens:auto;';

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
// Texto livre do usuário com a estrutura do modelo de referência: linhas que começam com
// •, -, * ou – viram itens de lista (marcador + recuo); as demais viram parágrafos justificados;
// linha em branco vira espaço entre blocos.
const MARCADOR = /^\s*[•\-*–·]\s+/;
export function textoEstruturado(txt){
  const linhas = String(txt||'').replace(/\r/g,'').split('\n');
  if(!linhas.some(l=>l.trim())) return `<div style="font-size:14.5px;color:#33415A;">—</div>`;
  const base = 'font-size:14.5px;line-height:1.6;color:#33415A;';
  return linhas.map(l=>{
    if(!l.trim()) return `<div style="height:10px;"></div>`;
    if(MARCADOR.test(l)) return `<div style="${base}position:relative;padding-left:26px;margin:0 0 2px 10px;${TEXTO_JUST}"><span style="position:absolute;left:6px;top:0;">•</span>${escHtml(l.replace(MARCADOR,''))}</div>`;
    const t = l.trim();
    if(t.endsWith(':') && t.length<=80) return `<div style="${base}font-weight:800;color:${BRAND.cor};margin:4px 0 6px;">${escHtml(t)}</div>`;
    return `<div style="${base}margin-bottom:6px;${TEXTO_JUST}">${escHtml(t)}</div>`;
  }).join('');
}
// Frase fixa de fechamento da página de Premissas (padrão dos projetos da Segurança Patrimonial)
export const FRASE_PREMISSAS = '“Todo o ecossistema será integrado à Central de Monitoramento CCOS | Bracell, assegurando que os analíticos de vídeo gerem alertas proativos e dados estratégicos para a gestão da segurança patrimonial e operacional da unidade.”';

export function pageObjetivo(){
  return pageShell(`
    ${pageHeader('01','Objetivo do Projeto')}
    ${triDecor({size:420, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.85})}
    <div lang="pt-BR" style="position:absolute;top:170px;left:64px;right:64px;">
      ${desviaTriangulo()}
      <div style="font-weight:800;color:${BRAND.cor};font-size:16px;margin-bottom:8px;">Área a ser Monitorada</div>
      <div style="margin-bottom:34px;">${textoEstruturado(state.objetivo.problema)}</div>
      <div style="font-weight:800;color:${BRAND.cor};font-size:16px;margin-bottom:8px;">Diretriz da Proposta</div>
      <div>${textoEstruturado(state.objetivo.solucao)}</div>
    </div>
    ${footerBrand()}
  `);
}
// Todos os pins de todas as plantas, na ordem da Estrutura: por tipo (EQUIP_TYPES) e, dentro do tipo, pelo número
function pinsGlobais(){
  const out = [];
  pontosPorTipo().forEach(g=>g.pontos.forEach(pt=>out.push({p:pt.pin, pl:state.plantas[pt.plantaIdx], li:pt.plantaIdx, pi:pt.pinIdx, numero:pt.numero})));
  return out;
}
// Legenda da página Estrutura: resumo do projeto inteiro, uma linha por tipo
// (NN = soma de qtd, ordem de EQUIP_TYPES); cercas contam os trechos traçados.
export function legendaResumo(){
  const out = pontosPorTipo().map(g=>({
    tipoId: g.tipo.id,
    qtd: g.pontos.reduce((s,pt)=>s+(parseInt(pt.pin.qtd)||1), 0),
  }));
  const nTrechos = trechosCerca().length;
  if(nTrechos) out.push({tipoId:'cerca', qtd:nTrechos});
  return out;
}
// Grupos gerados (por tipo, vivos) no lugar da entrada {gerado:true} da Estrutura
function estruturaGeradaHtml(){
  return gruposGerados().map(g=>`
    <div style="margin-bottom:20px;">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        <div style="width:20px;height:20px;border-radius:50%;background:${typeById(g.tipoId).color};flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ICONS[g.tipoId]}</div>
        <div style="font-weight:800;color:${BRAND.corSecundaria};font-size:15px;">${escHtml(g.titulo)}</div>
      </div>
      ${g.linhas.map(l=>`
        <div style="font-size:13.5px;color:#33415A;line-height:1.5;margin:0 0 4px 30px;${TEXTO_JUST}">
          <b>${escHtml(l.texto)}</b>${l.desc ? ': '+escHtml(l.desc) : ''}
        </div>`).join('')}
    </div>`).join('');
}
export function pageEstrutura(){
  const multi = state.plantas.length > 1;
  const resumo = legendaResumo();
  const areas = state.plantas.flatMap((pl,li)=>(pl.areas||[]).map(a=>({a, planta: pl.nome||('Planta '+(li+1))})));
  const blocos = (resumo.length===0 && areas.length===0) ? '' : `
      ${resumo.map(l=>`
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">
          <div style="width:20px;height:20px;border-radius:50%;background:${typeById(l.tipoId).color};flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ICONS[l.tipoId]}</div>
          <div style="font-size:13px;color:#33415A;line-height:1.4;"><b>${String(l.qtd).padStart(2,'0')}x — ${typeById(l.tipoId).label}</b></div>
        </div>`).join('')}
      ${areas.length ? `
        <div style="font-weight:800;color:${BRAND.cor};font-size:15px;margin:14px 0 12px;">Áreas Demarcadas</div>
        ${areas.map(({a, planta})=>{
          const cat = areaCatById(a.catId);
          return `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
            <div style="width:16px;height:16px;border-radius:4px;background:${cat.color}66;border:2px solid ${cat.color};margin-top:1px;flex-shrink:0;"></div>
            <div style="font-size:13px;color:#33415A;line-height:1.4;"><b>${multi ? escHtml(planta)+' — ' : ''}${cat.label}</b>${a.descricao ? ' — '+a.descricao : ''}</div>
          </div>`;
        }).join('')}` : ''}
    `;
  return pageShell(`
    ${pageHeader('03','Estrutura')}
    ${triDecor({size:420, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.85})}
    <div style="position:absolute;top:165px;left:64px;right:530px;bottom:70px;overflow:hidden;">
      ${state.estrutura.map(g=> g.gerado ? estruturaGeradaHtml() : `
        <div style="margin-bottom:20px;">
          <div style="font-weight:800;color:${BRAND.corSecundaria};font-size:15px;margin-bottom:8px;">${g.titulo||'Grupo'}</div>
          ${g.itens.map(it=>`
            <div style="font-size:13.5px;color:#33415A;line-height:1.5;margin-bottom:4px;${TEXTO_JUST}">
              <b>${(parseInt(it.qtd)||0)>=2 ? (parseInt(it.qtd)||0)+'x ' : ''}${it.nome||''}</b>${it.desc?': '+it.desc:''}
            </div>`).join('')}
        </div>`).join('')}
    </div>
    <div style="position:absolute;top:165px;right:64px;width:440px;background:#F9FAFB;border:1px solid #E3E8EF;border-radius:10px;padding:20px;">
      <div style="font-weight:800;color:${BRAND.cor};font-size:15px;margin-bottom:14px;">Legenda — Equipamentos na Planta</div>
      ${blocos.trim()==='' ? `<div style="font-size:13px;color:#8FA3BF;">Nenhum equipamento posicionado.</div>` : blocos}
    </div>
    ${footerBrand()}
  `);
}
// Planta sem nenhum conteúdo (em projetos multi-planta não gera página de Mapeamento)
export function plantaVazia(pl){
  return !pl.imagem && !pl.pins.length && !(pl.cercas||[]).length && !(pl.areas||[]).length && !(pl.etiquetas||[]).length;
}
// Tamanho estimado (px) da caixa da etiqueta no PDF (a altura real não é medida):
// fonte 12px, line-height 1.3, padding 4px 8px, borda 1.5px, largura máx. 180px.
// No PDF a caixa usa largura fixa = estimada, então o clamp horizontal é exato.
export function etqEstimaCaixa(texto){
  const linhas = String(texto||'').split('\n');
  const maxLen = Math.max(1, ...linhas.map(l=>l.length));
  const w = Math.min(180, Math.ceil(maxLen*6.6 + 19));
  const porLinha = Math.max(1, Math.floor((w-19)/6.6));
  const n = linhas.reduce((a,l)=>a+Math.max(1, Math.ceil(l.length/porLinha)), 0);
  return { w, h: Math.ceil(n*15.6 + 11) };
}
// Etiquetas de anotação (caixa + linha + seta) em px relativos ao retângulo efetivo da imagem.
// Caixa clampada para ficar inteira dentro da imagem; sem clip-path/SVG (html2canvas).
export function etiquetasHtml(pl, rect){
  // linhas+setas de todas as etiquetas primeiro, caixas por cima (uma linha não cobre o texto de outra)
  const linhas = [], caixas = [];
  (pl.etiquetas||[]).forEach(t=>{
    const {w, h} = etqEstimaCaixa(t.texto);
    const bx = Math.max(rect.x, Math.min(rect.x + (t.x/100)*rect.w, rect.x + rect.w - w));
    const by = Math.max(rect.y, Math.min(rect.y + (t.y/100)*rect.h, rect.y + rect.h - h));
    const tx = rect.x + (t.ax/100)*rect.w, ty = rect.y + (t.ay/100)*rect.h;
    const g = etqGeom(bx, by, w, h, tx, ty);
    const linha = `<div style="position:absolute;left:${g.x1}px;top:${g.y1-1}px;width:${Math.max(0, g.len-12)}px;height:2px;border-radius:1px;background:#333;transform-origin:0 1px;transform:rotate(${g.ang}deg);"></div>`;
    const seta = g.len > 12 ? `<div style="position:absolute;left:${tx}px;top:${ty}px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid #333;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(${g.ang-90}deg);"></div>` : '';
    const caixa = `<div class="etq-pdf-box" style="position:absolute;left:${bx}px;top:${by}px;width:${w}px;box-sizing:border-box;background:#FFF4C2;border:1.5px solid ${ETQ_COR};border-radius:4px;color:#222;font-size:12px;line-height:1.3;padding:4px 8px;white-space:pre-wrap;overflow-wrap:anywhere;">${escHtml(t.texto)}</div>`;
    linhas.push(linha + seta); caixas.push(caixa);
  });
  return linhas.join('') + caixas.join('');
}
function pageMapeamento(pl, dims, titulo, li){
  const BOX_W = PW - 128, BOX_H = 770; // container: left/right:64, height:770
  const rect = dims ? containRect(dims.w, dims.h, BOX_W, BOX_H) : {x:0, y:0, w:BOX_W, h:BOX_H};
  const pinsHtml = pl.pins.map((p,pi)=>{
    const t = typeById(p.tipoId);
    const left = rect.x + (p.x/100)*rect.w;
    const top = rect.y + (p.y/100)*rect.h;
    const cone = !t.cameraLike ? '' : (t.foco360
      ? `<div style="position:absolute;left:${left}px;top:${top}px;width:120px;height:120px;border-radius:50%;background:${t.color}40;border:1.5px solid ${t.color}88;box-sizing:border-box;transform:translate(-50%,-50%);"></div>`
      : `<div style="position:absolute;left:${left}px;top:${top}px;width:0;height:0;border-left:34px solid transparent;border-right:34px solid transparent;border-top:72px solid ${t.color}66;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(${p.direcao||0}deg);"></div>`);
    const badge = `<span style="position:absolute;top:-7px;right:-7px;background:#111;color:#fff;font-size:9px;font-weight:800;border-radius:50%;width:15px;height:15px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">${numeroDoPin(li, pi)}</span>`;
    return `${cone}<div style="position:absolute;left:${left}px;top:${top}px;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:${t.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">${ICONS[t.id]}${badge}</div>`;
  }).join('');
  const cercaHtml = (pl.cercas||[]).map(c=>{
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
  const areasHtml = (pl.areas||[]).map(a=>{
    const cat = areaCatById(a.catId);
    const x = rect.x + (a.x/100)*rect.w, y = rect.y + (a.y/100)*rect.h;
    const w = (a.w/100)*rect.w, h = (a.h/100)*rect.h;
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${cat.color}38;border:2px solid ${cat.color};border-radius:4px;box-sizing:border-box;"><span style="position:absolute;top:2px;left:2px;background:${cat.color};color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:3px;">${cat.label}</span></div>`;
  }).join('');
  return pageShell(`
    ${pageHeader('02', titulo)}
    <div style="position:absolute;top:165px;left:64px;right:64px;height:770px;border-radius:8px;overflow:hidden;background:#F4F6F9;border:1px solid #E3E8EF;">
      ${pl.imagem ? `<div style="width:100%;height:100%;background-image:url('${pl.imagem}');background-size:contain;background-position:center;background-repeat:no-repeat;"></div>` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8FA3BF;font-size:14px;">Planta não anexada</div>`}
      ${areasHtml}
      ${cercaHtml}
      ${pinsHtml}
      ${etiquetasHtml(pl, rect)}
    </div>
    ${footerBrand()}
  `);
}
// Legenda da ficha: linha da seção gerada da Estrutura casada pelo id do pin (texto + descrição).
// Sem seção gerada ou sem linha para o pin → string vazia (sem legenda).
export function legendaFicha(pin){
  if(!secaoGerada() || !pin?.id) return '';
  const l = gruposGerados().flatMap(g=>g.linhas).find(x=>x.id===pin.id);
  if(!l) return '';
  return `<div style="margin-top:10px;font-size:13px;line-height:1.5;color:#33415A;${TEXTO_JUST}"><b style="color:${BRAND.cor};">${escHtml(l.texto)}</b>${l.desc ? '<br>'+escHtml(l.desc) : ''}</div>`;
}
export function pageEquipamento(pin, numero, cropUrl){
  const t = typeById(pin.tipoId);
  const boxStyle = 'width:100%;height:290px;object-fit:cover;border-radius:8px;border:1px solid #E3E8EF;background:#F4F6F9;';
  const placeholder = (txt)=>`<div style="${boxStyle}display:flex;align-items:center;justify-content:center;color:#9AA7BA;font-size:13px;">${txt}</div>`;
  const legendaItem = legendaFicha(pin);
  return pageShell(`
    ${pageHeader(String(numero), `${t.label} — Ponto ${numero}` + (pin.label && pin.label!==t.label ? ' — '+escHtml(pin.label) : ''))}
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
export function pagePremissas(){
  return pageShell(`
    ${pageHeader('05','Premissas do Projeto')}
    ${triDecor({size:420, right:-140, top:-160, background:`linear-gradient(90deg, ${BRAND.corAcento}, ${BRAND.corSecundaria})`, opacity:.85})}
    <div lang="pt-BR" style="position:absolute;top:165px;left:64px;right:64px;bottom:70px;overflow:hidden;">
      ${desviaTriangulo()}
      ${state.premissas.map(p=>`
        <div style="margin-bottom:16px;font-size:14px;line-height:1.55;color:#33415A;${TEXTO_JUST}">
          <b style="color:${BRAND.cor};">${p.titulo}:</b> ${p.desc}
        </div>`).join('')}
      <div style="margin-top:28px;font-size:13.5px;line-height:1.55;color:#33415A;font-style:italic;${TEXTO_JUST}">${FRASE_PREMISSAS}</div>
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
  const gp = pinsGlobais();
  const equipCrops = [];
  for(const g of gp){ equipCrops.push(await generateCropDataURL(g.p, g.pl)); }
  const multi = state.plantas.length > 1;
  const mapPages = [];
  for(let li=0; li<state.plantas.length; li++){
    const pl = state.plantas[li];
    // Em projetos multi-planta, plantas totalmente vazias não geram página
    if(multi && plantaVazia(pl)) continue;
    const dims = await loadImageDims(pl.imagem);
    const titulo = 'Mapeamento' + (multi ? ` — ${pl.nome||('Planta '+(li+1))}` : '');
    mapPages.push(pageMapeamento(pl, dims, titulo, li));
  }
  if(mapPages.length===0) mapPages.push(pageMapeamento(state.plantas[0], null, 'Mapeamento', 0));
  const pages = [
    pageCapa(), pageSumario(), pageObjetivo(), ...mapPages, pageEstrutura(),
    ...gp.map((g,i)=>pageEquipamento(g.p, g.numero, equipCrops[i])),
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
  const chk = document.getElementById('baixarJson');
  if(chk && chk.checked){
    exportarProjeto();
    showToast('PDF e projeto editável (.json) baixados!');
  } else {
    showToast('PDF gerado com sucesso!');
  }
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
