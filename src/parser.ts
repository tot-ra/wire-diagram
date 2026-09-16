import YAML from 'yaml';
import { z } from 'zod';
import type { Component, Diagram, ModelKind, Vec3 } from './types.js';

const MAX_YAML_ALIASES = 64;
const DEFAULT_DIMENSIONS: Vec3 = [40, 3, 25];
const DEFAULT_WIRE_COLOR = '#475569';
const GRID_COLS = 3;
const GRID_SPACING_X = 90;
const GRID_SPACING_Z = 70;

const MODEL_KINDS = [
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

export class DiagramParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagramParseError';
  }
}

const finite = z.number().finite();
const finitePositive = finite.positive();

const componentId = z
  .string()
  .min(1)
  .refine((id) => !id.includes('.'), { message: 'Component id must not contain dots' });

const pinId = componentId;
// Hex colors behave identically in SVG, CSS and Three.js, and cannot reference external paint servers.
const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Color must be six-digit hex, for example #cf3740');

const vec3Positive = z.tuple([finitePositive, finitePositive, finitePositive]);
const vec3 = z.tuple([finite, finite, finite]);
const schematicPoint = z.tuple([finite, finite]);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeModelUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\\')) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('javascript:')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return lower.startsWith('http://') || lower.startsWith('https://');
  }
  if (trimmed.startsWith('//')) return false;
  return /^[\w./-]+$/.test(trimmed);
}

const purchaseSchema = z.strictObject({
  url: z.string().refine(isHttpUrl, { message: 'Purchase URL must use http or https' }),
  label: z.string().optional(),
  partNumber: z.string().optional(),
});

const modelSchema = z.strictObject({
  url: z.string().refine(isSafeModelUrl, { message: 'Model URL must be a safe http(s) or relative path' }),
  scale: finitePositive,
  rotation: vec3.optional(),
});

const pinInputSchema = z.strictObject({
  id: pinId,
  label: z.string().optional(),
  side: z.enum(['left', 'right']).optional(),
  position: vec3.optional(),
  voltage: finite.optional(),
});

const componentInputSchema = z.strictObject({
  id: componentId,
  label: z.string().min(1),
  kind: z.enum(MODEL_KINDS).optional(),
  group: z.string().optional(),
  notes: z.string().optional(),
  dimensions: vec3Positive.optional(),
  position: vec3.optional(),
  schematic: schematicPoint.optional(),
  color: color.optional(),
  pins: z.array(pinInputSchema).default([]),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  model: modelSchema.optional(),
  purchase: purchaseSchema.optional(),
  quantity: finitePositive.int().optional(),
});

const wireInputSchema = z.strictObject({
  id: componentId,
  from: z.string().min(1),
  to: z.string().min(1),
  color: color.optional(),
  label: z.string().optional(),
  net: z.string().optional(),
  voltage: finite.optional(),
  lengthMm: finitePositive.optional(),
  diameterMm: finitePositive.optional(),
  gaugeAwg: finite.int().min(0).max(40).optional(),
  notes: z.string().optional(),
  dashed: z.boolean().optional(),
});

const groupInputSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  color: color.optional(),
  notes: z.string().optional(),
});

const diagramInputSchema = z.strictObject({
  version: z.literal(1),
  title: z.string().min(1),
  description: z.string().optional(),
  groups: z.array(groupInputSchema).optional(),
  components: z.array(componentInputSchema).default([]),
  wires: z.array(wireInputSchema).default([]),
  notes: z.array(z.string()).optional(),
});

function defaultPosition(index: number): Vec3 {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return [col * GRID_SPACING_X, 0, row * GRID_SPACING_Z];
}

function parseEndpoint(ref: string): { componentId: string; pinId: string } | null {
  const dot = ref.lastIndexOf('.');
  if (dot <= 0 || dot === ref.length - 1) return null;
  return { componentId: ref.slice(0, dot), pinId: ref.slice(dot + 1) };
}

