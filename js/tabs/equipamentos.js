import { state } from '../state.js';
import { ICONS } from '../constants.js';
import { typeById, fileToDataURL, defaultCropFrac } from '../utils.js';
import { renderContent } from '../nav.js';

export function tplEquipamentos(){
  const pins = state.planta.pins;
  return `
    <h1 class="pagetitle">04 · Fichas de Equipamentos</h1>
    <p class="pagesub">Uma página individual é gerada para cada equipamento posicionado na planta, com a localização e as fotos do local.</p>
    ${pins.length===0 ? `<div class="card"><div class="empty-hint">Nenhum equipamento posicionado ainda. Vá até a aba Planta para adicionar.</div></div>` : pins.map((p,pi)=>`
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span class="icon-dot" style="width:30px;height:30px;background:${typeById(p.tipoId).color}">${ICONS[p.tipoId]}</span>
          <div>
            <div style="font-weight:800;color:var(--text-dark);">Equipamento ${pi+1} — ${typeById(p.tipoId).label}</div>
            <div style="font-size:12.5px;color:var(--text-mid);">${p.label||''}</div>
          </div>
        </div>
        <div class="row">
          <div>
            <label>Localização na planta (automática)</label>
            <img id="cropPreview-${pi}" style="width:100%;height:150px;object-fit:cover;border-radius:8px;border:1px solid #E3E8EF;background:#F4F6F9;">
            <label style="margin-top:8px;">Zoom do recorte</label>
            <input id="cropSlider-${pi}" type="range" min="10" max="60" step="1"
              value="${Math.round((p.cropFrac||0.28)*100)}"
              onchange="setCropFrac(${pi}, this.value)" style="width:100%;">
          </div>
          <div>
            <label>Foto do local de instalação</label>
            <input type="file" accept="image/*" onchange="handleEquipPhoto(event, ${pi}, 'fotoLocal')" style="margin-bottom:8px;">
            ${p.fotoLocal ? `<img src="${p.fotoLocal}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;">` : ''}
          </div>
          <div>
            <label>Foto do que o equipamento vai visualizar</label>
            <input type="file" accept="image/*" onchange="handleEquipPhoto(event, ${pi}, 'fotoView')" style="margin-bottom:8px;">
            ${p.fotoView ? `<img src="${p.fotoView}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;">` : ''}
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

export async function handleEquipPhoto(e, pi, field){
  const f = e.target.files[0]; if(!f) return;
  const durl = await fileToDataURL(f);
  state.planta.pins[pi][field] = durl;
  renderContent();
}

export function setCropFrac(pi, val){
  state.planta.pins[pi].cropFrac = parseInt(val)/100;
  generateCropDataURL(state.planta.pins[pi]).then(url=>{
    const el = document.getElementById('cropPreview-'+pi);
    if(el && url) el.src = url;
  });
}

export function afterEquipamentosRender(){
  const sync = (naturalWidth)=>{
    state.planta.pins.forEach((p,pi)=>{
      if(!p.cropFrac){
        const s = document.getElementById('cropSlider-'+pi);
        if(s) s.value = Math.round(defaultCropFrac(naturalWidth)*100);
      }
    });
  };
  if(state.planta.imagem){
    const img = new Image();
    img.onload = ()=>sync(img.naturalWidth);
    img.src = state.planta.imagem;
  }
  state.planta.pins.forEach((p,pi)=>{
    generateCropDataURL(p).then(url=>{
      const el = document.getElementById('cropPreview-'+pi);
      if(el && url) el.src = url;
    });
  });
}

export function generateCropDataURL(pin){
  return new Promise((resolve)=>{
    if(!state.planta.imagem){ resolve(null); return; }
    const img = new Image();
    img.onload = ()=>{
      const cw = img.naturalWidth, ch = img.naturalHeight;
      const cropFrac = pin.cropFrac || defaultCropFrac(cw);
      const cropW = cw*cropFrac, cropH = ch*cropFrac;
      let sx = (pin.x/100)*cw - cropW/2;
      let sy = (pin.y/100)*ch - cropH/2;
      sx = Math.max(0, Math.min(cw-cropW, sx));
      sy = Math.max(0, Math.min(ch-cropH, sy));
      const canvas = document.createElement('canvas');
      canvas.width = 500; canvas.height = 350;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F4F6F9'; ctx.fillRect(0,0,canvas.width,canvas.height);
      const scale = Math.min(canvas.width/cropW, canvas.height/cropH);
      const dw = cropW*scale, dh = cropH*scale;
      const dx = (canvas.width-dw)/2, dy = (canvas.height-dh)/2;
      ctx.drawImage(img, sx, sy, cropW, cropH, dx, dy, dw, dh);
      const markerX = dx + ((pin.x/100*cw - sx)/cropW)*dw;
      const markerY = dy + ((pin.y/100*ch - sy)/cropH)*dh;
      // Foco da câmera por baixo do marcador: setor na direção do pin, ou círculo cheio (foco360)
      const t = typeById(pin.tipoId);
      if(t.cameraLike){
        const R = 75; // px do canvas — visual consistente entre fichas, independente do cropFrac
        ctx.fillStyle = t.color + '40';
        if(t.foco360){
          ctx.beginPath();
          ctx.arc(markerX, markerY, R, 0, Math.PI*2);
          ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = t.color + '88'; ctx.stroke();
        } else {
          const a = ((pin.direcao||0) - 90) * Math.PI/180; // 0° = norte/topo → ângulo do canvas
          const half = 24 * Math.PI/180;                   // meio-ângulo do cone do editor
          ctx.beginPath();
          ctx.moveTo(markerX, markerY);
          ctx.arc(markerX, markerY, R, a - half, a + half);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.beginPath();
      ctx.arc(markerX, markerY, 10, 0, Math.PI*2);
      ctx.fillStyle = typeById(pin.tipoId).color;
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = ()=>resolve(null);
    img.src = state.planta.imagem;
  });
}
