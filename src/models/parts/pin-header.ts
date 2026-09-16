import type { Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ThreeModule } from '../types.js';

/** 2.54 mm Dupont-style header shared by DevKit rails, Pi GPIO, Pico, and breakout pins. */
export const HEADER_PITCH_MM = 2.54;
export const HEADER_HEIGHT_MM = 8.4;
export const HEADER_SINK_MM = 0.2;
export const HEADER_PIN_PROUD_MM = 1.2;
export const HEADER_PIN_SIZE_MM = 0.64;
/** Female wells sit slightly through the housing top so they do not z-fight the plastic. */
const FEMALE_WELL_SINK_MM = 0.45;

export type HeaderAlong = 'x' | 'z';
export type HeaderContact = 'male' | 'female';
export type HeaderRows = 1 | 2;

export interface HeaderLook {
  housing: import('three').Material;
  pin: import('three').Material;
  well?: import('three').Material;
}

export interface AddPinHeaderOptions {
  columns: number;
  rows?: HeaderRows;
  pcbTopY: number;
  /** Footprint center. Y is ignored; height comes from pcbTopY and heightMm. */
  center: Vec3;
  along?: HeaderAlong;
  contact?: HeaderContact;
  heightMm?: number;
  namePrefix: string;
  housingName?: string;
  look?: HeaderLook;
  pinBottomY?: number;
  pinName?: (row: number, column: number) => string;
  pinUserData?: (row: number, column: number) => Record<string, unknown>;
}

export function createHeaderLook(THREE: ThreeModule): HeaderLook {
  return {
    // Metalness stays moderate: this scene has no environment map, so 0.9 silver/gold goes black.
    housing: new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.72, metalness: 0.04 }),
    pin: new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.32, metalness: 0.55 }),
    well: new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.78, metalness: 0.08 }),
  };
}

export function headerStart(columns: number, pitch = HEADER_PITCH_MM): number {
  return -((columns - 1) * pitch) / 2;
}

export function headerColumnOffset(index: number, columns: number, pitch = HEADER_PITCH_MM): number {
  const clamped = Math.max(0, Math.min(columns - 1, index));
  return headerStart(columns, pitch) + clamped * pitch;
}

export function headerSlotIndex(offset: number, columns: number, pitch = HEADER_PITCH_MM): number {
  return Math.max(0, Math.min(columns - 1, Math.round((offset - headerStart(columns, pitch)) / pitch)));
}

export function headerRowOffset(row: number, rows: HeaderRows, pitch = HEADER_PITCH_MM): number {
  if (rows === 1) return 0;
  return (row <= 0 ? -0.5 : 0.5) * pitch;
}

export function headerHousingTopY(pcbTopY: number, heightMm = HEADER_HEIGHT_MM): number {
  return pcbTopY - HEADER_SINK_MM + heightMm;
}

export function headerHousingCenterY(pcbTopY: number, heightMm = HEADER_HEIGHT_MM): number {
  return pcbTopY - HEADER_SINK_MM + heightMm / 2;
}

export function headerPinTipY(
  pcbTopY: number,
  contact: HeaderContact = 'male',
  heightMm = HEADER_HEIGHT_MM,
): number {
  const top = headerHousingTopY(pcbTopY, heightMm);
  return contact === 'female' ? top - FEMALE_WELL_SINK_MM : top + HEADER_PIN_PROUD_MM;
}

function pinPosition(
  center: Vec3,
  along: HeaderAlong,
  row: number,
  column: number,
  columns: number,
  rows: HeaderRows,
): { x: number; z: number } {
  const alongPos = headerColumnOffset(column, columns);
  const crossPos = headerRowOffset(row, rows);
  if (along === 'x') return { x: center[0] + alongPos, z: center[2] + crossPos };
  return { x: center[0] + crossPos, z: center[2] + alongPos };
}

export function addPinHeader(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  options: AddPinHeaderOptions,
): import('three').Mesh[] {
  const columns = Math.max(1, Math.floor(options.columns));
  const rows = options.rows ?? 1;
  const along = options.along ?? 'x';
  const contact = options.contact ?? 'male';
  const heightMm = options.heightMm ?? HEADER_HEIGHT_MM;
  const look = options.look ?? createHeaderLook(THREE);
  const created: import('three').Mesh[] = [];
  const length = columns * HEADER_PITCH_MM;
  const width = rows * HEADER_PITCH_MM;
  const housingSize: Vec3 =
    along === 'x' ? [length, heightMm, width] : [width, heightMm, length];
  const housingY = headerHousingCenterY(options.pcbTopY, heightMm);
  const housing = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(housingSize[0], housingSize[1], housingSize[2]),
    look.housing,
    [options.center[0], housingY, options.center[2]],
  );
  housing.name = options.housingName ?? `${options.namePrefix}-housing`;
  housing.userData = { kind: `${options.namePrefix}-housing`, columns, rows, contact };
  meshes.push(housing);
  created.push(housing);

  const pinTop = headerPinTipY(options.pcbTopY, contact, heightMm);
  const pinBottom = options.pinBottomY ?? -Math.abs(options.pcbTopY) - 0.5;
  const pinHeight = Math.max(pinTop - pinBottom, HEADER_PIN_SIZE_MM);
  const pinCenterY = (pinTop + pinBottom) / 2;
  const wellMat = look.well ?? look.housing;
  const housingTop = headerHousingTopY(options.pcbTopY, heightMm);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const { x, z } = pinPosition(options.center, along, row, column, columns, rows);
      const pin = addMesh(
        THREE,
        group,
        new THREE.BoxGeometry(HEADER_PIN_SIZE_MM, pinHeight, HEADER_PIN_SIZE_MM),
        look.pin,
        [x, pinCenterY, z],
      );
      pin.name = options.pinName?.(row, column) ?? `${options.namePrefix}-pin:${row}:${column}`;
      pin.userData = options.pinUserData?.(row, column) ?? {
        kind: `${options.namePrefix}-pin`,
        row,
        column,
      };
      meshes.push(pin);
      created.push(pin);

      if (contact !== 'female') continue;
      // WHY: female GPIO reads as a hole grid; the well crosses the housing top to avoid shadow acne.
      const well = addMesh(
        THREE,
        group,
        new THREE.BoxGeometry(1.15, 0.8, 1.15),
        wellMat,
        [x, housingTop - 0.25, z],
      );
      well.name = `${options.namePrefix}-well:${row}:${column}`;
      well.userData = { kind: `${options.namePrefix}-well`, row, column };
      meshes.push(well);
      created.push(well);
    }
  }

  return created;
}
