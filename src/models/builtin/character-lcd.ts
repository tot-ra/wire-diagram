import type { Component, Pin, Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import {
  addPinHeader,
  HEADER_PITCH_MM,
  headerColumnOffset,
  headerPinTipY,
} from '../parts/pin-header.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

const I2C_PINS = ['GND', 'VCC', 'SDA', 'SCL'] as const;
const I2C_HEADER_HEIGHT_MM = 3.2;
/** Moderate metalness: this scene has no environment map, so 0.8 silver reads black. */
const CAN_METALNESS = 0.4;

export interface CharacterLcdSpec {
  kind: string;
  columns: number;
  rows: number;
  /** Viewing-area width in mm at `referenceW`. */
  windowWMm: number;
  /** Window width / depth. 1602 is ~4:1; 2004 is ~3:1. */
  windowAspect: number;
  referenceW: number;
  /** Fraction of can width used by the glass, before the datasheet cap. */
  canWindowScale: number;
}

interface LcdLayout {
  w: number;
  h: number;
  d: number;
  pcbH: number;
  pcbBottomY: number;
  pcbTopY: number;
  pcbCenterY: number;
  canH: number;
  canW: number;
  canD: number;
  canY: number;
  canZ: number;
  canTop: number;
  windowW: number;
  windowD: number;
  packH: number;
  packW: number;
  packD: number;
  packY: number;
  packZ: number;
  packTopY: number;
  i2cCenter: Vec3;
}

function layoutFor(component: Component, spec: CharacterLcdSpec): LcdLayout {
  const [w, h, d] = component.dimensions;
  const pcbH = Math.max(h * 0.14, 1.6);
  const pcbBottomY = -h / 2;
  const pcbTopY = pcbBottomY + pcbH;
  const headerStrip = 7.2;
  const canH = Math.max(h * 0.42, 5.6);
  const canW = w * 0.86;
  const canD = Math.max(d - headerStrip - 1.2, d * 0.58);
  const canZ = -d / 2 + 1.05 + canD / 2;
  const canY = pcbTopY + canH / 2;
  const canTop = pcbTopY + canH;
  const windowW = Math.min(canW * spec.canWindowScale, spec.windowWMm * (w / spec.referenceW));
  const windowD = windowW / spec.windowAspect;
  const packH = 1.5;
  const packW = Math.min(42, w * 0.55);
  const packD = 16;
  // WHY: backpack peeks past +Z so the 4-pin header and contrast pot stay in the gallery camera.
  const packZ = d / 2 - 1.2;
  const packTopY = pcbBottomY - 2.7;
  const packY = packTopY - packH / 2;
  const i2cCenter: Vec3 = [w * 0.1, 0, packZ + packD / 2 - HEADER_PITCH_MM / 2];
  return {
    w,
    h,
    d,
    pcbH,
    pcbBottomY,
    pcbTopY,
    pcbCenterY: pcbBottomY + pcbH / 2,
    canH,
    canW,
    canD,
    canY,
    canZ,
    canTop,
    windowW,
    windowD,
    packH,
    packW,
    packD,
    packY,
    packZ,
    packTopY,
    i2cCenter,
  };
}

function i2cColumn(pin: Pin): number {
  const id = pin.id.trim().toUpperCase();
  const index = (I2C_PINS as readonly string[]).indexOf(id);
  return index >= 0 ? index : 0;
}

function addWindowFrame(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  layout: LcdLayout,
  railY: number,
  railH: number,
  kind: string,
): void {
  const { canZ, windowW, windowD } = layout;
  const plastic = new THREE.MeshStandardMaterial({ color: '#141618', roughness: 0.62, metalness: 0.06 });
  // Leave a silver can lip around the black mask; full-width rails hide the metal from +Y.
  const railX = 4.0;
  const railZ = 3.6;
  const longW = windowW + railX * 2;
  const sides = [
    { name: 'n', size: [longW, railH, railZ] as Vec3, pos: [0, railY, canZ + windowD / 2 + railZ / 2] as Vec3 },
    { name: 's', size: [longW, railH, railZ] as Vec3, pos: [0, railY, canZ - windowD / 2 - railZ / 2] as Vec3 },
    { name: 'w', size: [railX, railH, windowD] as Vec3, pos: [-windowW / 2 - railX / 2, railY, canZ] as Vec3 },
    { name: 'e', size: [railX, railH, windowD] as Vec3, pos: [windowW / 2 + railX / 2, railY, canZ] as Vec3 },
  ];
  for (const rail of sides) {
    const mesh = addMesh(THREE, group, new THREE.BoxGeometry(...rail.size), plastic, rail.pos);
    mesh.name = `${kind}-bezel:${rail.name}`;
    meshes.push(mesh);
  }
}

/**
 * HD44780-style character LCD with a PCF8574 I2C backpack.
 * Lies flat (Y is thickness) with the glass on +Y, unlike the standing HDMI kind: display.
 */
export function createCharacterLcdModel(spec: CharacterLcdSpec): {
  build: (THREE: ThreeModule, component: Component) => { group: import('three').Group; meshes: import('three').Mesh[] };
  resolvePinPosition: (component: Component, pin: Pin) => Vec3;
  model: ModelDefinition;
} {
  const { kind, columns, rows } = spec;

  function resolvePinPosition(component: Component, pin: Pin): Vec3 {
    const layout = layoutFor(component, spec);
    const { i2cCenter, packTopY } = layout;
    return [
      i2cCenter[0] + headerColumnOffset(i2cColumn(pin), I2C_PINS.length),
      headerPinTipY(packTopY, 'male', I2C_HEADER_HEIGHT_MM),
      i2cCenter[2],
    ];
  }

  function build(
    THREE: ThreeModule,
    component: Component,
  ): { group: import('three').Group; meshes: import('three').Mesh[] } {
    const group = new THREE.Group();
    const meshes: import('three').Mesh[] = [];
    const layout = layoutFor(component, spec);
    const {
      w,
      d,
      pcbH,
      pcbBottomY,
      pcbTopY,
      pcbCenterY,
      canH,
      canW,
      canD,
      canY,
      canZ,
      canTop,
      windowW,
      windowD,
      packH,
      packW,
      packD,
      packY,
      packZ,
      packTopY,
      i2cCenter,
    } = layout;

    const pcb = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(w, pcbH, d),
      new THREE.MeshStandardMaterial({ color: '#1f6b42', roughness: 0.58, metalness: 0.1 }),
      [0, pcbCenterY, 0],
    );
    pcb.name = `${kind}-pcb`;
    meshes.push(pcb);

    const holeR = 1.15;
    const holeInsetX = 2.6;
    const holeInsetZ = 2.5;
    for (const [hx, hz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const hole = addMesh(
        THREE,
        group,
        new THREE.CylinderGeometry(holeR, holeR, pcbH + 0.45, 12),
        new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7, metalness: 0.08 }),
        [hx * (w / 2 - holeInsetX), pcbCenterY, hz * (d / 2 - holeInsetZ)],
      );
      hole.name = `${kind}-hole`;
      meshes.push(hole);
    }

    const can = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(canW, canH, canD),
      new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.36, metalness: CAN_METALNESS }),
      [0, canY, canZ],
    );
    can.name = `${kind}-can`;
    meshes.push(can);

    const glassT = 1.2;
    // WHY: glass must cross the can top so it does not z-fight; the black rails sit higher so it reads recessed.
    const glass = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(windowW, glassT, windowD),
      new THREE.MeshStandardMaterial({
        color: '#8fbf3a',
        roughness: 0.18,
        metalness: 0.06,
        emissive: '#5a8a22',
        emissiveIntensity: 0.38,
      }),
      [0, canTop + glassT * 0.18, canZ],
    );
    glass.name = `${kind}-glass`;
    meshes.push(glass);

    const railH = 1.7;
    const glassTop = glass.position.y + glassT / 2;
    const railY = glassTop - railH / 2 + 0.55;
    addWindowFrame(THREE, group, meshes, layout, railY, railH, kind);

    const cellW = (windowW / columns) * 0.84;
    const cellD = (windowD / rows) * 0.74;
    const pitchX = windowW / columns;
    const pitchZ = windowD / rows;
    const cellH = 0.28;
    const cellY = glass.position.y + glassT / 2 + cellH / 2 + 0.08;
    const cellMat = new THREE.MeshStandardMaterial({
      color: '#243218',
      roughness: 0.45,
      metalness: 0.04,
      emissive: '#1a2810',
      emissiveIntensity: 0.12,
    });
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const cell = addMesh(
          THREE,
          group,
          new THREE.BoxGeometry(cellW, cellH, cellD),
          cellMat,
          [
            -windowW / 2 + pitchX * (col + 0.5),
            cellY,
            canZ + windowD / 2 - pitchZ * (row + 0.5),
          ],
        );
        cell.name = `${kind}-cell:${row}:${col}`;
        meshes.push(cell);
      }
    }

    // Hidden 16-pin sandwich between LCD and backpack. A full pin header here reads as a
    // gold comb in the +Z gallery camera; the visible connector is the 4-pin I2C header.
    const sandwichH = Math.max(pcbBottomY - packTopY, 2.2);
    const header = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(Math.min(41, w * 0.52), sandwichH, 2.6),
      new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.7, metalness: 0.05 }),
      [0, packTopY + sandwichH / 2, d / 2 - 3.2],
    );
    header.name = `${kind}-header`;
    meshes.push(header);

    const pack = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(packW, packH, packD),
      new THREE.MeshStandardMaterial({ color: '#1f6b42', roughness: 0.55, metalness: 0.1 }),
      [0, packY, packZ],
    );
    pack.name = `${kind}-backpack`;
    meshes.push(pack);

    const chip = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(10, 0.8, 6),
      new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.42, metalness: 0.18 }),
      [-packW * 0.12, packY - packH / 2 - 0.4, packZ - 2],
    );
    chip.name = `${kind}-chip`;
    meshes.push(chip);

    const pot = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(6.2, 4.2, 6.2),
      new THREE.MeshStandardMaterial({ color: '#2c4fa0', roughness: 0.42, metalness: 0.08 }),
      [-packW * 0.22, packTopY + 2.1, packZ + packD * 0.28],
    );
    pot.name = `${kind}-trimmer`;
    meshes.push(pot);

    const screw = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(1.15, 1.15, 0.55, 10),
      new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.35, metalness: 0.45 }),
      [pot.position.x, pot.position.y + 2.2, pot.position.z],
    );
    screw.name = `${kind}-trimmer-screw`;
    meshes.push(screw);

    addPinHeader(THREE, group, meshes, {
      columns: I2C_PINS.length,
      rows: 1,
      along: 'x',
      contact: 'male',
      heightMm: I2C_HEADER_HEIGHT_MM,
      pcbTopY: packTopY,
      center: i2cCenter,
      namePrefix: `${kind}-i2c`,
      housingName: `${kind}-i2c`,
    });

    return { group, meshes };
  }

  return {
    build,
    resolvePinPosition,
    model: {
      kind,
      build,
      resolvePinPosition,
      hidePinMarkers: true,
    },
  };
}
