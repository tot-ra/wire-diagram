import type { Component, Pin, PinoutId, Vec3 } from './types.js';

/** Logical maps are independent of Three.js so parsing and SVG stay lightweight. */
export interface PinoutContact { number: number; gpio?: number; name: string; }
export interface PinoutDefinition {
  id: PinoutId;
  dimensions: Vec3;
  gpioScheme: 'GPIO' | 'BCM';
  contacts: readonly PinoutContact[];
}
const BCM_TO_HEADER: Record<number, number> = {
  0: 27, 1: 28, 2: 3, 3: 5, 4: 7, 5: 29, 6: 31, 7: 26, 8: 24, 9: 21,
  10: 19, 11: 23, 12: 32, 13: 33, 14: 8, 15: 10, 16: 36, 17: 11,
  18: 12, 19: 35, 20: 38, 21: 40, 22: 15, 23: 16, 24: 18, 25: 22, 26: 37, 27: 13,
};
function header40(jetson: boolean): PinoutContact[] {
  return Array.from({ length: 40 }, (_, i) => {
    const number = i + 1;
    // Jetson.GPIO BCM mode exposes only these GPIO-capable contacts. I2C/UART
    // contacts remain addressable by physical number, not invented GPIO aliases.
    const match = Object.entries(BCM_TO_HEADER).find(([gpio, pin]) => pin === number
      && (!jetson || ![0, 1, 2, 3, 14, 15].includes(Number(gpio))));
    const gpio = match ? Number(match[0]) : undefined;
    const power = [1, 17].includes(number) ? '3V3' : [2, 4].includes(number) ? '5V'
      : [6, 9, 14, 20, 25, 30, 34, 39].includes(number) ? 'GND' : undefined;
    const signals: Record<number, string> = { 3: 'SDA', 5: 'SCL', 8: 'TX', 10: 'RX', 27: 'ID_SD', 28: 'ID_SC' };
    return { number, gpio, name: power ?? signals[number] ?? `GPIO${gpio}` };
  });
}
// ESP32 DevKitC-compatible 38-pin WROOM board. Unified numbering: J2.1..19,
// then J3.19..1. This is a documented library convention, NOT WROOM module pads.
const espNames = ['3V3', 'EN', 'GPIO36', 'GPIO39', 'GPIO34', 'GPIO35', 'GPIO32', 'GPIO33',
  'GPIO25', 'GPIO26', 'GPIO27', 'GPIO14', 'GPIO12', 'GND', 'GPIO13', 'GPIO9', 'GPIO10', 'GPIO11', '5V',
  'GPIO6', 'GPIO7', 'GPIO8', 'GPIO15', 'GPIO2', 'GPIO0', 'GPIO4', 'GPIO16', 'GPIO17',
  'GPIO5', 'GPIO18', 'GPIO19', 'GND', 'GPIO21', 'GPIO3', 'GPIO1', 'GPIO22', 'GPIO23', 'GND'];
const picoNames = ['GPIO0', 'GPIO1', 'GND', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5', 'GND',
  'GPIO6', 'GPIO7', 'GPIO8', 'GPIO9', 'GND', 'GPIO10', 'GPIO11', 'GPIO12', 'GPIO13', 'GND',
  'GPIO14', 'GPIO15', 'GPIO16', 'GPIO17', 'GND', 'GPIO18', 'GPIO19', 'GPIO20', 'GPIO21', 'GND',
  'GPIO22', 'RUN', 'GPIO26', 'GPIO27', 'AGND', 'GPIO28', 'ADC_VREF', '3V3', '3V3_EN', 'GND', 'VSYS', 'VBUS'];
