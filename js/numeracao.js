import { state } from './state.js';
import { EQUIP_TYPES } from './constants.js';

// Numeração por tipo de equipamento (tipoId), contínua entre plantas:
// percorre state.plantas na ordem e, dentro de cada planta, a ordem dos pins.
// Fonte única do número exibido (editor, Mapeamento, fichas, Estrutura).

export function numeroDoPin(plantaIdx, pinIdx){
  const alvo = state.plantas[plantaIdx]?.pins[pinIdx];
  if(!alvo) return 0;
  let n = 0;
  for(let i=0; i<=plantaIdx; i++){
    const pins = state.plantas[i].pins;
    const fim = i===plantaIdx ? pinIdx : pins.length;
    for(let j=0; j<fim; j++) if(pins[j].tipoId===alvo.tipoId) n++;
  }
  return n+1;
}

// Só tipos com ao menos um pin, na ordem de EQUIP_TYPES; pontos em ordem de número.
// Itens de cenário (portão, poste…) ficam de fora, salvo incluirCenario (legendas).
export function pontosPorTipo(incluirCenario=false){
  const out = [];
  EQUIP_TYPES.forEach(tipo=>{
    if(tipo.cenario && !incluirCenario) return;
    const pontos = [];
    state.plantas.forEach((pl,plantaIdx)=>pl.pins.forEach((pin,pinIdx)=>{
      if(pin.tipoId===tipo.id) pontos.push({pin, plantaIdx, pinIdx, numero: pontos.length+1});
    }));
    if(pontos.length) out.push({tipo, pontos});
  });
  return out;
}

// Traçados de cerca, numeração contínua entre plantas.
export function trechosCerca(){
  const out = [];
  state.plantas.forEach((pl,plantaIdx)=>(pl.cercas||[]).forEach((cerca,cercaIdx)=>{
    out.push({cerca, plantaIdx, cercaIdx, numero: out.length+1});
  }));
  return out;
}
