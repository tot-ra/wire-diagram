import { BUILTIN_MODEL_KINDS } from '../types.js';
import { boardModel } from './builtin/board.js';
import { antennaModel } from './builtin/antenna.js';
import { cameraModel } from './builtin/camera.js';
import { coverModel } from './builtin/cover.js';
import { displayModel } from './builtin/display.js';
import { esp32Model } from './builtin/esp32.js';
import { extrusionModel } from './builtin/extrusion.js';
import { hx711Model } from './builtin/hx711.js';
import { jetsonModel } from './builtin/jetson.js';
import { lensModel } from './builtin/lens.js';
import { loadCellModel } from './builtin/load-cell.js';
import { mountModel } from './builtin/mount.js';
import { powerModel } from './builtin/power.js';
import { probeModel } from './builtin/probe.js';
import { resistorModel } from './builtin/resistor.js';
import { ssdModel } from './builtin/ssd.js';
import { wifiModel } from './builtin/wifi.js';
import { getRegisteredModel, registerModel, setFallbackModel } from './registry.js';
import type { ModelDefinition } from './types.js';

export const builtinModels: readonly ModelDefinition[] = [
  boardModel,
  esp32Model,
  hx711Model,
  loadCellModel,
  probeModel,
  resistorModel,
  powerModel,
  jetsonModel,
  cameraModel,
  lensModel,
  ssdModel,
  wifiModel,
  displayModel,
  mountModel,
  extrusionModel,
  coverModel,
  antennaModel,
];

setFallbackModel(boardModel);
// Skip kinds a third party already registered so lazy 3D import cannot clobber them.
for (const model of builtinModels) {
  if (!getRegisteredModel(model.kind)) registerModel(model);
}

export { BUILTIN_MODEL_KINDS };
export { addMesh, cssColor } from './helpers.js';
export { defaultPinLocalPosition, localPinPosition, pinIndexOnSide, pinsBySide } from './layout.js';
export {
  buildRegisteredModel,
  getRegisteredModel,
  lookupModel,
  registerModel,
  resolveModel,
  setFallbackModel,
  unregisterModel,
} from './registry.js';
export type { ModelBuildResult, ModelDefinition, PinLayoutContext, ThreeModule } from './types.js';

export { boardModel, buildGenericBoard } from './builtin/board.js';
export {
  ESP32_HEADER_HEIGHT_MM,
  ESP32_HEADER_PIN_COUNT,
  ESP32_HEADER_PITCH_MM,
  ESP32_HEADER_SINK_MM,
  ESP32_PCB_THICKNESS_MM,
  ESP32_PIN_PROUD_MM,
  ESP32_PIN_SIZE_MM,
  buildEsp32,
  esp32HeaderHousingTopY,
  esp32HeaderPinX,
  esp32HeaderRowZ,
  esp32HeaderSlotIndex,
  esp32HeaderStartX,
  esp32Model,
  esp32PinTipY,
} from './builtin/esp32.js';
export { buildHx711, hx711Model } from './builtin/hx711.js';
export { buildLoadCell, loadCellModel } from './builtin/load-cell.js';
export { buildProbe, probeModel } from './builtin/probe.js';
export { buildResistor, matchesResistance, resistorModel } from './builtin/resistor.js';
export { buildPowerBlock, powerModel } from './builtin/power.js';
export { buildJetson, jetsonModel } from './builtin/jetson.js';
export { buildCamera, cameraModel } from './builtin/camera.js';
export { buildLens, lensModel } from './builtin/lens.js';
export { buildSsd, ssdModel } from './builtin/ssd.js';
export { buildWifi, wifiModel } from './builtin/wifi.js';
export { buildDisplay, displayModel } from './builtin/display.js';
export { buildMount, mountModel } from './builtin/mount.js';
export { buildExtrusion, extrusionModel } from './builtin/extrusion.js';
export { buildCover, coverModel } from './builtin/cover.js';
export { buildAntenna, antennaModel } from './builtin/antenna.js';
