import { TABS } from './constants.js';
import { tplProjeto } from './tabs/projeto.js';
import { tplObjetivo } from './tabs/objetivo.js';
import { tplEstrutura } from './tabs/estrutura.js';
import { tplPlanta, afterPlantaRender } from './tabs/planta.js';
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
}
export function switchTab(id){ currentTab = id; renderNav(); renderContent(); }

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
