import { TABS } from './constants.js';
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
export function switchTab(id){ cancelarTraco(); currentTab = id; renderNav(); renderContent(); }
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

export function renderContent(){
  const c = document.getElementById('content');
  if(currentTab==='projeto') c.innerHTML = tplProjeto();
  else if(currentTab==='objetivo') c.innerHTML = tplObjetivo();
  else if(currentTab==='estrutura') c.innerHTML = tplEstrutura();
  else if(currentTab==='planta') { c.innerHTML = tplPlanta(); afterPlantaRender(); }
  else if(currentTab==='equipamentos') { c.innerHTML = tplEquipamentos(); afterEquipamentosRender(); }
  else if(currentTab==='premissas') c.innerHTML = tplPremissas();
  else if(currentTab==='gerar') c.innerHTML = tplGerar();
}
