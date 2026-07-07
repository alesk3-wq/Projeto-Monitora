import { state } from './state.js';
import { renderNav, renderContent, switchTab, goPrevTab, goNextTab, toggleHiddenMenu } from './nav.js';
import { exportarProjeto, importarProjetoFile } from './persistence.js';
import { addGroup, removeGroup, addItem, removeItem, importFromPlanta } from './tabs/estrutura.js';
import { handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, removePin, selectTipo, cercaDesfazer, cercaConcluir, cercaCancelar, removeCerca } from './tabs/planta.js';
import { selectAreaCat, setAreaCat, removeArea } from './tabs/areas.js';
import { handleEquipPhoto, setCropFrac } from './tabs/equipamentos.js';
import { addPremissa, removePremissa, addPremissasPadrao } from './tabs/premissas.js';
import { gerarPDF, solicitarGerarPDF } from './pdf.js';

Object.assign(window, {
  renderContent, switchTab, goPrevTab, goNextTab, toggleHiddenMenu,
  exportarProjeto, importarProjetoFile,
  addGroup, removeGroup, addItem, removeItem, importFromPlanta,
  handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, removePin,
  selectTipo, cercaDesfazer, cercaConcluir, cercaCancelar, removeCerca,
  selectAreaCat, setAreaCat, removeArea,
  handleEquipPhoto, setCropFrac,
  addPremissa, removePremissa, addPremissasPadrao,
  gerarPDF, solicitarGerarPDF,
});
Object.defineProperty(window, 'state', { get: () => state, configurable: true });

renderNav();
renderContent();
