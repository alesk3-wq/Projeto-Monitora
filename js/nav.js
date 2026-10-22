import { TABS } from './constants.js';
import { state } from './state.js';
import { tplProjeto } from './tabs/projeto.js';
import { tplObjetivo } from './tabs/objetivo.js';
import { tplEstrutura } from './tabs/estrutura.js';
import { tplPlanta, afterPlantaRender, cancelarTraco } from './tabs/planta.js';
import { tplEquipamentos, afterEquipamentosRender } from './tabs/equipamentos.js';
import { tplPremissas } from './tabs/premissas.js';
import { tplGerar } from './tabs/gerar.js';

let currentTab = 'projeto';

export function renderNav(){
  const el = document.getElementById('navBtns');
  el.innerHTML = TABS.map(t=>`
    <button class="navbtn ${t.id===currentTab?'active':''}" onclick="switchTab('${t.id}')">
      <span class="num">${t.num}</span>${t.label}
    </button>`).join('');

  const idx = TABS.findIndex(t=>t.id===currentTab);
  const label = document.getElementById('navCurrentLabel');
  if(label) label.innerHTML = `<span class="num">${TABS[idx].num}</span><span class="label-text">${TABS[idx].label}</span>`;
  const prevBtn = document.getElementById('navPrev');
  const nextBtn = document.getElementById('navNext');
  if(prevBtn) prevBtn.disabled = idx<=0;
  if(nextBtn) nextBtn.disabled = idx>=TABS.length-1;
}
export function switchTab(id){ if(id!==currentTab) cancelarTraco(); currentTab = id; renderNav(); renderContent(); }
export function goPrevTab(){
  const idx = TABS.findIndex(t=>t.id===currentTab);
  if(idx>0) switchTab(TABS[idx-1].id);
}
export function goNextTab(){
  const idx = TABS.findIndex(t=>t.id===currentTab);
  if(idx<TABS.length-1) switchTab(TABS[idx+1].id);
}
export function toggleHiddenMenu(){
  document.getElementById('sidebar-footer').classList.toggle('open');
}

let lastRenderTab = null, lastRenderPlanta = -1;

export function renderContent(){
  const c = document.getElementById('content');
  // Rolagem só é preservada ao re-renderizar a MESMA planta da aba Planta
  let keep = null;
  if(currentTab==='planta' && lastRenderTab==='planta' && lastRenderPlanta===state.plantaAtiva){
    const sc = document.getElementById('plantaScroll');
    if(sc) keep = {l:sc.scrollLeft, t:sc.scrollTop, y:window.scrollY};
  }
  c.classList.toggle('wide', currentTab==='planta');
  if(currentTab==='projeto') c.innerHTML = tplProjeto();
  else if(currentTab==='objetivo') c.innerHTML = tplObjetivo();
  else if(currentTab==='estrutura') c.innerHTML = tplEstrutura();
  else if(currentTab==='planta') { c.innerHTML = tplPlanta(); afterPlantaRender(); if(keep) restaurarRolagem(keep); }
  else if(currentTab==='equipamentos') { c.innerHTML = tplEquipamentos(); afterEquipamentosRender(); }
  else if(currentTab==='premissas') c.innerHTML = tplPremissas();
  else if(currentTab==='gerar') c.innerHTML = tplGerar();
  lastRenderTab = currentTab; lastRenderPlanta = state.plantaAtiva;
}

function restaurarRolagem(k){
  const aplicar = ()=>{
    const sc = document.getElementById('plantaScroll');
    if(sc){ sc.scrollLeft = k.l; sc.scrollTop = k.t; }
    window.scrollTo(window.scrollX, k.y);
  };
  aplicar();
  const img = document.getElementById('plantaImg');
  if(img && !img.complete) img.addEventListener('load', aplicar, {once:true});
}
