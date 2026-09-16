import { createCharacterLcdModel } from './character-lcd.js';

const lcd1602 = createCharacterLcdModel({
  kind: 'lcd1602',
  columns: 16,
  rows: 2,
  // WHY: real 1602 windows are ~64.5 x 16 mm (about 4:1). Keep that ratio as size changes.
  windowWMm: 64.5,
  windowAspect: 4.03,
  referenceW: 80,
  canWindowScale: 0.84,
});

export const buildLcd1602 = lcd1602.build;
export const resolveLcd1602PinPosition = lcd1602.resolvePinPosition;
export const lcd1602Model = lcd1602.model;
