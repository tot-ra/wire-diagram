import { createCharacterLcdModel } from './character-lcd.js';

const lcd2004 = createCharacterLcdModel({
  kind: 'lcd2004',
  columns: 20,
  rows: 4,
  // WHY: typical 2004A/I2C modules are 98 x 60 mm with a ~76 x 25.2 mm window (~3:1, not 1602's 4:1).
  windowWMm: 76,
  windowAspect: 76 / 25.2,
  referenceW: 98,
  canWindowScale: 0.9,
});

export const buildLcd2004 = lcd2004.build;
export const resolveLcd2004PinPosition = lcd2004.resolvePinPosition;
export const lcd2004Model = lcd2004.model;
