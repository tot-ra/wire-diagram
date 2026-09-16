// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import * as THREE from 'three';
import { parseDiagram } from '../src/parser.js';
import {
  buildProbe,
  buildResistor,
  create3DView,
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
});
