// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import * as THREE from 'three';
import { parseDiagram } from '../src/parser.js';
import {
  buildEsp32,
  buildDs18b20,
  resolveDs18b20PinPosition,
  buildArduinoUno,
  resolveArduinoUnoPinPosition,
  arduinoUnoDigitalPinX,
  arduinoUnoHeaderRowZ,
  arduinoUnoPinTipY,
  arduinoUnoPowerPinX,
  buildJstConnector,
  buildLcd1602,
  resolveLcd1602PinPosition,
  buildLcd2004,
  resolveLcd2004PinPosition,
  buildLed,
  ledEpoxyBottomY,
  ledLeadAttachY,
  ledLeadX,
  resolveLedPinPosition,
  buildLoadCell,
  buildMax4466,
  buildMax9814,
  buildBarrelJack,
  buildPowerBlock,
  buildProbe,
  buildRaspberryPi,
  resolveRaspberryPiPinPosition,
  raspberryPiPinTipY,
  pi4FromCorner,
  buildResistor,
  buildStatusLed,
  buildStepperDriver,
  buildStepperMotor,
  create3DView,
  jstPinCount,
  raspberryPiVariant,
  ESP32_HEADER_PIN_COUNT,
  esp32HeaderPinX,
  esp32HeaderRowZ,
  esp32PinTipY,
  localPinPosition,
  matchesResistance,
  parseEndpoint,
} from '../src/view3d.js';

beforeAll(() => {
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  }

  HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
    if (type === '2d') {
      return {
        font: '',
        fillStyle: '',
        textBaseline: '',
        measureText: () => ({ width: 80 }),
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        closePath: () => {},
        fill: () => {},
        fillText: () => {},
      };
    }
    return null;
  }) as typeof HTMLCanvasElement.prototype.getContext;
});

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    outputColorSpace = '';
    shadowMap = { enabled: false, type: 0 };
    constructor() {}
    getContext(): object {
      return {};
    }
    setPixelRatio(): void {}
    setSize(): void {}
    render(): void {}
    dispose(): void {}
  }
  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    target = new (class {
      set(): void {}
      copy(): void {}
    })();
    enableDamping = false;
    addEventListener(): void {}
    update(): boolean {
      return false;
    }
    dispose(): void {}
  },
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load(): void {}
  },
}));

const sample = parseDiagram({
  version: 1,
  title: '3D sample',
  components: [
    {
      id: 'esp',
      label: 'ESP32',
      kind: 'esp32',
      dimensions: [55, 20, 28],
      position: [0, 0, 0],
      quantity: 1,
      pins: [
        { id: 'gnd', side: 'left' },
        { id: 'vin', side: 'left' },
        { id: 'out', side: 'right' },
      ],
    },
  ],
  wires: [],
});

