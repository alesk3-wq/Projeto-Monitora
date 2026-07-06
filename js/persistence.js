import { state, setState } from './state.js';
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
      setState(loaded);
      if(!state.planta) state.planta = {imagem:null, selectedTipo:'bullet', pins:[], zoom:100, cercas:[]};
      if(state.planta.zoom===undefined) state.planta.zoom = 100;
      if(!state.planta.cercas) state.planta.cercas = [];
      switchTab('projeto');
      showToast('Projeto importado com sucesso.');
    }catch(err){
      showToast('Arquivo inválido — verifique se é um .json exportado desta ferramenta.');
      console.error(err);
    }
  };
  reader.readAsText(f);
}
