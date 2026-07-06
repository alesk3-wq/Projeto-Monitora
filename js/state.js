import { todayISO } from './utils.js';

export let state = {
  projeto: { unidade:'', local:'', equipe:'Núcleo de Tecnologia', responsavel:'', data: todayISO() },
  objetivo: { problema:'', solucao:'' },
  estrutura: [],
  planta: { imagem:null, selectedTipo:'bullet', pins:[], zoom:100, cercas:[] },
  premissas: [ {titulo:'', desc:''} ],
};

export function setState(novoEstado){ state = novoEstado; }
