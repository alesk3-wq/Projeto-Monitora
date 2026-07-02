import { EQUIP_TYPES } from './constants.js';

export function todayISO(){ return new Date().toISOString().slice(0,10); }

export function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

export function fileToDataURL(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function typeById(id){ return EQUIP_TYPES.find(t=>t.id===id) || EQUIP_TYPES[EQUIP_TYPES.length-1]; }

export function fmtDate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${parseInt(d)} | ${meses[parseInt(m)-1]} | ${y}`;
}
