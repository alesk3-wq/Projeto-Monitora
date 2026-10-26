import { state } from '../state.js';

export function tplObjetivo(){
  const o = state.objetivo;
  return `
    <h1 class="pagetitle">01 · Problema & Solução</h1>
    <p class="pagesub">Equivalente às seções "Área a ser Monitorada" e "Diretriz da Proposta" do padrão atual.</p>
    <div class="card">
      <div class="hint" style="margin-bottom:12px;">Dica: comece a linha com <b>•</b> ou <b>-</b> para virar item de lista no PDF; linha curta terminando em <b>:</b> vira subtítulo em negrito; as outras linhas viram parágrafos. Deixe uma linha em branco para separar blocos.</div>
      <label>Problema / Contexto de risco (área a ser monitorada, vulnerabilidades, riscos atuais)</label>
      <textarea style="min-height:130px" oninput="state.objetivo.problema=this.value">${o.problema}</textarea>
      <label>Solução / Diretriz da proposta (visão geral da solução proposta)</label>
      <textarea style="min-height:130px" oninput="state.objetivo.solucao=this.value">${o.solucao}</textarea>
    </div>
  `;
}