function assertCrossFieldRules(input: z.infer<typeof diagramInputSchema>): void {
  const entityIds = new Set<string>();
  for (const component of input.components) {
    if (entityIds.has(component.id)) {
      throw new DiagramParseError(`Duplicate id: ${component.id}`);
    }
    entityIds.add(component.id);

    const pinIds = new Set<string>();
    for (const pin of component.pins) {
      if (pinIds.has(pin.id)) {
        throw new DiagramParseError(`Duplicate pin id ${pin.id} on component ${component.id}`);
      }
      pinIds.add(pin.id);
    }
  }

  for (const wire of input.wires) {
    if (entityIds.has(wire.id)) {
      throw new DiagramParseError(`Duplicate id: ${wire.id}`);
    }
    entityIds.add(wire.id);
  }

  const groupIds = new Set<string>();
  for (const group of input.groups ?? []) {
    if (groupIds.has(group.id)) {
      throw new DiagramParseError(`Duplicate group id: ${group.id}`);
    }
    groupIds.add(group.id);
  }

  const componentById = new Map(input.components.map((c) => [c.id, c]));

  for (const component of input.components) {
    if (component.group && !groupIds.has(component.group)) {
      throw new DiagramParseError(`Unknown group ${component.group} referenced by component ${component.id}`);
    }
  }

  for (const wire of input.wires) {
    for (const endpoint of [wire.from, wire.to]) {
      const parsed = parseEndpoint(endpoint);
      if (!parsed) {
        throw new DiagramParseError(`Invalid wire endpoint ${endpoint}`);
      }
      const component = componentById.get(parsed.componentId);
      if (!component) {
        throw new DiagramParseError(`Unknown component in endpoint ${endpoint}`);
      }
      if (!component.pins.some((pin) => pin.id === parsed.pinId)) {
        throw new DiagramParseError(`Unknown pin in endpoint ${endpoint}`);
      }
    }
  }
}

function normalizeDiagram(input: z.infer<typeof diagramInputSchema>): Diagram {
  assertCrossFieldRules(input);

  const components: Component[] = input.components.map((component, index) => ({
    id: component.id,
    label: component.label,
    kind: (component.kind ?? 'board') as ModelKind,
    group: component.group,
    notes: component.notes,
    dimensions: component.dimensions ?? [...DEFAULT_DIMENSIONS],
    position: component.position ?? defaultPosition(index),
    schematic: component.schematic,
    color: component.color,
    pins: component.pins.map((pin) => ({
      id: pin.id,
      label: pin.label,
      side: pin.side ?? 'left',
      position: pin.position,
      voltage: pin.voltage,
    })),
    properties: component.properties as Record<string, string | number | boolean> | undefined,
    model: component.model,
    purchase: component.purchase,
    quantity: component.quantity ?? 1,
  }));

  const wires = input.wires.map((wire) => ({
    id: wire.id,
    from: wire.from,
    to: wire.to,
    color: wire.color ?? DEFAULT_WIRE_COLOR,
    label: wire.label,
    net: wire.net,
    voltage: wire.voltage,
    lengthMm: wire.lengthMm,
    diameterMm: wire.diameterMm,
    gaugeAwg: wire.gaugeAwg,
    notes: wire.notes,
    dashed: wire.dashed,
  }));

  return {
    version: 1,
    title: input.title,
    description: input.description,
    groups: input.groups ?? [],
    components,
    wires,
    notes: input.notes ?? [],
  };
}

function parseYamlDocument(source: string): unknown {
  try {
    return YAML.parse(source, { maxAliasCount: MAX_YAML_ALIASES });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/alias/i.test(message)) {
      throw new DiagramParseError('YAML alias limit exceeded');
    }
    throw new DiagramParseError(`Invalid YAML: ${message}`);
  }
}

function parseRaw(source: unknown): Diagram {
  const result = diagramInputSchema.safeParse(source);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
    throw new DiagramParseError(`${path}${issue.message}`);
  }
  return normalizeDiagram(result.data);
}

export function parseDiagram(source: unknown): Diagram {
  if (typeof source === 'string') {
    return parseRaw(parseYamlDocument(source));
  }
  return parseRaw(source);
}

export interface BomLine {
  componentId: string;
  label: string;
  kind: ModelKind;
  quantity: number;
  partNumber?: string;
  purchaseUrl?: string;
  purchaseLabel?: string;
  group?: string;
}

export function getBom(diagram: Diagram): BomLine[] {
  return diagram.components.map((component) => ({
    componentId: component.id,
    label: component.label,
    kind: component.kind,
    quantity: component.quantity,
    partNumber: component.purchase?.partNumber,
    purchaseUrl: component.purchase?.url,
    purchaseLabel: component.purchase?.label,
    group: component.group,
  }));
}
