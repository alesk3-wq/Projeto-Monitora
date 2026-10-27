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
// Margem direita das colunas de texto (Objetivo, Premissas): coluna reta que termina antes do
// canto verde/azul (cantoArte) — abaixo de y≈200 a borda da arte fica em x≥1236 e a ponta azul em
// x≈1265 (y≈330); texto até x=1234.
const MARGEM_DIR_TEXTO = 180;
// Sem hyphens:auto de propósito: o navegador quebraria a palavra mas o html2canvas não desenha
// o hífen automático — no PDF a palavra saía cortada sem traço.
const TEXTO_JUST = 'text-align:justify;';
// Fonte de todo o PDF: Calibri Light/Bold do PC (@font-face 'PdfFonte' em css/style.css) ou Carlito
const FONTE_PDF = "'PdfFonte','Carlito',sans-serif";
async function carregarFontesPdf(){
  try{
    await Promise.all(['300 16px PdfFonte','700 16px PdfFonte','italic 300 16px PdfFonte','16px Carlito','700 16px Carlito','italic 16px Carlito']
      .map(f=>document.fonts.load(f)));
  }catch(e){ /* sem fonte carregada o PDF sai com o fallback — não bloqueia a geração */ }
}

// O PNG da logo é um quadrado com muita margem vazia (a marca ocupa ~1/4 da altura), então no PDF
// usamos uma cópia recortada só na marca — senão aumentar a altura do <img> quase não aumenta a logo.
let logoPdf = BRAND.logo;
async function prepararLogoPdf(){
  if(logoPdf !== BRAND.logo) return;
  try{
    const img = await new Promise((ok,erro)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=erro; i.src=BRAND.logo; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img,0,0);
    const d = ctx.getImageData(0,0,c.width,c.height).data;
    let x0=c.width, y0=c.height, x1=-1, y1=-1;
    for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){
      const k=(y*c.width+x)*4;
      // pixel "vazio" = transparente ou quase branco
      if(d[k+3]<20 || (d[k]>235 && d[k+1]>235 && d[k+2]>235)) continue;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
    if(x1<0) return;
    const r = document.createElement('canvas');
    r.width = x1-x0+1; r.height = y1-y0+1;
    r.getContext('2d').drawImage(c, x0,y0,r.width,r.height, 0,0,r.width,r.height);
    logoPdf = r.toDataURL('image/png');
  }catch(e){ /* sem recorte o PDF usa o PNG original */ }
}