describe('view3d helpers', () => {
  it('parses endpoint refs', () => {
    expect(parseEndpoint('esp.gnd')).toEqual({ componentId: 'esp', pinId: 'gnd' });
    expect(parseEndpoint('invalid')).toBeNull();
  });

  it('matches 4.7 kΩ resistance with spacing variants', () => {
    const resistor = {
      id: 'r1',
      label: 'pull-up',
      kind: 'resistor' as const,
      dimensions: [10, 3, 3] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
      properties: { resistance: '4.7  kΩ' },
    };
    expect(matchesResistance(resistor, '4.7 kΩ')).toBe(true);
    expect(matchesResistance({ ...resistor, properties: { resistance: '1 kΩ' } }, '4.7 kΩ')).toBe(false);
  });

  it('builds probe as a horizontal stainless cylinder with black shrink at -X', () => {
    const component = {
      id: 'probe',
      label: 'DS18B20 probe',
      kind: 'probe' as const,
      dimensions: [50, 6, 6] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildProbe(THREE, component);
    const shaft = meshes.find((mesh) => mesh.name === 'probe-shaft');
    const shrink = meshes.find((mesh) => mesh.name === 'probe-shrink');

    expect(shaft).toBeTruthy();
    expect(shrink).toBeTruthy();
    expect(shaft!.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(shrink!.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(shrink!.position.x).toBeLessThan(shaft!.position.x);

    const shaftGeom = shaft!.geometry as THREE.CylinderGeometry;
    expect(shaftGeom.parameters.radiusTop).toBeCloseTo(3);
    expect(shaftGeom.parameters.height).toBeCloseTo(42);
  });

  it('renders 4.7 kΩ color bands only when resistance matches', () => {
    const base = {
      id: 'r1',
      label: 'R',
      kind: 'resistor' as const,
      dimensions: [10, 3, 3] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };

    const withBands = buildResistor(THREE, { ...base, properties: { resistance: '4.7 kΩ' } });
    expect(withBands.meshes.filter((mesh) => mesh.name.startsWith('resistor-band-'))).toHaveLength(4);

    const neutral = buildResistor(THREE, { ...base, properties: { resistance: '1 kΩ' } });
    expect(neutral.meshes.filter((mesh) => mesh.name.startsWith('resistor-band-'))).toHaveLength(0);
  });

  it('builds a bar load cell with end blocks, mounting holes and a strain-gauge pocket', () => {
    const component = {
      id: 'load',
      label: 'Load cell · 20 kg',
      kind: 'load-cell' as const,
      dimensions: [75, 13, 13] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildLoadCell(THREE, component);
    expect(meshes.find((mesh) => mesh.name === 'load-cell-end-neg')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'load-cell-end-pos')).toBeTruthy();
    expect(meshes.filter((mesh) => mesh.name === 'load-cell-hole')).toHaveLength(2);
    expect(meshes.find((mesh) => mesh.name === 'load-cell-flange-top')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'load-cell-web')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'load-cell-gauge')).toBeTruthy();

    const left = meshes.find((mesh) => mesh.name === 'load-cell-end-neg')!;
    const right = meshes.find((mesh) => mesh.name === 'load-cell-end-pos')!;
    expect(left.position.x).toBeLessThan(0);
    expect(right.position.x).toBeGreaterThan(0);
    expect(left.geometry).toBeInstanceOf(THREE.BoxGeometry);
    const endGeom = left.geometry as THREE.BoxGeometry;
    expect(endGeom.parameters.height).toBeCloseTo(13);
    expect(endGeom.parameters.depth).toBeCloseTo(13);
  });

  it('builds a USB supply whose blue badge does not share the housing top plane', () => {
    const component = {
      id: 'usb',
      label: 'USB 5 V supply',
      kind: 'power' as const,
      dimensions: [28, 14, 22] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildPowerBlock(THREE, component);
    const housing = meshes.find((mesh) => mesh.name === 'power-housing');
    const accent = meshes.find((mesh) => mesh.name === 'power-accent');
    expect(housing).toBeTruthy();
    expect(accent).toBeTruthy();
    expect(accent!.receiveShadow).toBe(false);

    const housingGeom = housing!.geometry as THREE.BoxGeometry;
    const accentGeom = accent!.geometry as THREE.BoxGeometry;
    const housingTop = housing!.position.y + housingGeom.parameters.height / 2;
    const accentBottom = accent!.position.y - accentGeom.parameters.height / 2;
    const accentTop = accent!.position.y + accentGeom.parameters.height / 2;

    expect(accentTop).toBeGreaterThan(housingTop);
    expect(accentBottom).toBeLessThan(housingTop);
    expect(accentTop).not.toBeCloseTo(housingTop, 5);
  });

  it('places ESP32 default pin anchors on the long-edge header grid', () => {
    const component = {
      id: 'esp',
      label: 'ESP32',
      kind: 'esp32' as const,
      dimensions: [52, 3, 28] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [
        { id: 'gnd', side: 'left' as const },
        { id: 'out', side: 'right' as const },
      ],
    };

    const gnd = localPinPosition(component, component.pins[0]);
    const out = localPinPosition(component, component.pins[1]);
    expect(gnd[0]).toBeCloseTo(esp32HeaderPinX(0));
    expect(gnd[1]).toBeCloseTo(esp32PinTipY());
    expect(gnd[2]).toBeCloseTo(esp32HeaderRowZ(28, 'left'));
    expect(out[2]).toBeCloseTo(esp32HeaderRowZ(28, 'right'));
    expect(Math.abs(gnd[0])).toBeLessThan(component.dimensions[0] / 2);
  });

  it('builds ESP32 dual headers whose named pins match wire anchors', () => {
    const component = {
      id: 'esp',
      label: 'ESP32 DevKit',
      kind: 'esp32' as const,
      dimensions: [52, 3, 28] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [
        { id: 'VIN', side: 'left' as const, position: [-22.86, 10.2, 12.73] as [number, number, number] },
        { id: 'GND', side: 'left' as const, position: [-20.32, 10.2, 12.73] as [number, number, number] },
        { id: '3V3', side: 'right' as const, position: [-22.86, 10.2, -12.73] as [number, number, number] },
        { id: 'IO4', side: 'right' as const, position: [-10.16, 10.2, -12.73] as [number, number, number] },
      ],
    };

    const { meshes } = buildEsp32(THREE, component);
    const pinMeshes = meshes.filter((mesh) => mesh.name.startsWith('esp32-header-pin:'));
    expect(pinMeshes).toHaveLength(ESP32_HEADER_PIN_COUNT * 2);
    expect(meshes.find((mesh) => mesh.name === 'esp32-header-housing:left')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-header-housing:right')).toBeTruthy();

    for (const pin of component.pins) {
      const mesh = meshes.find((entry) => entry.name === `esp32-header-pin:${pin.id}`);
      expect(mesh, `missing header pin mesh for ${pin.id}`).toBeTruthy();
      const local = localPinPosition(component, pin);
      expect(mesh!.position.x).toBeCloseTo(local[0], 5);
      expect(mesh!.position.z).toBeCloseTo(local[2], 5);
      expect(mesh!.geometry).toBeInstanceOf(THREE.BoxGeometry);
      const geom = mesh!.geometry as THREE.BoxGeometry;
      expect(geom.parameters.width).toBeCloseTo(0.64);
      const tipY = mesh!.position.y + geom.parameters.height / 2;
      expect(tipY).toBeCloseTo(local[1], 5);
    }

    expect(meshes.find((mesh) => mesh.name === 'esp32-usb')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-usb:cavity:0')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-module')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-shield')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-antenna')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-antenna-trace:0')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-boot')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-en-cap')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-uart')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-ldo')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'esp32-led-pwr')).toBeTruthy();
    const shield = meshes.find((mesh) => mesh.name === 'esp32-shield')!;
    const shieldMetal = (shield.material as THREE.MeshStandardMaterial).metalness;
    expect(shieldMetal).toBeLessThan(0.55);
    const usb = meshes.find((mesh) => mesh.name === 'esp32-usb')!;
    const cavity = meshes.find((mesh) => mesh.name === 'esp32-usb:cavity:0')!;
    const usbFace = usb.position.x - (usb.geometry as THREE.BoxGeometry).parameters.width / 2;
    const cavityOuter = cavity.position.x - (cavity.geometry as THREE.BoxGeometry).parameters.width / 2;
    expect(cavityOuter).toBeLessThan(usbFace);
  });

  it('builds MAX4466 with a can mic and gain trimmer', () => {
    const component = {
      id: 'mic',
      label: 'MAX4466',
      kind: 'max4466' as const,
      dimensions: [20, 6, 14] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildMax4466(THREE, component);
    expect(meshes.find((mesh) => mesh.name === 'max4466-mic')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'max4466-trimmer')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'max4466-pcb')).toBeTruthy();
  });

  it('builds MAX9814 with gain pads instead of a trimmer', () => {
    const component = {
      id: 'mic',
      label: 'MAX9814',
      kind: 'max9814' as const,
      dimensions: [24, 6, 16] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildMax9814(THREE, component);
    expect(meshes.filter((mesh) => mesh.name === 'max9814-gain-pad')).toHaveLength(3);
    expect(meshes.find((mesh) => mesh.name === 'max4466-trimmer')).toBeUndefined();
  });

  it('builds a DS18B20 TO-92 module distinct from the waterproof probe', () => {
    const component = {
      id: 't',
      label: 'DS18B20',
      kind: 'ds18b20' as const,
      dimensions: [21, 10, 10] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [
        { id: 'VDD', side: 'left' as const },
        { id: 'DQ', side: 'right' as const },
        { id: 'GND', side: 'left' as const },
      ],
    };
    const { meshes } = buildDs18b20(THREE, component);
    const to92 = meshes.find((mesh) => mesh.name === 'ds18b20-to92')!;
    expect(to92.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(meshes.find((mesh) => mesh.name === 'ds18b20-led-lens')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'ds18b20-r1')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'ds18b20-r2')).toBeTruthy();
    expect(meshes.filter((mesh) => mesh.name.startsWith('ds18b20-header:'))).toHaveLength(3);
    expect(meshes.filter((mesh) => mesh.name.startsWith('ds18b20-lead:'))).toHaveLength(3);
    expect(meshes.filter((mesh) => mesh.name.startsWith('ds18b20-pad:'))).toHaveLength(3);
    expect(meshes.find((mesh) => mesh.name === 'probe-shaft')).toBeUndefined();
    const gnd = resolveDs18b20PinPosition(component, component.pins[2]);
    const dq = resolveDs18b20PinPosition(component, component.pins[1]);
    const vdd = resolveDs18b20PinPosition(component, component.pins[0]);
    expect(gnd[2]).toBeLessThan(dq[2]);
    expect(dq[2]).toBeLessThan(vdd[2]);
    expect(gnd[1]).toBeCloseTo(vdd[1]);
    expect(to92.position.x).toBeGreaterThan(0);
  });

  it('builds LCD1602 flat with glass on +Y and an I2C backpack below', () => {
    const component = {
      id: 'lcd',
      label: 'LCD',
      kind: 'lcd1602' as const,
      dimensions: [80, 13, 36] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildLcd1602(THREE, component);
    const glass = meshes.find((mesh) => mesh.name === 'lcd1602-glass')!;
    const pack = meshes.find((mesh) => mesh.name === 'lcd1602-backpack')!;
    const cell = meshes.find((mesh) => mesh.name === 'lcd1602-cell:0:0')!;
    expect(meshes.filter((mesh) => mesh.name.startsWith('lcd1602-bezel'))).toHaveLength(4);
    expect(meshes.filter((mesh) => mesh.name.startsWith('lcd1602-cell:'))).toHaveLength(32);
    expect(meshes.find((mesh) => mesh.name === 'lcd1602-can')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'lcd1602-trimmer')).toBeTruthy();
    expect(glass.position.y).toBeGreaterThan(pack.position.y);
    expect(cell.position.y).toBeGreaterThan(glass.position.y);
    const sda = resolveLcd1602PinPosition(component, { id: 'SDA', side: 'right' });
    const i2c = meshes.find((mesh) => mesh.name === 'lcd1602-i2c')!;
    expect(sda[2]).toBeGreaterThan(0);
    expect(sda[1]).toBeGreaterThan(i2c.position.y);
  });

  it('builds LCD2004 as a 20x4 I2C module larger than LCD1602', () => {
    const component = {
      id: 'lcd',
      label: 'LCD2004',
      kind: 'lcd2004' as const,
      dimensions: [98, 14, 60] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const small = {
      ...component,
      kind: 'lcd1602' as const,
      dimensions: [80, 13, 36] as [number, number, number],
    };
    const { meshes } = buildLcd2004(THREE, component);
    const glass = meshes.find((mesh) => mesh.name === 'lcd2004-glass')!;
    const pack = meshes.find((mesh) => mesh.name === 'lcd2004-backpack')!;
    const smallGlass = buildLcd1602(THREE, small).meshes.find((mesh) => mesh.name === 'lcd1602-glass')!;
    expect(meshes.filter((mesh) => mesh.name.startsWith('lcd2004-bezel'))).toHaveLength(4);
    expect(meshes.filter((mesh) => mesh.name.startsWith('lcd2004-cell:'))).toHaveLength(80);
    expect(meshes.find((mesh) => mesh.name === 'lcd2004-can')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'lcd2004-trimmer')).toBeTruthy();
    expect(glass.position.y).toBeGreaterThan(pack.position.y);
    expect((glass.geometry as THREE.BoxGeometry).parameters.width).toBeGreaterThan(
      (smallGlass.geometry as THREE.BoxGeometry).parameters.width,
    );
    expect((glass.geometry as THREE.BoxGeometry).parameters.depth).toBeGreaterThan(
      (smallGlass.geometry as THREE.BoxGeometry).parameters.depth,
    );
    const sda = resolveLcd2004PinPosition(component, { id: 'SDA', side: 'right' });
    const i2c = meshes.find((mesh) => mesh.name === 'lcd2004-i2c')!;
    expect(sda[2]).toBeGreaterThan(0);
    expect(sda[1]).toBeGreaterThan(i2c.position.y);
  });

  it('morphs raspberry-pi silhouettes from properties.variant', () => {
    const base = {
      id: 'pi',
      label: 'Pi',
      kind: 'raspberry-pi' as const,
      dimensions: [85, 17, 56] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    expect(raspberryPiVariant({ ...base, properties: { variant: '5' } })).toBe('5');
    expect(raspberryPiVariant({ ...base, properties: { variant: 'zero-2' } })).toBe('zero');
    expect(raspberryPiVariant({ ...base, properties: { variant: 'pico' } })).toBe('pico');
    const pi4 = buildRaspberryPi(THREE, { ...base, properties: { variant: '4' } });
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-pcie')).toBeUndefined();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-usba:3:cap')).toBeTruthy();
    expect(pi4.meshes.filter((mesh) => mesh.name.startsWith('raspberry-pi-gpio-pin:'))).toHaveLength(40);
    const gpioHousing = pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-gpio')!;
    const gpioPin = pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-gpio-pin:0:0')!;
    const gpioHousingTop = gpioHousing.position.y + (gpioHousing.geometry as THREE.BoxGeometry).parameters.height / 2;
    const gpioPinTop = gpioPin.position.y + (gpioPin.geometry as THREE.BoxGeometry).parameters.height / 2;
    expect(gpioPinTop).toBeGreaterThan(gpioHousingTop);
    expect(pi4.meshes.filter((mesh) => mesh.name.startsWith('raspberry-pi-hole:'))).toHaveLength(4);
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-audio')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-audio-sleeve')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-hdmi:0:cavity')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-rj45:cavity')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-ram')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-csi')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-dsi')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-sd')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-poe')).toBeTruthy();
    expect(pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-led-pwr')).toBeTruthy();
    const socColor = (pi4.meshes.find((mesh) => mesh.name === 'raspberry-pi-soc')!.material as THREE.MeshStandardMaterial)
      .color;
    expect(socColor.getHexString()).not.toBe('1a1a1a');
    const usbc = resolveRaspberryPiPinPosition(
      { ...base, properties: { variant: '4' }, pins: [{ id: 'USB-C', side: 'left' }] },
      { id: 'USB-C', side: 'left' },
      { index: 0, count: 1 },
    );
    const gpio = resolveRaspberryPiPinPosition(
      { ...base, properties: { variant: '4' }, pins: [{ id: 'GPIO', side: 'right' }] },
      { id: 'GPIO', side: 'right' },
      { index: 0, count: 1 },
    );
    const sda = resolveRaspberryPiPinPosition(
      { ...base, properties: { variant: '4' }, pins: [{ id: 'SDA', side: 'right' }] },
      { id: 'SDA', side: 'right' },
      { index: 0, count: 1 },
    );
    expect(usbc[0]).toBeLessThan(0);
    expect(gpio[2]).toBeGreaterThan(usbc[2]);
    expect(gpio[1]).toBeCloseTo(raspberryPiPinTipY({ ...base, properties: { variant: '4' } }));
    expect(sda[0]).toBeLessThan(gpio[0]);
    expect(sda[2]).toBeGreaterThan(gpio[2]);
    expect(pi4FromCorner(85, 56, 3.5, 3.5).x).toBeCloseTo(-85 / 2 + 3.5);
    const pi5 = buildRaspberryPi(THREE, { ...base, properties: { variant: '5' } });
    expect(pi5.meshes.find((mesh) => mesh.name === 'raspberry-pi-pcie')).toBeTruthy();
    expect(pi5.meshes.find((mesh) => mesh.name === 'raspberry-pi-rj45')).toBeTruthy();
    expect(pi5.meshes.find((mesh) => mesh.name === 'raspberry-pi-gpio')).toBeTruthy();
    expect(pi5.meshes.filter((mesh) => mesh.name.startsWith('raspberry-pi-gpio-pin:'))).toHaveLength(40);
    expect(pi5.meshes.find((mesh) => mesh.name === 'raspberry-pi-usba:3')).toBeTruthy();
    expect(pi5.meshes.find((mesh) => mesh.name === 'raspberry-pi-usba:2')).toBeTruthy();
    expect(pi5.meshes.find((mesh) => mesh.name === 'raspberry-pi-usba:3:cavity:0')).toBeTruthy();
    expect(pi5.meshes.find((mesh) => mesh.name === 'raspberry-pi-usba:3:tongue:0')).toBeTruthy();
    const zero = buildRaspberryPi(THREE, {
      ...base,
      dimensions: [65, 8, 30],
      properties: { variant: 'zero' },
    });
    expect(zero.meshes.find((mesh) => mesh.name === 'raspberry-pi-rj45')).toBeUndefined();
    expect(zero.meshes.find((mesh) => mesh.name === 'raspberry-pi-hdmi')).toBeTruthy();
    expect(zero.meshes.find((mesh) => mesh.name === 'raspberry-pi-usb:otg')).toBeTruthy();
    expect(zero.meshes.find((mesh) => mesh.name === 'raspberry-pi-usb:power')).toBeTruthy();
    expect(zero.meshes.filter((mesh) => mesh.name.startsWith('raspberry-pi-gpio-pin:'))).toHaveLength(40);
    const pico = buildRaspberryPi(THREE, {
      ...base,
      dimensions: [51, 6, 21],
      properties: { variant: 'pico' },
    });
    expect(pico.meshes.find((mesh) => mesh.name === 'raspberry-pi-usbc')).toBeUndefined();
    expect(pico.meshes.find((mesh) => mesh.name === 'raspberry-pi-header:pos')).toBeTruthy();
    expect(pico.meshes.filter((mesh) => mesh.name.startsWith('raspberry-pi-header-pin:'))).toHaveLength(40);
  });

  it('builds an Arduino UNO R3 with USB-B, barrel jack, DIP MCU and female headers', () => {
    const component = {
      id: 'uno',
      label: 'UNO',
      kind: 'arduino-uno' as const,
      dimensions: [68.6, 15, 53.4] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [
        { id: 'D13', side: 'left' as const },
        { id: 'GND', side: 'left' as const },
        { id: '5V', side: 'right' as const },
        { id: 'A0', side: 'right' as const },
      ],
    };
    const { meshes } = buildArduinoUno(THREE, component);
    expect(meshes.find((mesh) => mesh.name === 'arduino-uno-pcb')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'arduino-uno-usb')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'arduino-uno-usb:cavity:0')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'arduino-uno-jack-sleeve')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'arduino-uno-mcu')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'arduino-uno-16u2')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'arduino-uno-reset')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'arduino-uno-led-l')).toBeTruthy();
    expect(meshes.filter((mesh) => mesh.name.startsWith('arduino-uno-hole:'))).toHaveLength(4);
    expect(meshes.filter((mesh) => mesh.name.includes('-well:'))).toHaveLength(32);
    const d13 = resolveArduinoUnoPinPosition(component, component.pins[0], { index: 0, count: 2 });
    const gnd = resolveArduinoUnoPinPosition(component, component.pins[1], { index: 1, count: 2 });
    const v5 = resolveArduinoUnoPinPosition(component, component.pins[2], { index: 0, count: 2 });
    const a0 = resolveArduinoUnoPinPosition(component, component.pins[3], { index: 1, count: 2 });
    expect(d13).toEqual(localPinPosition(component, component.pins[0]));
    expect(d13[2]).toBeCloseTo(arduinoUnoHeaderRowZ(53.4, 'digital'));
    expect(v5[2]).toBeCloseTo(arduinoUnoHeaderRowZ(53.4, 'power'));
    expect(d13[0]).toBeCloseTo(arduinoUnoDigitalPinX(68.6, 13));
    expect(gnd[0]).toBeCloseTo(arduinoUnoDigitalPinX(68.6, 14));
    expect(v5[0]).toBeCloseTo(arduinoUnoPowerPinX(68.6, 4));
    expect(a0[0]).toBeCloseTo(arduinoUnoPowerPinX(68.6, 8));
    expect(a0[0]).toBeGreaterThan(v5[0]);
    expect(d13[1]).toBeCloseTo(arduinoUnoPinTipY());
    expect(d13[2]).toBeGreaterThan(v5[2]);
    const housing = meshes.find((mesh) => mesh.name === 'arduino-uno-digital-hi')!;
    const housingTop = housing.position.y + (housing.geometry as THREE.BoxGeometry).parameters.height / 2;
    expect(d13[1]).toBeLessThan(housingTop);
    expect(d13[1]).toBeGreaterThan(housing.position.y);
  });

  it('builds barrel jack, JST, stepper, driver and LED silhouettes', () => {
    const origin = [0, 0, 0] as [number, number, number];
    const jack = buildBarrelJack(THREE, {
      id: 'j',
      label: 'Jack',
      kind: 'barrel-jack',
      dimensions: [14, 11, 9],
      position: origin,
      quantity: 1,
      pins: [],
    });
    expect(jack.meshes.find((mesh) => mesh.name === 'barrel-jack-sleeve')).toBeTruthy();

    const jst = {
      id: 'c',
      label: 'JST',
      kind: 'jst-connector' as const,
      dimensions: [14, 8, 10] as [number, number, number],
      position: origin,
      quantity: 1,
      pins: [],
      properties: { pins: 3 },
    };
    expect(jstPinCount(jst)).toBe(3);
    expect(buildJstConnector(THREE, jst).meshes.filter((mesh) => mesh.name === 'jst-pin')).toHaveLength(3);

    const motor = buildStepperMotor(THREE, {
      id: 'm',
      label: 'Stepper',
      kind: 'stepper-motor',
      dimensions: [48, 42, 42],
      position: origin,
      quantity: 1,
      pins: [],
    });
    const shaft = motor.meshes.find((mesh) => mesh.name === 'stepper-motor-shaft')!;
    expect(shaft.position.x).toBeGreaterThan(0);

    const driver = buildStepperDriver(THREE, {
      id: 'd',
      label: 'Driver',
      kind: 'stepper-driver',
      dimensions: [20, 8, 15],
      position: origin,
      quantity: 1,
      pins: [],
    });
    expect(driver.meshes.find((mesh) => mesh.name === 'stepper-driver-heatsink')).toBeTruthy();

    const led = buildLed(THREE, {
      id: 'l',
      label: 'LED',
      kind: 'led',
      dimensions: [6, 10, 6],
      position: origin,
      quantity: 1,
      pins: [
        { id: 'A', side: 'left' },
        { id: 'K', side: 'right' },
      ],
    });
    expect(led.meshes.find((mesh) => mesh.name === 'led-dome')).toBeTruthy();
    const body = led.meshes.find((mesh) => mesh.name === 'led-body')!;
    const anodeAnvil = led.meshes.find((mesh) => mesh.name === 'led-anvil:A')!;
    const cathodeAnvil = led.meshes.find((mesh) => mesh.name === 'led-anvil:K')!;
    const anodeLead = led.meshes.find((mesh) => mesh.name === 'led-lead:A')!;
    const cathodeLead = led.meshes.find((mesh) => mesh.name === 'led-lead:K')!;
    expect(anodeAnvil).toBeTruthy();
    expect(cathodeAnvil).toBeTruthy();
    expect(anodeLead.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(cathodeLead.geometry).toBeInstanceOf(THREE.BoxGeometry);

    const bodyGeom = body.geometry as THREE.CylinderGeometry;
    const bodyBottom = body.position.y - bodyGeom.parameters.height / 2;
    const anodeAnvilGeom = anodeAnvil.geometry as THREE.BoxGeometry;
    const anodeLeadGeom = anodeLead.geometry as THREE.BoxGeometry;
    const cathodeLeadGeom = cathodeLead.geometry as THREE.BoxGeometry;
    const anodeAnvilTop = anodeAnvil.position.y + anodeAnvilGeom.parameters.height / 2;
    const anodeAnvilBottom = anodeAnvil.position.y - anodeAnvilGeom.parameters.height / 2;
    const anodeLeadTop = anodeLead.position.y + anodeLeadGeom.parameters.height / 2;
    const cathodeLeadTop = cathodeLead.position.y + cathodeLeadGeom.parameters.height / 2;
    const anodeLeadBottom = anodeLead.position.y - anodeLeadGeom.parameters.height / 2;

    // Anvils cross the epoxy floor so they read as metal under the red body, not a coplanar gap.
    expect(anodeAnvilTop).toBeGreaterThan(bodyBottom);
    expect(anodeAnvilBottom).toBeLessThan(bodyBottom);
    expect(cathodeAnvil.position.x).toBeGreaterThan(anodeAnvil.position.x);
    expect(anodeLeadTop).toBeGreaterThan(anodeAnvilBottom);
    expect(anodeLeadTop).toBeLessThan(bodyBottom + 0.05);
    expect(cathodeLeadTop).toBeLessThan(bodyBottom + 0.05);
    expect(anodeLeadBottom).toBeLessThan(cathodeLead.position.y - cathodeLeadGeom.parameters.height / 2);

    const component = {
      id: 'l',
      label: 'LED',
      kind: 'led' as const,
      dimensions: [6, 10, 6] as [number, number, number],
      position: origin,
      quantity: 1,
      pins: [
        { id: 'A', side: 'left' as const },
        { id: 'K', side: 'right' as const },
      ],
    };
    const anodePin = localPinPosition(component, component.pins[0]);
    const cathodePin = localPinPosition(component, component.pins[1]);
    expect(anodePin).toEqual(resolveLedPinPosition(component, component.pins[0]));
    expect(anodePin[0]).toBeCloseTo(ledLeadX(6, 6, 'left'));
    expect(cathodePin[0]).toBeCloseTo(ledLeadX(6, 6, 'right'));
    expect(anodePin[1]).toBeCloseTo(ledLeadAttachY(10));
    expect(anodePin[1]).toBeLessThan(ledEpoxyBottomY(10));
    expect(anodePin[0]).toBeCloseTo(anodeLead.position.x, 5);
    expect(cathodePin[0]).toBeCloseTo(cathodeLead.position.x, 5);
    expect(anodePin[1]).toBeGreaterThan(anodeLeadBottom);
    expect(anodePin[1]).toBeLessThan(anodeLeadTop);
    expect((anodeLead.material as THREE.MeshStandardMaterial).metalness).toBeCloseTo(0.4);

    const status = buildStatusLed(THREE, {
      id: 's',
      label: 'Status',
      kind: 'status-led',
      dimensions: [10, 8, 8],
      position: origin,
      quantity: 1,
      pins: [],
    });
    expect(status.meshes.find((mesh) => mesh.name === 'status-led-bezel')).toBeTruthy();
  });
});

