import { state } from '../state.js';
import { showToast } from '../utils.js';
import { renderContent } from '../nav.js';

const TARGET_MAX_DIM = 2000; // px, lado maior da planta final
const THUMB_MAX_DIM  = 220;  // px, lado maior das miniaturas do seletor
const MIN_SCALE = 0.2, MAX_SCALE = 6;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export function isPdfFile(file){
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

function computeScale(page, maxDim){
  const vp1 = page.getViewport({scale:1});
  const raw = maxDim / Math.max(vp1.width, vp1.height);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

async function renderPageToDataURL(page, maxDim){
  const scale = computeScale(page, maxDim);
  const viewport = page.getViewport({scale});
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
  return canvas.toDataURL('image/png');
}

async function applyPage(pdfDoc, pageNum){
  try{
    const page = await pdfDoc.getPage(pageNum);
    const url = await renderPageToDataURL(page, TARGET_MAX_DIM);
    state.planta.imagem = url;
    state.planta.pins = [];
    state.planta.cercas = [];
    state.planta.areas = [];
    state.planta.zoom = 100;
    renderContent();
    showToast('Planta importada do PDF.');
  } catch(err){
    showToast('Não foi possível processar essa página do PDF.');
    console.error(err);
  } finally {
    pdfDoc.destroy();
  }
}

async function openPagePicker(pdfDoc){
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box wide">
      <div class="modal-title">Escolha a página da planta</div>
      <div class="pdf-page-grid"><div class="hint">Carregando páginas…</div></div>
      <div class="modal-actions"><button class="btn ghost" id="pdfPickCancel">Cancelar</button></div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#pdfPickCancel').onclick = ()=>{ ov.remove(); pdfDoc.destroy(); };

  const grid = ov.querySelector('.pdf-page-grid');
  const thumbs = [];
  for(let i=1; i<=pdfDoc.numPages; i++){
    const page = await pdfDoc.getPage(i);
    const url = await renderPageToDataURL(page, THUMB_MAX_DIM);
    page.cleanup();
    thumbs.push({num:i, url});
  }
  grid.innerHTML = thumbs.map(t=>`
    <button class="pdf-page-thumb" data-page="${t.num}">
      <img src="${t.url}"><span class="pagenum">Página ${t.num}</span>
    </button>`).join('');
  grid.querySelectorAll('.pdf-page-thumb').forEach(btn=>{
    btn.onclick = ()=>{ ov.remove(); applyPage(pdfDoc, parseInt(btn.dataset.page)); };
  });
}

export async function handlePlantaPdfUpload(file){
  let pdfDoc;
  try{
    const buf = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({data: buf}).promise;
  } catch(err){
    showToast('Não foi possível abrir o PDF. Verifique se o arquivo não está corrompido ou protegido por senha.');
    console.error(err);
    return;
  }
  if(pdfDoc.numPages <= 1){ await applyPage(pdfDoc, 1); return; }
  await openPagePicker(pdfDoc);
}