function namedContacts(names: string[]): PinoutContact[] {
  return names.map((name, i) => ({ number: i + 1, name,
    gpio: name.startsWith('GPIO') ? Number(name.slice(4)) : undefined }));
}
const pinouts: Record<PinoutId, PinoutDefinition> = {
  'esp32-devkit-38': { id: 'esp32-devkit-38', dimensions: [52, 3, 28], gpioScheme: 'GPIO', contacts: namedContacts(espNames) },
  'raspberry-pi-40': { id: 'raspberry-pi-40', dimensions: [85, 18, 56], gpioScheme: 'BCM', contacts: header40(false) },
  'raspberry-pi-pico': { id: 'raspberry-pi-pico', dimensions: [51, 3, 21], gpioScheme: 'GPIO', contacts: namedContacts(picoNames) },
  'jetson-nano': { id: 'jetson-nano', dimensions: [100, 18, 80], gpioScheme: 'BCM', contacts: header40(true) },
  'jetson-orin-nano': { id: 'jetson-orin-nano', dimensions: [100, 18, 79], gpioScheme: 'BCM', contacts: header40(true) },
};
type BoardIdentity = { kind?: string; pinout?: PinoutId; properties?: Component['properties'] };
export function inferredPinoutId(component: BoardIdentity): PinoutId | undefined {
  if (component.kind === 'esp32') return 'esp32-devkit-38';
  if (component.kind === 'raspberry-pi') {
    return String(component.properties?.variant ?? '').toLowerCase().includes('pico') ? 'raspberry-pi-pico' : 'raspberry-pi-40';
  }
  if (component.kind === 'jetson-nano' || component.kind === 'jetson-orin-nano') return component.kind;
  return undefined;
}
export function getPinout(component: BoardIdentity): PinoutDefinition | undefined {
  const id = component.pinout ?? inferredPinoutId(component);
  return id ? pinouts[id] : undefined;
}
export function defaultBoardDimensions(component: BoardIdentity): Vec3 | undefined {
  if (component.kind === 'raspberry-pi' && String(component.properties?.variant).toLowerCase().includes('zero')) return [65, 3, 30];
  const dimensions = getPinout(component)?.dimensions;
  return dimensions ? [...dimensions] : undefined;
}
const normalize = (id: string) => id.trim().toUpperCase().replace(/[\s_-]+/g, '');
export function isNumberedPinReference(id: string): boolean {
  return /^(?:(?:PIN|GPIO|IO|GP|BCM))?\d+$/.test(normalize(id));
}
export function contactByReference(profile: PinoutDefinition, id: string): PinoutContact | undefined {
  const key = normalize(id);
  const physical = key.match(/^(?:PIN)?(\d+)$/);
  if (physical) return profile.contacts.find(pin => pin.number === Number(physical[1]));
  const gpio = key.match(/^(GPIO|IO|GP|BCM)(\d+)$/);
  if (gpio) {
    if (gpio[1] === 'BCM' && profile.gpioScheme !== 'BCM') return undefined;
    return profile.contacts.find(pin => pin.gpio === Number(gpio[2]));
  }
  if (key === 'VIN' && profile.id.startsWith('jetson-')) return undefined;
  const aliases: Record<string, string> = { VIN: '5V', VCC: '5V', VDD: '5V', GROUND: 'GND', TXD: 'TX', RXD: 'RX', '3V': '3V3' };
  const name = aliases[key] ?? key;
  const named = profile.contacts.find(pin => normalize(pin.name) === name);
  if (named) return named;
  if (profile.id === 'esp32-devkit-38') {
    const espAliases: Record<string, number> = { VP: 36, VN: 39, TX: 1, RX: 3, SDA: 21, SCL: 22 };
    return profile.contacts.find(pin => pin.gpio !== undefined && pin.gpio === espAliases[key]);
  }
  if (profile.id === 'raspberry-pi-pico') return undefined;
  const aliases40: Record<string, number> = { MOSI: 19, MISO: 21, SCLK: 23, SCK: 23, CE0: 24, CE1: 26 };
  return profile.contacts.find(pin => pin.number === aliases40[key]);
}
export function resolvePhysicalPinNumber(component: BoardIdentity, pin: Pick<Pin, 'id' | 'number' | 'gpio'>): number | undefined {
  const profile = getPinout(component);
  if (!profile) return pin.number;
  if (pin.number !== undefined) return profile.contacts.find(contact => contact.number === pin.number)?.number;
  if (pin.gpio !== undefined) return profile.contacts.find(contact => contact.gpio === pin.gpio)?.number;
  return contactByReference(profile, pin.id)?.number;
}
export function physicalPinSide(profile: PinoutDefinition, number: number): Pin['side'] {
  if (profile.id === 'esp32-devkit-38') return number <= 19 ? 'right' : 'left';
  if (profile.id === 'raspberry-pi-pico') return number <= 20 ? 'left' : 'right';
  return number % 2 ? 'left' : 'right';
}
/** Shared display text for schematic, inspector and 3D wire hover. */
export function pinDisplayLabel(pin: Pin): string {
  if (pin.number === undefined && pin.gpio === undefined) return pin.label || pin.id;
  const details = [pin.number === undefined ? '' : `Pin ${pin.number}`, pin.gpio === undefined ? '' : `GPIO${pin.gpio}`].filter(Boolean).join(' / ');
  const label = pin.label;
  return label && label !== `GPIO${pin.gpio}` && label !== `PIN${pin.number}` ? `${details} · ${label}` : details;
}
