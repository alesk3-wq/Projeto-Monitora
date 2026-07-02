import { state } from '../state.js';

export function tplGerar(){
  const totalItens = state.estrutura.reduce((s,g)=>s+g.itens.reduce((s2,it)=>s2+(parseInt(it.qtd)||0),0),0);
  const totalPins = state.planta.pins.length;
  const totalFichas = state.planta.pins.filter(p=>p.fotoLocal && p.fotoView).length;
  return `
    <h1 class="pagetitle">Gerar Proposta</h1>
    <p class="pagesub">Revise o resumo e gere o PDF completo com a identidade Bracell · Segurança Patrimonial.</p>
    <div class="summary-grid">
      <div class="stat"><div class="n">${state.estrutura.length}</div><div class="l">Grupos de equipamento</div></div>
      <div class="stat"><div class="n">${totalItens}</div><div class="l">Itens quantificados</div></div>
      <div class="stat"><div class="n">${totalPins}</div><div class="l">Pontos na planta</div></div>
      <div class="stat"><div class="n">${totalFichas}/${totalPins}</div><div class="l">Fichas completas</div></div>
    </div>
    <div class="card">
      <div style="font-weight:700;margin-bottom:4px;">Unidade</div>
      <div style="color:var(--text-mid);margin-bottom:14px;">${state.projeto.unidade || '— não preenchido —'}</div>
      <div style="font-weight:700;margin-bottom:4px;">Planta baixa</div>
      <div style="color:var(--text-mid);margin-bottom:14px;">${state.planta.imagem ? 'Anexada ✓' : 'Não anexada — a página de mapeamento sairá em branco'}</div>
      <button class="btn primary" style="font-size:15px;padding:13px 22px;" onclick="gerarPDF()">⬇ Gerar PDF da Proposta</button>
    </div>
  `;
}
