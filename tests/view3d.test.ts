// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import * as THREE from 'three';
import { parseDiagram } from '../src/parser.js';
import {
  buildEsp32,
  buildJetson,
  buildCamera,
  buildLens,
  buildSsd,
  buildDisplay,
  buildLoadCell,
  buildPowerBlock,
  buildProbe,
  buildResistor,
  create3DView,
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
  });

  it('builds a Jetson carrier with heatsink fins and the lab I/O cluster', () => {
    const component = {
      id: 'jetson',
      label: 'Jetson Orin Nano',
      kind: 'jetson' as const,
      dimensions: [100, 22, 79] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildJetson(THREE, component);
    expect(meshes.find((mesh) => mesh.name === 'jetson-pcb')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-heatsink')).toBeTruthy();
    expect(meshes.filter((mesh) => mesh.name === 'jetson-fin').length).toBeGreaterThan(4);
    expect(meshes.find((mesh) => mesh.name === 'jetson-usbc')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-usba')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-hdmi')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-rj45')).toBeTruthy();
  });

  it('builds a USB camera with CS ring on +X and tripod foot below the body', () => {
    const component = {
      id: 'cam',
      label: 'USB camera',
      kind: 'camera' as const,
      dimensions: [42, 38, 38] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildCamera(THREE, component);
    const ring = meshes.find((mesh) => mesh.name === 'camera-cs-ring')!;
    const tripod = meshes.find((mesh) => mesh.name === 'camera-tripod')!;
    expect(meshes.find((mesh) => mesh.name === 'camera-body')).toBeTruthy();
    expect(ring.position.x).toBeGreaterThan(0);
    expect(tripod.position.y).toBeLessThan(0);
  });

  it('builds a CS lens barrel along X with a front glass disk', () => {
    const component = {
      id: 'lens',
      label: 'Varifocal lens',
      kind: 'lens' as const,
      dimensions: [50, 36, 36] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildLens(THREE, component);
    const barrel = meshes.find((mesh) => mesh.name === 'lens-barrel')!;
    const glass = meshes.find((mesh) => mesh.name === 'lens-glass')!;
    expect(barrel.rotation.z).toBeCloseTo(Math.PI / 2);
    expect(glass.position.x).toBeGreaterThan(barrel.position.x);
  });

  it('builds an M.2 SSD with gold fingers on the -X edge', () => {
    const component = {
      id: 'ssd',
      label: 'NVMe',
      kind: 'ssd' as const,
      dimensions: [80, 2.4, 22] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildSsd(THREE, component);
    const gold = meshes.find((mesh) => mesh.name === 'ssd-gold')!;
    expect(meshes.find((mesh) => mesh.name === 'ssd-body')).toBeTruthy();
    expect(gold.position.x).toBeLessThan(0);
  });

  it('builds a standing HDMI panel with the screen on +Z', () => {
    const component = {
      id: 'display',
      label: 'Panel',
      kind: 'display' as const,
      dimensions: [165, 100, 8] as [number, number, number],
      position: [0, 0, 0] as [number, number, number],
      quantity: 1,
      pins: [],
    };
    const { meshes } = buildDisplay(THREE, component);
    const screen = meshes.find((mesh) => mesh.name === 'display-screen')!;
    expect(meshes.find((mesh) => mesh.name === 'display-bezel')).toBeTruthy();
    expect(screen.position.z).toBeGreaterThan(0);
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
