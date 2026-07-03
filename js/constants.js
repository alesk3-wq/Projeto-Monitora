export const BRAND = {
  nome: 'Bracell',
  departamento: 'Segurança Patrimonial',
  logo: 'assets/logo-bracell.png',
  cor: '#0A2E5C',
  corSecundaria: '#0066B3',
  corAcento: '#7CC242',
  slogan: 'Servir e Proteger',
};

export const EQUIP_TYPES = [
  {id:'bullet', label:'Câmera Bullet', color:'#F2994A', cameraLike:true},
  {id:'dome', label:'Câmera Dome', color:'#2D9CDB', cameraLike:true},
  {id:'ptz', label:'Câmera PTZ / Speed Dome', color:'#9B51E0', cameraLike:true},
  {id:'lpr', label:'Câmera LPR (Leitura de Placas)', color:'#27AE60', cameraLike:true},
  {id:'acesso_veic', label:'Controle de Acesso Veicular', color:'#EB5757', cameraLike:false},
  {id:'acesso_ped', label:'Controle de Acesso / Catraca', color:'#56CCF2', cameraLike:false},
  {id:'fechadura', label:'Fechadura Eletrônica', color:'#BB6BD9', cameraLike:false},
  {id:'biometria', label:'Leitor Biométrico / Facial', color:'#219653', cameraLike:false},
  {id:'cerca', label:'Cerca / Concertina', color:'#EB5757', cameraLike:false},
  {id:'outro', label:'Outro', color:'#828282', cameraLike:false},
];

export const ICONS = {
  bullet: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="11" height="7" rx="1"/><path d="M14 11l6-3v8l-6-3z"/><line x1="6" y1="9" x2="6" y2="6"/></svg>',
  dome: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14a9 9 0 0 1 18 0"/><line x1="3" y1="14" x2="21" y2="14"/><circle cx="12" cy="11" r="2.4"/></svg>',
  ptz: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  lpr: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="11" height="7" rx="1"/><path d="M14 11l6-3v8l-6-3z"/><rect x="4.5" y="11.5" width="7" height="2.6" rx="0.5" fill="white" stroke="none"/></svg>',
  acesso_veic: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="20" x2="21" y2="20"/><rect x="4" y="10" width="3" height="10"/><line x1="7" y1="12" x2="20" y2="6"/><circle cx="20" cy="6" r="1.3" fill="white" stroke="none"/></svg>',
  acesso_ped: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
  fechadura: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  biometria: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 0 0-7 7c0 4 2 6 2 9"/><path d="M12 3a7 7 0 0 1 7 7c0 3-1 4-1 6"/><path d="M9 19c-1-2-2-4-2-7a5 5 0 0 1 10 0c0 1 0 2-.3 3"/><path d="M12 9a3 3 0 0 0-3 3c0 3 1 4 1 6"/></svg>',
  cerca: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="4" y2="20"/><line x1="10" y1="4" x2="10" y2="20"/><line x1="16" y1="4" x2="16" y2="20"/><line x1="2" y1="8" x2="20" y2="8"/><line x1="2" y1="14" x2="20" y2="14"/></svg>',
  outro: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="white" stroke="none"/></svg>',
};

export const TABS = [
  {id:'projeto', label:'Dados do Projeto', num:'•'},
  {id:'objetivo', label:'Problema & Solução', num:'01'},
  {id:'planta', label:'Planta / Mapeamento', num:'02'},
  {id:'estrutura', label:'Estrutura', num:'03'},
  {id:'equipamentos', label:'Fichas de Equipamentos', num:'04'},
  {id:'premissas', label:'Premissas', num:'05'},
  {id:'gerar', label:'Gerar Proposta', num:'✓'},
];

export const PW = 1414, PH = 1000;
