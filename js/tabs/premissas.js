import { state } from '../state.js';
import { renderContent } from '../nav.js';

export function tplPremissas(){
  const list = state.premissas;
  return `
    <h1 class="pagetitle">05 · Premissas</h1>
    <p class="pagesub">Condições, responsabilidades e requisitos técnicos do projeto.</p>
    <div class="card">
      ${list.map((p,i)=>`
        <div class="group">
          <div class="item-row">
            <input class="nome" style="width:280px" type="text" placeholder="Título (ex: Retenção de Dados)" value="${p.titulo}" oninput="state.premissas[${i}].titulo=this.value">
            <input class="desc" type="text" placeholder="Descrição" value="${p.desc}" oninput="state.premissas[${i}].desc=this.value">
            <button class="btn danger small" onclick="removePremissa(${i})">✕</button>
          </div>
        </div>
      `).join('')}
      <div style="display:flex;gap:10px;">
        <button class="btn ghost" onclick="addPremissa()">+ Premissa</button>
        <button class="btn ghost" onclick="addPremissasPadrao()">+ Sugestões padrão</button>
      </div>
    </div>
  `;
}

export function addPremissa(){ state.premissas.push({titulo:'',desc:''}); renderContent(); }
export function removePremissa(i){ state.premissas.splice(i,1); renderContent(); }
export function addPremissasPadrao(){
  state.premissas.push(
    {titulo:'Retenção de Dados', desc:'O sistema deve possuir infraestrutura de storage capaz de manter, no mínimo, 30 dias de gravação contínua para auditorias e perícias.'},
    {titulo:'Disponibilidade de Monitoramento', desc:'Deve ser garantida a disponibilidade de monitoramento em tempo real na Central de Operações (CCOS).'},
    {titulo:'Infraestrutura de Rede e TI', desc:'É responsabilidade da TI garantir que os equipamentos da central atendam integralmente às necessidades operacionais, evitando falhas, latências ou gargalos.'},
  );
  renderContent();
}
