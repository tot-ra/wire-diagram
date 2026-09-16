# Wiring document format v1

YAML input is converted into the `Diagram` type in `src/types.ts`. `parseDiagram` accepts YAML text or an object, applies defaults and validates references. Errors are `DiagramParseError` with a field path where possible. Unknown keys are rejected to catch typos. Colors must be quoted six-digit hex strings, e.g. `'#cf3740'`.

## Document

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | `1` | Required format version |
| `title` | string | Required nonempty title |
| `description` | string | Optional subtitle |
| `components` | array | Components, default `[]` |
| `wires` | array | Wires, default `[]` |
| `groups` | array | `{id, label, color?, notes?}`, default `[]` |
| `notes` | string[] | Assembly notes, default `[]` |

## Components

Required: `id` and `label`. Component and wire IDs share one namespace. IDs and pin IDs may not contain dots, which separate endpoints. Pin IDs such as `E+` and `E-` are supported.

| Field | Default | Meaning |
| --- | --- | --- |
| `kind` | `board` | Built-in: `board`, `esp32`, `hx711`, `load-cell`, `probe`, `resistor`, `power`, `jetson`, `camera`, `lens`, `ssd`, `wifi`, `display`, `mount`, `extrusion`, `cover`, `antenna`. Any other lowercase kebab-case id is valid YAML; 3D uses a registered model or the generic board fallback. |
| `pins` | `[]` | Contact definitions below |
| `dimensions` | `[40, 3, 25]` | Approximate body width X, height Y, depth Z in mm; positive finite numbers |
| `position` | grid | Component origin `[x,y,z]` in mm, Y up |
| `schematic` | grid | Independent SVG top-left `[x,y]`; negative coordinates supported |
| `color` | renderer default | SVG box color; some built-in models have their own material colors |
| `group` | none | Existing group ID |
| `notes` | none | Component instructions in inspector |
| `properties` | none | Custom mapping of strings to string/number/boolean |
| `quantity` | `1` | Positive integer for procurement, not repeated visual instances |
| `purchase` | none | `{url, label?, partNumber?}`; http(s) only |
| `model` | none | External model descriptor below |

Pins require `id`. Optional fields: `label`, `side` (`left` by default or `right`), `position` (local `[x,y,z]` in mm), `voltage` (nominal metadata). Pin ordering follows document order on each side. When omitted, physical anchors are placed at the left/right body edge and spread over depth, except `kind: esp32`, which defaults to a 19-pin 2.54 mm dual header on the long edges (schematic left -> +Z, right -> -Z). These defaults are not verified hardware pinouts.

## Wires and junctions

Required: `id`, `from`, `to`, with endpoints in `componentId.pinId` form. Both contacts must exist.

Optional: `color` (default `#475569`), `label`, `net`, `voltage`, positive `lengthMm`, positive `diameterMm`, integer `gaugeAwg` (0-40), `notes`, boolean `dashed`.

Multiple wires referencing the **same contact** share a junction. Other crossings are not junctions. `net` is descriptive metadata only. Model branches by reusing contacts, or add an explicit connector/terminal component for a physical splice. A resistor must be a two-pin component; connecting its pins by a wire bypasses it. Colors and notes do not establish connectivity.

## External models

```yaml
model:
  url: /assets/models/esp32.glb
  scale: 1000
  rotation: [0, 1.57079632679, 0]
```

- Prefer self-contained uncompressed GLB. glTF with relative textures/buffers is also supported. URL may be safe relative or http(s); protocol-relative URLs, backslashes and executable/data schemes are rejected.
- `scale` is required, positive, and converts model units to millimetres. For a metre-unit glTF, use `1000`. `rotation` is XYZ Euler rotation in radians.
- The glTF origin is placed at the component origin. There is no automatic recentering or scaling to `dimensions`.
- Pin coordinates must already be expressed in the **post-scale, post-rotation component-local frame**. Model transforms apply to the mesh only, not the pin definitions. Component `position` is then added to both.
- Failure keeps the built-in fallback and shows a status message. Authors must verify mesh provenance, license, size, alignment and pin coordinates.

## Custom 3D models (code)

Built-in silhouettes live under `src/models/builtin/`. Third parties add their own files and register them. Registration is last-write-wins. Widget-local `models` win over the global registry for that widget only.

```ts
import { addMesh, createWiringDiagram, registerModel } from 'wire-diagram';
import type { ModelDefinition } from 'wire-diagram';
import 'wire-diagram/style.css';

const loadCell20kg: ModelDefinition = {
  kind: 'custom-cell',
  hidePinMarkers: true,
  build(THREE, component) {
    const group = new THREE.Group();
    const body = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(...component.dimensions),
      new THREE.MeshStandardMaterial({ color: '#c5ccd3', metalness: 0.85, roughness: 0.28 }),
    );
    body.name = 'custom-cell-body';
    return { group, meshes: [body] };
  },
  resolvePinPosition(component, pin, { index, count }) {
    const x = pin.side === 'left' ? -component.dimensions[0] / 2 : component.dimensions[0] / 2;
    return [x, component.dimensions[1] / 2, ((index + 1) / (count + 1) - 0.5) * component.dimensions[2]];
  },
};

registerModel(loadCell20kg);

const widget = createWiringDiagram(container, yamlText, {
  view: '3d',
  models: [loadCell20kg], // optional; scoped to this widget
});
```

Call `registerModel` before the first 3D view if you replace a built-in kind. The 3D chunk will not overwrite an already registered kind. Unknown kinds still parse and fall back to the generic board silhouette.

`addMesh` applies shadow flags and optional local position/rotation. Coordinates stay millimetres, Y up. Pin markers are skipped when `hidePinMarkers` is true.

## Demo electrical decisions

The Gratheon reference uses 5 V HX711 supply. This demo deliberately uses 3.3 V supply for HX711 and DS18B20, with an explicit warning to verify the exact module. ESP32 GPIO is not 5 V tolerant. This does not guarantee every HX711 breakout operates correctly at 3.3 V.

USB VBUS/GND depict the USB cable conductors, not instructions to connect a second external supply in parallel with USB. All grounds share the ESP32 GND endpoint. The pull-up is an actual component between 3.3 V and the DQ junction, not a direct short. Load-cell colors are illustrative and must be checked against the manufacturer's datasheet.
