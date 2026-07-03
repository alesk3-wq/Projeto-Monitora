import { state } from '../state.js';
import { typeById, showToast } from '../utils.js';
import { renderContent, switchTab } from '../nav.js';

export function tplEstrutura(){
  const groups = state.estrutura;
  return `
    <h1 class="pagetitle">03 · Estrutura de Equipamentos</h1>
    <p class="pagesub">Agrupe os equipamentos por função de segurança (ex: Defesa Perimetral, Controle de Acesso).</p>
    ${groups.map((g,gi)=>`
      <div class="group">
        <div class="group-head">
          <input type="text" style="margin-bottom:0;font-weight:700;max-width:360px;" placeholder="Nome do grupo (ex: Defesa Perimetral Anti-Invasão)" value="${g.titulo}" oninput="state.estrutura[${gi}].titulo=this.value">
          <button class="btn danger" onclick="removeGroup(${gi})">Remover grupo</button>
        </div>
        ${g.itens.map((it,ii)=>`
          <div class="item-row">
            <input class="qtd" type="number" min="0" placeholder="Qtd" value="${it.qtd}" oninput="state.estrutura[${gi}].itens[${ii}].qtd=this.value">
            <input class="nome" type="text" placeholder="Equipamento (ex: Câmera Bullet c/ IA)" value="${it.nome}" oninput="state.estrutura[${gi}].itens[${ii}].nome=this.value">
            <input class="desc" type="text" placeholder="Descrição / finalidade" value="${it.desc}" oninput="state.estrutura[${gi}].itens[${ii}].desc=this.value">
            <button class="btn danger small" onclick="removeItem(${gi},${ii})">✕</button>
          </div>
        `).join('')}
        <button class="btn ghost small" onclick="addItem(${gi})">+ Item</button>
      </div>
    `).join('')}
    <div style="display:flex;gap:10px;">
      <button class="btn ghost" onclick="addGroup()">+ Novo grupo</button>
      <button class="btn ghost" onclick="importFromPlanta()">↺ Gerar a partir da planta</button>
    </div>
  `;
}

export function addGroup(){ state.estrutura.push({titulo:'', itens:[{qtd:1,nome:'',desc:''}]}); renderContent(); }
export function removeGroup(gi){ state.estrutura.splice(gi,1); renderContent(); }
export function addItem(gi){ state.estrutura[gi].itens.push({qtd:1,nome:'',desc:''}); renderContent(); }
export function removeItem(gi,ii){ state.estrutura[gi].itens.splice(ii,1); renderContent(); }

export function importFromPlanta(){
  const map = {};
  state.planta.pins.forEach(p=>{
    const key = p.tipoId+'|'+p.label;
    if(!map[key]) map[key] = {qtd:0, nome:p.label||typeById(p.tipoId).label, desc:''};
    map[key].qtd += (parseInt(p.qtd)||1);
  });
  const itens = Object.values(map);
  if(itens.length===0){ showToast('Nenhum ponto na planta para importar.'); return; }
  state.estrutura.push({titulo:'Equipamentos Mapeados', itens});
  showToast('Grupo criado a partir da planta.');
  switchTab('estrutura');
}
