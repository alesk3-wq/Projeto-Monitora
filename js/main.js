import { state } from './state.js';
import { renderNav, renderContent, switchTab, goPrevTab, goNextTab, toggleHiddenMenu } from './nav.js';
import { exportarProjeto, importarProjetoFile } from './persistence.js';
import { addGroup, removeGroup, addItem, removeItem, importFromPlanta, setDescGerada, removeSecaoGerada } from './tabs/estrutura.js';
import { muroDesfazer, muroConcluir, muroCancelar, removeMuro } from './tabs/muros.js';
import { toggleMenuInserir, handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, liveUpdateAlcance, liveUpdateAbertura, removePin, selectTipo, cercaDesfazer, cercaConcluir, cercaCancelar, removeCerca, selectPlanta, addPlanta, removePlanta } from './tabs/planta.js';
import { selectAreaCat, setAreaCat, removeArea } from './tabs/areas.js';
import { setEtiquetaTexto, removeEtiqueta } from './tabs/etiquetas.js';
import { handleEquipPhoto, setCropFrac } from './tabs/equipamentos.js';
import { addPremissa, removePremissa, addPremissasPadrao } from './tabs/premissas.js';
import { gerarPDF, solicitarGerarPDF } from './pdf.js';

Object.assign(window, {
  renderContent, switchTab, goPrevTab, goNextTab, toggleHiddenMenu,
  exportarProjeto, importarProjetoFile,
  addGroup, removeGroup, addItem, removeItem, importFromPlanta, setDescGerada, removeSecaoGerada,
  muroDesfazer, muroConcluir, muroCancelar, removeMuro,
  toggleMenuInserir, handlePlantaUpload, zoomPlanta, resetZoom, liveUpdateCone, liveUpdateAlcance, liveUpdateAbertura, removePin,
  selectTipo, cercaDesfazer, cercaConcluir, cercaCancelar, removeCerca,
  selectPlanta, addPlanta, removePlanta,
  selectAreaCat, setAreaCat, removeArea,
  setEtiquetaTexto, removeEtiqueta,
  handleEquipPhoto, setCropFrac,
  addPremissa, removePremissa, addPremissasPadrao,
  gerarPDF, solicitarGerarPDF,
});
Object.defineProperty(window, 'state', { get: () => state, configurable: true });

renderNav();
renderContent();
