/** Physical coordinates and dimensions are millimetres; Y is up in 3D. */
export type Vec3 = [number, number, number];

/** Built-in 3D silhouettes shipped with the library. Third parties may register extra kinds. */
export const BUILTIN_MODEL_KINDS = [
  'board',
  'esp32',
  'hx711',
  'load-cell',
  'probe',
  'resistor',
  'power',
  'jetson',
  'camera',
  'lens',
  'ssd',
  'wifi',
  'display',
  'mount',
  'extrusion',
  'cover',
  'antenna',
] as const;

export type BuiltinModelKind = (typeof BUILTIN_MODEL_KINDS)[number];
/** Built-in kinds plus any kebab-case id a third party registers at runtime. */
export type ModelKind = BuiltinModelKind | (string & {});
export interface Pin { id: string; label?: string; side: 'left' | 'right'; position?: Vec3; voltage?: number; }
export interface Component {
  id: string; label: string; kind: ModelKind; group?: string; notes?: string;
  dimensions: Vec3; position: Vec3; schematic?: [number, number]; color?: string;
  pins: Pin[]; properties?: Record<string, string | number | boolean>;
  model?: { url: string; scale: number; rotation?: Vec3 };
  purchase?: { url: string; label?: string; partNumber?: string }; quantity: number;
}
export interface Wire {
  id: string; from: string; to: string; color: string; label?: string; net?: string;
  voltage?: number; lengthMm?: number; diameterMm?: number; gaugeAwg?: number;
  notes?: string; dashed?: boolean;
}
export interface Diagram {
  version: 1; title: string; description?: string;
  groups: { id: string; label: string; color?: string; notes?: string }[];
  components: Component[]; wires: Wire[]; notes: string[];
}
export interface ViewHandle { select(id: string | null): void; reset(): void; destroy(): void; }
export interface ViewCallbacks { onSelect(id: string | null): void; onHover(id: string | null): void; onError?(message: string): void; }
