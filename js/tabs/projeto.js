import { state } from '../state.js';

export function tplProjeto(){
  const p = state.projeto;
  return `
    <h1 class="pagetitle">Dados do Projeto</h1>
    <p class="pagesub">Unidade/área da Bracell que está recebendo a proposta de Segurança Eletrônica.</p>
    <div class="card">
      <div class="row">
        <div><label>Unidade / Local (ex: Auto Posto Bracell)</label><input type="text" value="${p.unidade}" oninput="state.projeto.unidade=this.value"></div>
        <div><label>Equipe / Núcleo responsável</label><input type="text" value="${p.equipe}" oninput="state.projeto.equipe=this.value"></div>
      </div>
      <label>Endereço / detalhamento do local</label>
      <input type="text" value="${p.local}" oninput="state.projeto.local=this.value">
      <div class="row">
        <div><label>Responsável técnico (Especialista)</label><input type="text" value="${p.responsavel}" oninput="state.projeto.responsavel=this.value"></div>
        <div><label>Data</label><input type="date" value="${p.data}" oninput="state.projeto.data=this.value"></div>
      </div>
      <div class="hint">O documento sempre sai assinado como Bracell · Depto. Segurança Patrimonial.</div>
    </div>
  `;
}
