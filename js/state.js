import { todayISO } from './utils.js';

export function novaPlanta(nome){
  return { nome, imagem:null, selectedTipo:'bullet', pins:[], zoom:100, cercas:[], areas:[], selectedAreaCat:'area1' };
}

// Alias vivo: state.planta → planta ativa (state.plantas[state.plantaAtiva]).
// Não-enumerável de propósito — fica fora do JSON.stringify (o export serializa
// só 'plantas' + 'plantaAtiva'). Todo código que opera "na planta ativa"
// (editor, áreas, upload, pinch) continua lendo/escrevendo state.planta.
export function attachPlantaAlias(obj){
  Object.defineProperty(obj, 'planta', {
    get(){ return obj.plantas[obj.plantaAtiva] || obj.plantas[0]; },
    enumerable: false,
    configurable: true,
  });
}

// Numeração global contínua: quantos pins existem nas plantas anteriores a plantaIdx
export function pinOffsetGlobal(plantaIdx){
  let n = 0;
  for(let i=0; i<plantaIdx && i<state.plantas.length; i++) n += state.plantas[i].pins.length;
  return n;
}

export let state = {
  projeto: { unidade:'', local:'', equipe:'Núcleo de Tecnologia', responsavel:'', data: todayISO() },
  objetivo: { problema:'', solucao:'' },
  estrutura: [],
  plantas: [ novaPlanta('Planta 1') ],
  plantaAtiva: 0,
  premissas: [ {titulo:'', desc:''} ],
};
attachPlantaAlias(state);

export function setState(novoEstado){ state = novoEstado; }
