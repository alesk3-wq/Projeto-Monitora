import { state, setState, novaPlanta, attachPlantaAlias } from './state.js';
import { switchTab } from './nav.js';
import { showToast } from './utils.js';

export function exportarProjeto(){
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Projeto_${(state.projeto.unidade||'Bracell').replace(/[^a-zA-Z0-9]+/g,'_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Projeto exportado. Envie o arquivo .json para seu colega.');
}

export function importarProjetoFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const loaded = JSON.parse(ev.target.result);
      // Migração: .json antigos têm 'planta' (singular) em vez de 'plantas'
      if(loaded.planta && !loaded.plantas){
        loaded.plantas = [loaded.planta];
        delete loaded.planta;
      }
      if(!Array.isArray(loaded.plantas) || loaded.plantas.length===0) loaded.plantas = [novaPlanta('Planta 1')];
      loaded.plantaAtiva = Math.max(0, Math.min(parseInt(loaded.plantaAtiva)||0, loaded.plantas.length-1));
      loaded.plantas.forEach((pl,i)=>{
        if(!pl.nome) pl.nome = 'Planta '+(i+1);
        if(pl.zoom===undefined) pl.zoom = 100;
        if(!pl.pins) pl.pins = [];
        if(!pl.cercas) pl.cercas = [];
        if(!pl.areas) pl.areas = [];
        if(!pl.selectedTipo) pl.selectedTipo = 'bullet';
        if(!pl.selectedAreaCat) pl.selectedAreaCat = 'area1';
      });
      setState(loaded);
      attachPlantaAlias(state);
      switchTab('projeto');
      showToast('Projeto importado com sucesso.');
    }catch(err){
      showToast('Arquivo inválido — verifique se é um .json exportado desta ferramenta.');
      console.error(err);
    }
  };
  reader.readAsText(f);
}
