import { state, pinOffsetGlobal } from '../state.js';
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
          <input type="text" class="group-title" placeholder="Nome do grupo (ex: Defesa Perimetral Anti-Invasão)" value="${g.titulo}" oninput="state.estrutura[${gi}].titulo=this.value">
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
  // Um grupo por planta; um item por pin (sem agrupar), numerado com o número
  // global do pin — o mesmo do editor, do Mapeamento do PDF e do cabeçalho da ficha.
  const multi = state.plantas.length > 1;
  let criados = 0;
  state.plantas.forEach((pl,li)=>{
    const off = pinOffsetGlobal(li);
    const itens = pl.pins.map((p,pi)=>({
      qtd: parseInt(p.qtd)||1,
      nome: `${p.label||typeById(p.tipoId).label} — Ponto ${off+pi+1}`,
      desc: '',
    }));
    (pl.cercas||[]).forEach(c=>{
      itens.push({qtd:1, nome:c.label||'Cerca / Concertina', desc:''});
    });
    if(itens.length===0) return;
    state.estrutura.push({titulo: 'Equipamentos Mapeados'+(multi?` — ${pl.nome||('Planta '+(li+1))}`:''), itens});
    criados++;
  });
  if(criados===0){ showToast('Nenhum ponto na planta para importar.'); return; }
  showToast(criados>1 ? `${criados} grupos criados a partir das plantas.` : 'Grupo criado a partir da planta.');
  switchTab('estrutura');
}
