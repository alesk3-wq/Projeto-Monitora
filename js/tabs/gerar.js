import { state } from '../state.js';
import { validarProposta, CHECKS } from '../validacao.js';

export function tplGerar(){
  const totalItens = state.estrutura.reduce((s,g)=>s+g.itens.reduce((s2,it)=>s2+(parseInt(it.qtd)||0),0),0);
  const allPins = state.plantas.flatMap(pl=>pl.pins);
  const totalPins = allPins.length;
  const totalFichas = allPins.filter(p=>p.fotoLocal && p.fotoView).length;
  const pend = validarProposta();
  const pendPorCampo = {};
  pend.forEach(p=>{ (pendPorCampo[p.campo] = pendPorCampo[p.campo]||[]).push(p.msg); });
  const checklist = CHECKS.map(c=>{
    const falhas = pendPorCampo[c.campo];
    return falhas
      ? `<div class="check bad">✗ ${c.label}<div class="check-detail">${falhas.join('<br>')}</div></div>`
      : `<div class="check ok">✓ ${c.label}</div>`;
  }).join('');
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
      <div style="font-weight:700;margin-bottom:8px;">Checklist da proposta</div>
      ${checklist}
      <label style="display:flex;align-items:center;gap:8px;margin-top:18px;font-weight:600;font-size:13.5px;cursor:pointer;">
        <input type="checkbox" id="baixarJson" style="width:auto;margin:0;">
        Baixar projeto editável (.json) junto com o PDF
      </label>
      <button class="btn primary" style="font-size:15px;padding:13px 22px;margin-top:12px;" onclick="solicitarGerarPDF()">⬇ Gerar PDF da Proposta</button>
    </div>
  `;
}
