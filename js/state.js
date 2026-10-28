import { todayISO } from './utils.js';
import { CONSIDERACOES_PADRAO } from './constants.js';

export function novaPlanta(nome){
  return { nome, imagem:null, selectedTipo:'bullet', pins:[], zoom:100, cercas:[], areas:[], etiquetas:[], muros:[], selectedAreaCat:'area1' };
}

// Vista aérea: mesmo formato de uma planta + aerea:true; lista separada (state.aereas).
// Começa sem ferramenta armada (equipamento só entra como referência a um pin da planta).
export function novaAerea(nome){
  return { ...novaPlanta(nome), aerea:true, selectedTipo:'nenhum' };
}

// Esvazia o conteúdo de uma planta ao trocar a imagem (muros não são apagados, como sempre)
export function limparPlanta(pl){
  pl.pins = []; pl.cercas = []; pl.areas = []; pl.etiquetas = [];
  pl.zoom = 100;
  delete pl.escala;
  delete pl.fonte;
  return pl;
}

// Alias vivo: state.planta → vista aérea ativa (state.aereas[state.aereaAtiva]) quando
// houver uma selecionada; senão a planta ativa (state.plantas[state.plantaAtiva]).
// Não-enumerável de propósito — fica fora do JSON.stringify (o export serializa
// só 'plantas' + 'plantaAtiva'). Todo código que opera "na planta ativa"
// (editor, áreas, upload, pinch) continua lendo/escrevendo state.planta.
export function attachPlantaAlias(obj){
  Object.defineProperty(obj, 'planta', {
    get(){
      const ae = obj.aereaAtiva!==null && obj.aereaAtiva!==undefined && Array.isArray(obj.aereas) ? obj.aereas[obj.aereaAtiva] : null;
      return ae || obj.plantas[obj.plantaAtiva] || obj.plantas[0];
    },
    enumerable: false,
    configurable: true,
  });
}

export let state = {
  projeto: { unidade:'', local:'', equipe:'Núcleo de Tecnologia', responsavel:'', data: todayISO() },
  objetivo: { problema:'', solucao:'' },
  estrutura: [],
  plantas: [ novaPlanta('Planta 1') ],
  plantaAtiva: 0,
  aereas: [],        // vistas aéreas (formato de planta + aerea:true)
  aereaAtiva: null,  // índice da vista ativa no editor, ou null (planta ativa)
  premissas: [ {titulo:'', desc:''} ],
  consideracoes: CONSIDERACOES_PADRAO, // texto livre; PDF: itálico entre aspas no fim das Premissas
};
attachPlantaAlias(state);

export function setState(novoEstado){ state = novoEstado; }