function pageShell(inner){
  return `<div style="width:${PW}px;height:${PH}px;position:relative;overflow:hidden;background:#fff;font-family:${FONTE_PDF};">${inner}</div>`;
}
// Layout copiado do documento de referência (Projeto 089-110926 Rev3.1): as artes de fundo
// (foto + formas da capa, foto + formas do sumário, canto verde/azul das páginas de texto) foram
// renderizadas do PDF original sem o texto e ficam em assets/pdf/; posições e tamanhos dos textos
// abaixo foram medidos no mesmo PDF (página 1414×1000).
const ARTE = { capa:'assets/pdf/capa.jpg', sumario:'assets/pdf/sumario.jpg', canto:'assets/pdf/canto.jpg' };
const COR_TEXTO_REF = '#231F20';
// Texto posicionado pela linha de base (x, base em px da página), como medido no PDF de referência.
// Com line-height:1 a base da Calibri/Carlito cai ~0.85em abaixo do topo da caixa no html2canvas
// (medido sobrepondo o render ao PDF de referência).
function txtBase(x, base, size, css, html){
  return `<div style="position:absolute;left:${x}px;top:${base - size*0.85}px;font-size:${size}px;line-height:1;white-space:nowrap;color:${COR_TEXTO_REF};${css}">${html}</div>`;
}
// Canto verde/azul do topo direito (páginas Objetivo, Estrutura, Premissas e Encerramento)
function cantoArte(){
  return `<img src="${ARTE.canto}" style="position:absolute;left:1020px;top:0;width:394px;height:500px;">`;
}
// Logo grande do rodapé no tamanho/posição do modelo — só no Encerramento; as páginas internas
// usam o rodapé pequeno (footerBrand) em todas, para ficarem iguais entre si
function logoRodape(){
  return `<img src="${logoPdf}" style="position:absolute;left:41px;top:901px;height:46px;">`;
}
// Cabeçalho de seção do modelo: círculo cinza com o número + título preto sobre um fio fino.
// alto=false → posição das páginas Objetivo/Estrutura; alto=true → Mapeamento/fichas/Premissas.
function pageHeader(num, title, alto=false){
  const dx = alto ? -7 : 0, dy = alto ? -82 : 0;
  return `
    <div style="position:absolute;left:${74+dx}px;top:${147.5+dy}px;width:78.5px;height:78.5px;border-radius:50%;background:#D9D9D9;display:flex;align-items:center;justify-content:center;font-size:38.3px;color:${COR_TEXTO_REF};">${num}</div>
    <div style="position:absolute;left:${152.5+dx}px;top:${187+dy}px;width:268px;height:1.2px;background:${COR_TEXTO_REF};"></div>
    ${tituloSecao(167+dx, 172+dy, title)}`;
}
// Título do cabeçalho: mesma posição de txtBase (base da última linha em `base`), mas quebra linha
// quando é longo (ficha com rótulo, Mapeamento com nome de planta). Ancorado por baixo, as linhas
// extras crescem para cima e o título nunca invade o fio nem o conteúdo; largura até a margem direita.
function tituloSecao(x, base, title){
  // títulos enormes (3+ linhas) diminuem para não sair pelo topo da página
  const size = String(title).length > 130 ? 24 : 31.1, lh = 1.1;
  const bottom = PH - (base + size*0.15 + size*(lh-1)/2);
  return `<div style="position:absolute;left:${x}px;bottom:${bottom}px;width:${PW - 64 - x}px;font-size:${size}px;line-height:${lh};font-weight:700;color:${COR_TEXTO_REF};overflow-wrap:anywhere;">${title}</div>`;
}
function footerBrand(){
  return `<div style="position:absolute;bottom:22px;left:64px;display:flex;align-items:center;gap:14px;color:#8FA3BF;font-size:14px;font-weight:600;">
    <img src="${logoPdf}" style="height:22px;">
    <span>${BRAND.nome} · ${BRAND.departamento}</span>
  </div>`;
}

