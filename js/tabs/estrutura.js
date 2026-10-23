import { state } from '../state.js';
import { pontosPorTipo, trechosCerca } from '../numeracao.js';
import { ICONS } from '../constants.js';
import { typeById, showToast, escHtml } from '../utils.js';
import { renderContent, switchTab } from '../nav.js';

// Seção gerada da Estrutura: uma entrada {gerado:true, descs:{[id do pin/cerca]: texto}} em
// state.estrutura (no máximo uma). Cabeçalhos e linhas são calculados da planta na hora
// (gruposGerados); só a descrição digitada fica gravada, presa ao id do pin/cerca.
export function secaoGerada(){ return state.estrutura.find(g=>g.gerado) || null; }

const nn = n=>String(n).padStart(2,'0');

// Grupos vivos ({tipoId, titulo, qtd, linhas:[{id, texto, desc}]}): um por tipo de pin presente (ordem de EQUIP_TYPES) + cercas por último.
// Descrições de ids que não existem mais na planta são simplesmente ignoradas.
export function gruposGerados(){
  const descs = secaoGerada()?.descs || {};
  const multi = state.plantas.length > 1;
  const prefixo = li=>multi ? `${state.plantas[li].nome||('Planta '+(li+1))} — ` : '';
  const grupos = pontosPorTipo().map(({tipo, pontos})=>{
    const total = pontos.reduce((s,pt)=>s+(parseInt(pt.pin.qtd)||1), 0);
    return {
      tipoId: tipo.id,
      titulo: `${nn(total)}x ${tipo.label}`,
      qtd: total,
      linhas: pontos.map(pt=>{
        const q = parseInt(pt.pin.qtd)||1;
        return {
          id: pt.pin.id,
          texto: `${prefixo(pt.plantaIdx)}Ponto ${pt.numero} — ${pt.pin.label||tipo.label}${q>=2 ? ` (${q}x)` : ''}`,
          desc: descs[pt.pin.id] || '',
        };
      }),
    };
  });
  const trechos = trechosCerca();
  if(trechos.length){
    grupos.push({
      tipoId: 'cerca',
      titulo: `${nn(trechos.length)}x ${typeById('cerca').label}`,
      qtd: trechos.length,
      linhas: trechos.map(t=>({
        id: t.cerca.id,
        texto: `${prefixo(t.plantaIdx)}Trecho ${t.numero} — ${t.cerca.label||typeById('cerca').label}`,
        desc: descs[t.cerca.id] || '',
      })),
    });
  }
  return grupos;
}

// Grupos da Estrutura como aparecem (manuais + gerados expandidos) — para contadores/validação.
export function resumoEstrutura(){
  let grupos = 0, itens = 0, temItens = false;
  state.estrutura.forEach(g=>{
    if(g.gerado){
      gruposGerados().forEach(gg=>{
        grupos++;
        itens += gg.qtd;
        if(gg.linhas.length) temItens = true;
      });
    } else {
      grupos++;
      (g.itens||[]).forEach(it=>{
        itens += parseInt(it.qtd)||0;
        if((it.nome||'').trim()) temItens = true;
      });
    }
  });
  return { grupos, itens, temItens };
}

function tplSecaoGerada(){
  const grupos = gruposGerados();
  return `
    <div class="group group-gerada">
      <div class="group-head">
        <div class="gerado-titulo">Equipamentos da planta <span>· sincronizado com a planta</span></div>
        <button class="btn danger" onclick="removeSecaoGerada()">Remover seção gerada</button>
      </div>
      ${grupos.length===0 ? `<div class="empty-hint" style="padding:16px;">Nenhum equipamento na planta. Posicione equipamentos na aba Planta — eles aparecem aqui automaticamente.</div>` : ''}
      ${grupos.map(g=>`
        <div class="gerado-grupo">
          <div class="gerado-head">
            <span class="icon-dot" style="background:${typeById(g.tipoId).color}">${ICONS[g.tipoId]}</span>${escHtml(g.titulo)}
          </div>
          ${g.linhas.map(l=>`
            <div class="gerado-linha">
              <div class="gerado-texto">${escHtml(l.texto)}</div>
              <input type="text" placeholder="Descrição / finalidade" value="${escHtml(l.desc)}" oninput="setDescGerada('${l.id}', this.value)">
            </div>`).join('')}
        </div>`).join('')}
    </div>`;
}

export function tplEstrutura(){
  const groups = state.estrutura;
  return `
    <h1 class="pagetitle">03 · Estrutura de Equipamentos</h1>
    <p class="pagesub">Agrupe os equipamentos por função de segurança (ex: Defesa Perimetral, Controle de Acesso).</p>
    ${groups.map((g,gi)=> g.gerado ? tplSecaoGerada() : `
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

// Cria a seção gerada (uma só); se já existe, ela já acompanha a planta — só avisa.
export function importFromPlanta(){
  if(secaoGerada()){
    showToast('A Estrutura já está sincronizada com a planta.');
  } else {
    state.estrutura.push({gerado:true, descs:{}});
  }
  switchTab('estrutura');
}

export function setDescGerada(id, valor){
  const sec = secaoGerada();
  if(sec) sec.descs[id] = valor;
}

export function removeSecaoGerada(){
  const gi = state.estrutura.findIndex(g=>g.gerado);
  if(gi<0) return;
  const temDesc = Object.values(state.estrutura[gi].descs||{}).some(d=>(d||'').trim());
  if(temDesc && !confirm('Remover a seção gerada? As descrições digitadas nela serão perdidas.')) return;
  state.estrutura.splice(gi,1);
  renderContent();
}
