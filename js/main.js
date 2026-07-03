import { state } from './state.js';
import { renderNav, renderContent, switchTab } from './nav.js';
import { exportarProjeto, importarProjetoFile } from './persistence.js';
import { addGroup, removeGroup, addItem, removeItem, importFromPlanta } from './tabs/estrutura.js';
import { handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, removePin } from './tabs/planta.js';
import { handleEquipPhoto } from './tabs/equipamentos.js';
import { addPremissa, removePremissa, addPremissasPadrao } from './tabs/premissas.js';
import { gerarPDF } from './pdf.js';

Object.assign(window, {
  state, renderContent, switchTab,
  exportarProjeto, importarProjetoFile,
  addGroup, removeGroup, addItem, removeItem, importFromPlanta,
  handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, removePin,
  handleEquipPhoto,
  addPremissa, removePremissa, addPremissasPadrao,
  gerarPDF,
});

renderNav();
renderContent();