describe('create3DView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sets canvas accessibility attributes', async () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 480, configurable: true });

    const view = create3DView(host, sample, { onSelect: () => {}, onHover: () => {} });
    const canvas = host.querySelector('canvas');
    expect(canvas?.getAttribute('role')).toBe('img');
    expect(canvas?.getAttribute('aria-label')).toBe('3D sample 3D wiring diagram');

    await vi.waitFor(() => expect(canvas).toBeTruthy(), { timeout: 3000 });
    view.destroy();
  });

  it('does not emit onSelect for programmatic select', async () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 480, configurable: true });

    const onSelect = vi.fn();
    const view = create3DView(host, sample, { onSelect, onHover: () => {} });

    await vi.waitFor(() => expect(host.querySelector('canvas')).toBeTruthy(), { timeout: 3000 });

    view.select('esp');
    expect(onSelect).not.toHaveBeenCalled();

    view.destroy();
  });

  it('preserves early programmatic selection without emitting onSelect', async () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 480, configurable: true });

    const onSelect = vi.fn();
    const view = create3DView(host, sample, { onSelect, onHover: () => {} });
    view.select('esp');

    await vi.waitFor(() => expect(host.querySelector('canvas')).toBeTruthy(), { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(onSelect).not.toHaveBeenCalled();
    view.select('esp');
    expect(onSelect).not.toHaveBeenCalled();

    view.destroy();
  });

  it('does not emit errors after destroy', async () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 480, configurable: true });

    const onError = vi.fn();
    const view = create3DView(host, sample, {
      onSelect: () => {},
      onHover: () => {},
      onError,
    });

    await vi.waitFor(() => expect(host.querySelector('canvas')).toBeTruthy(), { timeout: 3000 });
    view.destroy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports WebGL init failure and cleans up host', async () => {
    const threeModule = await import('three');
    const WebGLRenderer = threeModule.WebGLRenderer as unknown as new (...args: unknown[]) => {
      getContext(): null;
      dispose(): void;
    };
    const failingRenderer = vi.spyOn(threeModule, 'WebGLRenderer').mockImplementation(function FailingRenderer() {
      return {
        getContext: () => null,
        dispose: vi.fn(),
        domElement: document.createElement('canvas'),
        outputColorSpace: '',
        shadowMap: { enabled: false, type: 0 },
        setPixelRatio: vi.fn(),
        setSize: vi.fn(),
        render: vi.fn(),
      };
    } as unknown as InstanceType<typeof threeModule.WebGLRenderer>);

    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 480, configurable: true });

    const onError = vi.fn();
    const view = create3DView(host, sample, {
      onSelect: () => {},
      onHover: () => {},
      onError,
    });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('WebGL not available'));
    }, { timeout: 3000 });

    view.destroy();
    expect(host.childNodes.length).toBe(0);

    failingRenderer.mockRestore();
    threeModule.WebGLRenderer = WebGLRenderer;
  });

  it('reset before initialization does not throw', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 480, configurable: true });
    const view = create3DView(host, sample, { onSelect: () => {}, onHover: () => {} });
    expect(() => view.reset()).not.toThrow();
    view.destroy();
  });
});
