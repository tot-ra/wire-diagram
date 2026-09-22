import { BUILTIN_MODEL_KINDS } from '../types.js';
import { boardModel } from './builtin/board.js';
import { arduinoUnoModel } from './builtin/arduino-uno.js';
import { barrelJackModel } from './builtin/barrel-jack.js';
import { ds18b20Model } from './builtin/ds18b20.js';
import { esp32Model } from './builtin/esp32.js';
import { hx711Model } from './builtin/hx711.js';
import { jetsonNanoModel, jetsonOrinNanoModel } from './builtin/jetson.js';
import { jstConnectorModel } from './builtin/jst-connector.js';
import { lcd1602Model } from './builtin/lcd1602.js';
import { lcd2004Model } from './builtin/lcd2004.js';
import { ledModel } from './builtin/led.js';
import { loadCellModel } from './builtin/load-cell.js';
import { max4466Model } from './builtin/max4466.js';
import { max9814Model } from './builtin/max9814.js';
import { powerModel } from './builtin/power.js';
import { probeModel } from './builtin/probe.js';
import { raspberryPiModel } from './builtin/raspberry-pi.js';
import { resistorModel } from './builtin/resistor.js';
import { statusLedModel } from './builtin/status-led.js';
import { stepperDriverModel } from './builtin/stepper-driver.js';
import { stepperMotorModel } from './builtin/stepper-motor.js';
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
  max4466Model,
  max9814Model,
  ds18b20Model,
  lcd1602Model,
  lcd2004Model,
  raspberryPiModel,
  barrelJackModel,
  jstConnectorModel,
  jetsonNanoModel,
  jetsonOrinNanoModel,
  stepperMotorModel,
  stepperDriverModel,
  ledModel,
  statusLedModel,
  arduinoUnoModel,
];

setFallbackModel(boardModel);
// Skip kinds a third party already registered so lazy 3D import cannot clobber them.
for (const model of builtinModels) {
  if (!getRegisteredModel(model.kind)) registerModel(model);
}

export { BUILTIN_MODEL_KINDS };
export { addMesh, cssColor } from './helpers.js';
export {
  HEADER_HEIGHT_MM,
  HEADER_PITCH_MM,
  HEADER_PIN_PROUD_MM,
  HEADER_PIN_SIZE_MM,
  HEADER_SINK_MM,
  addPinHeader,
  createHeaderLook,
  headerColumnOffset,
  headerHousingCenterY,
  headerHousingTopY,
  headerPinTipY,
  headerRowOffset,
  headerSlotIndex,
  headerStart,
} from './parts/pin-header.js';
export type { AddPinHeaderOptions, HeaderAlong, HeaderContact, HeaderLook, HeaderRows } from './parts/pin-header.js';
export {
  MICRO_USB_MM,
  USB_A_SINGLE_MM,
  USB_A_STACKED_MM,
  USB_C_MM,
  USB_B_MM,
  addMicroUsb,
  addUsbA,
  addUsbB,
  addUsbC,
  createUsbLook,
  usbATongueColor,
  usbBoxSize,
  usbFacingDelta,
} from './parts/usb.js';
export type { AddUsbAOptions, AddUsbOptions, UsbAGeneration, UsbFacing, UsbLook } from './parts/usb.js';
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
  ESP32_WROOM_ANTENNA_MM,
  ESP32_WROOM_H_MM,
  ESP32_WROOM_L_MM,
  ESP32_WROOM_PCB_MM,
  ESP32_WROOM_W_MM,
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
export { buildMax4466, max4466Model } from './builtin/max4466.js';
export { buildMax9814, max9814Model } from './builtin/max9814.js';
export {
  DS18B20_HEADER_HEIGHT_MM,
  DS18B20_PCB_MM,
  TO92_HEIGHT_MM,
  TO92_LEAD_GAP_MM,
  TO92_LEAD_PITCH_MM,
  TO92_THICK_MM,
  TO92_WIDTH_MM,
  buildDs18b20,
  ds18b20HeaderColumn,
  ds18b20HeaderPinZ,
  ds18b20Model,
  ds18b20PinTipY,
  resolveDs18b20PinPosition,
} from './builtin/ds18b20.js';
export { buildLcd1602, lcd1602Model, resolveLcd1602PinPosition } from './builtin/lcd1602.js';
export { buildLcd2004, lcd2004Model, resolveLcd2004PinPosition } from './builtin/lcd2004.js';
export {
  PI4_NOMINAL_D_MM,
  PI4_NOMINAL_W_MM,
  PI4_PCB_MM,
  buildRaspberryPi,
  pi4FromCorner,
  raspberryPiModel,
  raspberryPiPinTipY,
  raspberryPiVariant,
  resolveRaspberryPiPinPosition,
} from './builtin/raspberry-pi.js';
export type { RaspberryPiVariant } from './builtin/raspberry-pi.js';
export { buildBarrelJack, barrelJackModel } from './builtin/barrel-jack.js';
export { buildJstConnector, jstConnectorModel, jstPinCount } from './builtin/jst-connector.js';
export {
  JETSON_NANO_D_MM,
  JETSON_NANO_W_MM,
  JETSON_ORIN_D_MM,
  JETSON_ORIN_W_MM,
  JETSON_PCB_MM,
  buildJetsonNano,
  buildJetsonOrinNano,
  jetsonHeaderCenter,
  jetsonNanoModel,
  jetsonOrinNanoModel,
  jetsonPinTipY,
  resolveJetsonPinPosition,
} from './builtin/jetson.js';
export { buildStepperMotor, stepperMotorModel } from './builtin/stepper-motor.js';
export { buildStepperDriver, stepperDriverModel } from './builtin/stepper-driver.js';
export {
  LED_LEAD_METALNESS,
  LED_LEAD_PITCH_MM,
  LED_LEAD_SIZE_MM,
  buildLed,
  ledEpoxyBottomY,
  ledLeadAttachY,
  ledLeadRole,
  ledLeadX,
  ledModel,
  resolveLedPinPosition,
} from './builtin/led.js';
export { buildStatusLed, statusLedModel } from './builtin/status-led.js';
export {
  ARDUINO_UNO_DIGITAL_SLOTS,
  ARDUINO_UNO_HEADER_HEIGHT_MM,
  ARDUINO_UNO_NOMINAL_D_MM,
  ARDUINO_UNO_NOMINAL_W_MM,
  ARDUINO_UNO_PCB_MM,
  ARDUINO_UNO_POWER_SLOTS,
  arduinoUnoDigitalPinX,
  arduinoUnoHeaderRowZ,
  arduinoUnoPinTipY,
  arduinoUnoPowerPinX,
  arduinoUnoModel,
  buildArduinoUno,
  resolveArduinoUnoPinPosition,
} from './builtin/arduino-uno.js';