function pageCapa(){
  // Fundo = capa do modelo sem texto (foto, formas azuis, pontilhado verde e logo já fazem parte da arte);
  // a caixa azul da unidade é desenhada aqui para crescer com nomes longos.
  const data = fmtDate(state.projeto.data).split(' | ').join(', ');
  return pageShell(`
    <img src="${ARTE.capa}" style="position:absolute;left:0;top:0;width:${PW}px;height:${PH}px;">
    ${txtBase(53.2, 467, 77.8, 'font-weight:700;', 'PROJETO')}
    ${txtBase(53.2, 557, 59.4, 'font-weight:700;', 'SEG. ELETRÔNICA')}
    <div style="position:absolute;left:65px;top:599.5px;min-width:412.5px;max-width:560px;min-height:54.5px;box-sizing:border-box;padding:4px 32px 9px;background:#2152A1;color:#fff;font-size:23.8px;line-height:1.15;display:flex;align-items:center;">${escHtml(state.projeto.unidade || 'Unidade não definida')}</div>
    ${txtBase(59.3, 711, 39.2, 'font-weight:700;', 'DEPTO. '+escHtml(BRAND.departamento.toUpperCase()))}
    ${txtBase(59.3, 754, 29.6, '', escHtml(state.projeto.equipe||''))}
    ${data ? txtBase(59.3, 833, 29.6, '', `<b style="font-weight:700;">Data:</b>${escHtml(data)}`) : ''}
  `);
}
function pageSumario(){
  // Fundo = sumário do modelo sem a lista (o modelo tem 4 itens; aqui são 5). A lista segue a
  // geometria do modelo: círculos de 77px a cada 85px, o 1º preto, os demais cinza, fio até x=433.
  const items = [['01','Objetivo do Projeto'],['02','Mapeamento'],['03','Estrutura'],['04','Fichas de Equipamentos'],['05','Premissas']];
  return pageShell(`
    <img src="${ARTE.sumario}" style="position:absolute;left:0;top:0;width:${PW}px;height:${PH}px;">
    ${txtBase(127.9, 192, 43.4, "font-family:Arial,'Liberation Sans',sans-serif;", 'Sumário')}
    ${items.map(([n,l],i)=>{
      const cy = 311 + i*85;
      return `
      <div style="position:absolute;left:100px;top:${cy-38.5}px;width:77px;height:77px;border-radius:50%;background:${i===0?'#000':'#D9D9D9'};color:${i===0?'#fff':COR_TEXTO_REF};display:flex;align-items:center;justify-content:center;font-size:36.9px;">${n}</div>
      <div style="position:absolute;left:177px;top:${cy}px;width:256px;height:1.2px;background:#616161;"></div>
      ${txtBase(190.3, cy-17, 20.8, '', l)}`;
    }).join('')}
  `);
}
// Texto livre do usuário com a estrutura do modelo de referência: linhas que começam com
// •, -, * ou – viram itens de lista (marcador + recuo); as demais viram parágrafos justificados;
// linha em branco vira espaço entre blocos.
const MARCADOR = /^\s*[•\-*–·]\s+/;
export function textoEstruturado(txt){
  const linhas = String(txt||'').replace(/\r/g,'').split('\n');
  if(!linhas.some(l=>l.trim())) return `<div style="font-size:20px;color:${COR_TEXTO_REF};">—</div>`;
  const base = `font-size:20px;line-height:1.42;color:${COR_TEXTO_REF};`;
  return linhas.map(l=>{
    if(!l.trim()) return `<div style="height:10px;"></div>`;
    if(MARCADOR.test(l)) return `<div style="${base}position:relative;padding-left:34px;margin:0;${TEXTO_JUST}"><span style="position:absolute;left:17px;top:0;">•</span>${escHtml(l.replace(MARCADOR,''))}</div>`;
    const t = l.trim();
    if(t.endsWith(':') && t.length<=80) return `<div style="${base}font-weight:700;margin:4px 0 8px;">${escHtml(t)}</div>`;
    return `<div style="${base}margin-bottom:8px;${TEXTO_JUST}">${escHtml(t)}</div>`;
  }).join('');
}
// "Considerações finais" (aba Premissas): fim da página de Premissas, em itálico e entre aspas.
// Aspas digitadas pelo usuário nas pontas são removidas para não duplicar; vazio → nada.
export function consideracoesHtml(){
  const t = String(state.consideracoes||'').trim().replace(/^["“”]+|["“”]+$/g, '').trim();
  if(!t) return '';
  return `<div style="margin-top:40px;font-size:16.8px;line-height:1.38;color:${COR_TEXTO_REF};font-style:italic;white-space:pre-wrap;${TEXTO_JUST}">“${escHtml(t)}”</div>`;
}

