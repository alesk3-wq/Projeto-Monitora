import { state } from './state.js';

export const CHECKS = [
  {campo:'projeto', label:'Unidade preenchida'},
  {campo:'objetivo', label:'Problema & Solução preenchidos'},
  {campo:'planta', label:'Planta baixa anexada'},
  {campo:'estrutura', label:'Estrutura com itens'},
  {campo:'fichas', label:'Fichas com fotos completas'},
  {campo:'premissas', label:'Premissas cadastradas'},
];

export function validarProposta(){
  const pend = [];
  if(!(state.projeto.unidade||'').trim()) pend.push({campo:'projeto', msg:'Unidade/local não preenchida (aba Dados do Projeto)'});
  if(!(state.objetivo.problema||'').trim()) pend.push({campo:'objetivo', msg:'"Área a ser Monitorada" vazia (aba 01)'});
  if(!(state.objetivo.solucao||'').trim()) pend.push({campo:'objetivo', msg:'"Diretriz da Proposta" vazia (aba 01)'});
  if(!state.planta.imagem) pend.push({campo:'planta', msg:'Planta baixa não anexada (aba 02)'});
  const temItens = state.estrutura.some(g=>g.itens && g.itens.some(it=>(it.nome||'').trim()));
  if(!temItens) pend.push({campo:'estrutura', msg:'Nenhum equipamento na Estrutura (aba 03)'});
  const semFoto = state.planta.pins.filter(p=>!p.fotoLocal || !p.fotoView).length;
  if(semFoto>0) pend.push({campo:'fichas', msg:`${semFoto} equipamento(s) sem foto do local e/ou da visualização (aba 04)`});
  const temPremissa = state.premissas.some(p=>(p.titulo||'').trim() || (p.desc||'').trim());
  if(!temPremissa) pend.push({campo:'premissas', msg:'Nenhuma premissa cadastrada (aba 05)'});
  return pend;
}
