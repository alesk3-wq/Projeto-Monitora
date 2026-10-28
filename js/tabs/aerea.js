// Vista aérea no editor (aba 02 · Planta): tudo que difere de uma planta quando state.planta.aerea.
// planta.js delega para cá (como faz com areas.js, muros.js…). O mapa de satélite vem depois
// (Task 3): por enquanto a vista sem imagem mostra o upload de imagem/PDF.
import { state, novaAerea } from '../state.js';
import { ICONS } from '../constants.js';
import { typeById, escHtml } from '../utils.js';
import { pontosPorTipo, numeroDoPinEm } from '../numeracao.js';
import { novaRef, refsColocadas, pinOriginal } from '../aerea.js';
import { renderContent } from '../nav.js';
import { cancelarTraco, tplControlesFoco } from './planta.js';

// Ferramentas de desenho que continuam valendo na vista (além dos itens de cenário)
export const FERRAMENTAS_VISTA = ['area', 'etiqueta', 'muro', 'escala'];

export function temConteudoVista(v){
  return !!(v && ((v.pins||[]).length || (v.areas||[]).length || (v.etiquetas||[]).length || (v.cercas||[]).length));
}

// ---------- mini-abas ----------
export function selectAerea(i){
  if(i===state.aereaAtiva || !state.aereas[i]) return;
  cancelarTraco();
  state.aereaAtiva = i;
  renderContent();
}
export function addAerea(){
  cancelarTraco();
  state.aereas.push(novaAerea('Vista aérea '+(state.aereas.length+1)));
  state.aereaAtiva = state.aereas.length-1;
  renderContent();
}
export function removeAerea(i){
  const v = state.aereas[i];
  if(!v) return;
  const temConteudo = v.imagem || temConteudoVista(v) || (v.muros||[]).length;
  if(temConteudo && !confirm(`Excluir a vista aérea "${v.nome||('Vista aérea '+(i+1))}" e tudo que está nela?`)) return;
  cancelarTraco();
  state.aereas.splice(i, 1);
  state.aereaAtiva = null; // volta para a planta ativa
  renderContent();
}

// Abas das vistas (depois das plantas) + botão de adicionar
export function tplAbasVistas(){
  return state.aereas.map((v,i)=>`
          <button class="planta-tab aerea ${i===state.aereaAtiva?'active':''}" onclick="selectAerea(${i})">🛰 ${escHtml(v.nome||('Vista aérea '+(i+1)))}</button>`).join('');
}

// Bloco da imagem de fundo da vista (Task 3 troca por mapa quando a vista não tem imagem)
export function tplVistaImagem(pl){
  return `
      <label>Imagem aérea (imagem ou PDF)</label>
      <input type="file" accept="image/*,application/pdf,.pdf" onchange="handlePlantaUpload(event)" style="margin-bottom:4px;">
      <div class="hint">Print do Google Earth/Maps, foto de drone ou PDF. PDF com mais de uma página: você escolhe qual usar.</div>`;
}
export function tplVistaVazia(){
  return `<div class="empty-hint">Envie uma imagem aérea do local para posicionar os equipamentos da planta sobre ela.</div>`;
}

// ---------- equipamentos da planta (referências) ----------
const nomePlanta = i=>state.plantas[i]?.nome || ('Planta '+(i+1));

// Botão "Equipamentos da planta" + painel (por clique, como o Inserir) agrupado por tipo
export function tplEquipPlanta(pl){
  const colocados = refsColocadas(pl);
  const grupos = pontosPorTipo();
  const armado = (pl.selectedTipo||'').startsWith('ref:') ? pinOriginal(pl.selectedTipo.slice(4)) : null;
  const tArm = armado ? typeById(armado.pin.tipoId) : null;
  return `
    <div class="inserir-wrap equip-wrap">
      <button class="type-btn inserir-btn" onclick="toggleMenuEquip()">📍 Equipamentos da planta ▾</button>
      <div id="menuEquip" class="inserir-menu">
        ${grupos.length ? grupos.map(g=>`
          <div class="inserir-sec">
            <div class="inserir-titulo">${g.tipo.label}</div>
            <div class="inserir-itens">
              ${g.pontos.map(pt=>{ const ja = colocados.has(pt.pin.id); return `
                <button class="type-btn ${ja?'colocado':''}" data-ref="${escHtml(pt.pin.id)}" ${ja?'disabled title="Já está nesta vista"':''} onclick="selectRef('${escHtml(pt.pin.id)}')">
                  <span class="icon-dot" style="background:${g.tipo.color}">${ICONS[g.tipo.id]}</span>${g.tipo.label} ${pt.numero} · ${escHtml(nomePlanta(pt.plantaIdx))}${ja?' ✓':''}
                </button>`; }).join('')}
            </div>
          </div>`).join('') : `<div class="hint">Nenhum equipamento posicionado nas plantas ainda. Equipamentos nascem na planta.</div>`}
      </div>
    </div>
    ${armado ? `<span class="type-btn active equip-atual" onclick="toggleMenuEquip()" title="Toque na imagem para posicionar"><span class="icon-dot" style="background:${tArm.color}">${ICONS[tArm.id]}</span>${tArm.label} ${numeroDoPinEm(state.plantas[armado.plantaIdx], armado.pinIdx)} — toque na imagem</span>` : ''}`;
}
export function toggleMenuEquip(){
  document.getElementById('menuInserir')?.classList.remove('open');
  document.getElementById('menuEquip')?.classList.toggle('open');
}
document.addEventListener('pointerdown', e=>{
  const m = document.getElementById('menuEquip');
  if(m && m.classList.contains('open') && !e.target.closest('.equip-wrap, .equip-atual')) m.classList.remove('open');
});
export function selectRef(pinId){
  cancelarTraco();
  state.planta.selectedTipo = 'ref:'+pinId;
  renderContent();
}
// Clique na imagem com uma referência armada: coloca o equipamento (uma vez por vista) e desarma
export function criarRefNoClique(x, y){
  const pl = state.planta;
  const id = (pl.selectedTipo||'').startsWith('ref:') ? pl.selectedTipo.slice(4) : null;
  pl.selectedTipo = 'nenhum';
  if(id && pinOriginal(id) && !refsColocadas(pl).has(id)) pl.pins.push(novaRef(id, x, y));
  renderContent();
}
export function removeRef(pi){
  state.planta.pins.splice(pi, 1);
  renderContent();
}
// Linha da lista para uma referência: tipo/número/rótulo só leitura; foco próprio da vista
export function tplRefRow(p, pi){
  const pl = state.planta, t = typeById(p.tipoId), o = pinOriginal(p.ref);
  return `
          <div class="pinrow pinrow-ref">
            <span class="icon-dot" style="background:${t.color}">${ICONS[t.id]}</span>
            <b style="font-size:12px;color:var(--text-mid);width:18px;">${numeroDoPinEm(pl, pi)}</b>
            <span style="flex:1;min-width:140px;font-size:13px;">${t.label} — ${escHtml(p.label)}${o ? ` <span style="color:var(--text-mid);font-size:11px;">· ${escHtml(nomePlanta(o.plantaIdx))}</span>` : ''}</span>
            ${tplControlesFoco(p, pi, pl)}
            <button class="btn danger small" title="Remover desta vista" onclick="removeRef(${pi})">✕</button>
          </div>`;
}