export function pageObjetivo(){
  return pageShell(`
    ${pageHeader('01','Objetivo do Projeto')}
    ${cantoArte()}
    <div data-fluxo lang="pt-BR" style="position:absolute;top:225px;left:114px;right:${MARGEM_DIR_TEXTO}px;bottom:60px;overflow:hidden;"><div data-fluxo-inner>
      <div style="font-weight:700;color:${COR_TEXTO_REF};font-size:20px;margin-bottom:10px;">Área a ser Monitorada:</div>
      <div style="margin-bottom:34px;">${textoEstruturado(state.objetivo.problema)}</div>
      <div style="font-weight:700;color:${COR_TEXTO_REF};font-size:20px;margin-bottom:10px;">Diretriz da Proposta:</div>
      <div>${textoEstruturado(state.objetivo.solucao)}</div>
    </div></div>
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
// Com li (índice da planta) resume só aquela planta — usado na legenda do Mapeamento.
export function legendaResumo(li=null){
  const daPlanta = pt => li===null || pt.plantaIdx===li;
  const out = pontosPorTipo().map(g=>({
    tipoId: g.tipo.id,
    qtd: g.pontos.filter(daPlanta).reduce((s,pt)=>s+(parseInt(pt.pin.qtd)||1), 0),
  })).filter(l=>l.qtd>0);
  const nTrechos = trechosCerca().filter(daPlanta).length;
  if(nTrechos) out.push({tipoId:'cerca', qtd:nTrechos});
  return out;
}
// Grupos gerados (por tipo, vivos) no lugar da entrada {gerado:true} da Estrutura
function estruturaGeradaHtml(){
  return gruposGerados().map(g=>`
    <div style="margin-bottom:20px;">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        <div style="width:20px;height:20px;border-radius:50%;background:${typeById(g.tipoId).color};flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ICONS[g.tipoId]}</div>
        <div style="font-weight:700;color:${COR_TEXTO_REF};font-size:19px;">${escHtml(g.titulo)}</div>
      </div>
      ${g.linhas.map(l=>`
        <div style="font-size:17px;color:${COR_TEXTO_REF};line-height:1.45;margin:0 0 4px 30px;${TEXTO_JUST}">
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
          <div style="font-size:15px;color:#33415A;line-height:1.4;"><b>${String(l.qtd).padStart(2,'0')}x — ${typeById(l.tipoId).label}</b></div>
        </div>`).join('')}
      ${areas.length ? `
        <div style="font-weight:800;color:${BRAND.cor};font-size:17px;margin:14px 0 12px;">Áreas Demarcadas</div>
        ${areas.map(({a, planta})=>{
          const cat = areaCatById(a.catId);
          return `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
            <div style="width:16px;height:16px;border-radius:4px;background:${cat.color}66;border:2px solid ${cat.color};margin-top:1px;flex-shrink:0;"></div>
            <div style="font-size:15px;color:#33415A;line-height:1.4;"><b>${multi ? escHtml(planta)+' — ' : ''}${cat.label}</b>${a.descricao ? ' — '+a.descricao : ''}</div>
          </div>`;
        }).join('')}` : ''}
    `;
  return pageShell(`
    ${pageHeader('03','Estrutura')}
    ${cantoArte()}
    <div data-fluxo style="position:absolute;top:235px;left:114px;right:530px;bottom:60px;overflow:hidden;"><div data-fluxo-inner>
      ${state.estrutura.map(g=> g.gerado ? estruturaGeradaHtml() : `
        <div style="margin-bottom:20px;">
          <div style="font-weight:700;color:${COR_TEXTO_REF};font-size:19px;margin-bottom:8px;">${g.titulo||'Grupo'}</div>
          ${g.itens.map(it=>`
            <div style="font-size:17px;color:${COR_TEXTO_REF};line-height:1.45;margin-bottom:4px;${TEXTO_JUST}">
              <b>${(parseInt(it.qtd)||0)>=2 ? (parseInt(it.qtd)||0)+'x ' : ''}${it.nome||''}</b>${it.desc?': '+it.desc:''}
            </div>`).join('')}
        </div>`).join('')}
    </div></div>
    <div style="position:absolute;top:440px;right:64px;width:440px;max-height:450px;overflow:hidden;box-sizing:border-box;background:#F9FAFB;border:1px solid #E3E8EF;border-radius:10px;padding:20px;">
      <div style="font-weight:800;color:${BRAND.cor};font-size:17px;margin-bottom:14px;">Legenda — Equipamentos na Planta</div>
      ${blocos.trim()==='' ? `<div style="font-size:15px;color:#8FA3BF;">Nenhum equipamento posicionado.</div>` : blocos}
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
// Legenda embaixo da planta no Mapeamento (só os itens daquela planta): equipamentos em 4 colunas,
// áreas em 2. Altura estimada pelo nº de linhas para a planta ocupar o resto da página.
function legendaMapeamento(pl, li){
  const eq = legendaResumo(li), areas = pl.areas||[];
  if(!eq.length && !areas.length) return {html:'', h:0};
  const h = 24 + 28 + Math.ceil(eq.length/4)*26 + Math.ceil(areas.length/2)*44;
  const html = `
      <div style="font-weight:800;color:${BRAND.cor};font-size:15px;margin-bottom:8px;">Legenda</div>
      <div style="display:flex;flex-wrap:wrap;row-gap:8px;">
        ${eq.map(l=>`<div style="width:25%;display:flex;gap:8px;align-items:center;">
          <div style="width:18px;height:18px;border-radius:50%;background:${typeById(l.tipoId).color};flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ICONS[l.tipoId]}</div>
          <div style="font-size:14px;color:${COR_TEXTO_REF};font-weight:700;">${String(l.qtd).padStart(2,'0')}x — ${typeById(l.tipoId).label}</div>
        </div>`).join('')}
        ${areas.map(a=>{ const cat = areaCatById(a.catId); return `<div style="width:50%;display:flex;gap:8px;align-items:flex-start;box-sizing:border-box;padding-right:16px;">
          <div style="width:14px;height:14px;border-radius:3px;background:${cat.color}66;border:2px solid ${cat.color};margin-top:2px;flex-shrink:0;"></div>
          <div style="font-size:14px;color:${COR_TEXTO_REF};line-height:1.35;"><b>${cat.label}</b>${a.descricao ? ' — '+escHtml(a.descricao) : ''}</div>
        </div>`; }).join('')}
      </div>`;
  return {html, h};
}
function pageMapeamento(pl, dims, titulo, li){
  // planta logo abaixo do cabeçalho (top 155) até o rodapé (y 940), descontando a legenda
  const leg = legendaMapeamento(pl, li);
  const TOP = 155, BOX_W = PW - 128, BOX_H = 940 - TOP - (leg.h ? leg.h + 12 : 0);
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
    ${pageHeader('02', titulo, true)}
    <div style="position:absolute;top:${TOP}px;left:64px;right:64px;height:${BOX_H}px;border-radius:8px;overflow:hidden;background:#F4F6F9;border:1px solid #E3E8EF;">
      ${pl.imagem ? `<div style="width:100%;height:100%;background-image:url('${pl.imagem}');background-size:contain;background-position:center;background-repeat:no-repeat;"></div>` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8FA3BF;font-size:16px;">Planta não anexada</div>`}
      ${areasHtml}
      ${cercaHtml}
      ${pinsHtml}
      ${etiquetasHtml(pl, rect)}
    </div>
    ${leg.h ? `<div style="position:absolute;left:64px;right:64px;top:${TOP+BOX_H+12}px;height:${leg.h}px;box-sizing:border-box;overflow:hidden;background:#F9FAFB;border:1px solid #E3E8EF;border-radius:8px;padding:12px 16px;">${leg.html}</div>` : ''}
    ${footerBrand()}
  `);
}
// Legenda da ficha: linha da seção gerada da Estrutura casada pelo id do pin (texto + descrição).
// Sem seção gerada ou sem linha para o pin → string vazia (sem legenda).
export function legendaFicha(pin){
  if(!secaoGerada() || !pin?.id) return '';
  const l = gruposGerados().flatMap(g=>g.linhas).find(x=>x.id===pin.id);
  if(!l) return '';
  return `<div style="margin-top:10px;font-size:15px;line-height:1.5;color:#33415A;${TEXTO_JUST}"><b style="color:${BRAND.cor};">${escHtml(l.texto)}</b>${l.desc ? '<br>'+escHtml(l.desc) : ''}</div>`;
}
export function pageEquipamento(pin, numero, cropUrl){
  const t = typeById(pin.tipoId);
  const boxStyle = 'width:100%;height:290px;object-fit:cover;border-radius:8px;border:1px solid #E3E8EF;background:#F4F6F9;';
  const placeholder = (txt)=>`<div style="${boxStyle}display:flex;align-items:center;justify-content:center;color:#9AA7BA;font-size:15px;">${txt}</div>`;
  const legendaItem = legendaFicha(pin);
  const rotulo = (txt)=>`<div style="font-weight:800;color:${BRAND.cor};font-size:15px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">${txt}</div>`;
  // Fotos não anexadas não geram quadro vazio. Sem nenhuma foto, o recorte da planta cresce e fica
  // centralizado (700×490, proporção do recorte 500×350); com uma foto, as colunas mantêm a largura
  // do padrão de 3 colunas e só o quadro que falta sai.
  const soCorte = !pin.fotoLocal && !pin.fotoView;
  const corteStyle = soCorte ? boxStyle.replace('height:290px;','height:490px;') : boxStyle;
  const colW = soCorte ? '700px' : `${(PW-128-48)/3}px`;
  const colunas = [`
      <div style="width:${colW};flex-shrink:0;">
        ${rotulo('Localização na Planta')}
        ${cropUrl ? `<img src="${cropUrl}" style="${corteStyle}">` : `<div style="${corteStyle}display:flex;align-items:center;justify-content:center;color:#9AA7BA;font-size:15px;">Planta não anexada</div>`}
        ${legendaItem}
      </div>`];
  if(pin.fotoLocal) colunas.push(`
      <div style="width:${colW};flex-shrink:0;">
        ${rotulo('Local de Instalação')}
        <img src="${pin.fotoLocal}" style="${boxStyle}">
      </div>`);
  if(pin.fotoView) colunas.push(`
      <div style="width:${colW};flex-shrink:0;">
        ${rotulo('Visualização Esperada')}
        <img src="${pin.fotoView}" style="${boxStyle}">
      </div>`);
  return pageShell(`
    ${pageHeader('04', `${t.label} — Ponto ${numero}` + (pin.label && pin.label!==t.label ? ' — '+escHtml(pin.label) : ''), true)}
    <div style="position:absolute;top:170px;left:64px;right:64px;bottom:70px;display:flex;gap:24px;justify-content:${soCorte?'center':'flex-start'};">
      ${colunas.join('')}
    </div>
    ${footerBrand()}
  `);
}
export function pagePremissas(){
  return pageShell(`
    ${pageHeader('05','Premissas do Projeto', true)}
    ${cantoArte()}
    <div data-fluxo lang="pt-BR" style="position:absolute;top:205px;left:97px;right:${MARGEM_DIR_TEXTO}px;bottom:60px;overflow:hidden;"><div data-fluxo-inner>
      ${state.premissas.map(p=>`
        <div style="margin-bottom:26px;font-size:19px;line-height:1.36;color:${COR_TEXTO_REF};${TEXTO_JUST}">
          <b style="font-weight:700;">${p.titulo}:</b> ${p.desc}
        </div>`).join('')}
      ${consideracoesHtml()}
    </div></div>
    ${footerBrand()}
  `);
}
function pageEncerramento(){
  return pageShell(`
    ${cantoArte()}
    ${txtBase(138.2, 567, 128, 'font-weight:700;', (BRAND.slogan||'').toUpperCase())}
    ${logoRodape()}
  `);
}

// Páginas de texto (Objetivo, Estrutura, Premissas): se o conteúdo não cabe na área de texto, reduz o
// bloco proporcionalmente (transform:scale, até 70%). Retorna false se nem assim coube.
export function ajustarFluxo(pagina){
  const box = pagina.querySelector('[data-fluxo]'), inner = box && box.querySelector('[data-fluxo-inner]');
  if(!inner) return true;
  const cabe = ()=> inner.getBoundingClientRect().height <= box.clientHeight + 1;
  if(cabe()) return true;
  inner.style.transformOrigin = '0 0';
  let s = 1;
  for(let k=0; k<8 && !cabe() && s>0.7; k++){
    s = Math.max(0.7, s * box.clientHeight / inner.getBoundingClientRect().height);
    inner.style.width = (100/s)+'%';
    inner.style.transform = `scale(${s})`;
  }
  return cabe();
}

export async function gerarPDF(){
  showToast('Gerando PDF…');
  await carregarFontesPdf();
  await prepararLogoPdf();
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
  let naoCouberam = 0;
  for(let i=0;i<pages.length;i++){
    const div = document.createElement('div');
    div.innerHTML = pages[i];
    root.appendChild(div);
    await new Promise(r=>setTimeout(r,60));
    if(!ajustarFluxo(div)) naoCouberam++;
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
    showToast(naoCouberam ? 'PDF gerado — atenção: texto longo demais em '+naoCouberam+' página(s), parte foi cortada. Encurte o texto.' : 'PDF gerado com sucesso!');
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
