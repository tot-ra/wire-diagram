# Wire Diagram

A framework-independent TypeScript library that turns a YAML wiring document into an interactive **SVG schematic + Three.js canvas**, with a compact inspector for selected parts. One validated pin-level graph drives both views. `getBom` remains available from the API.

<img width="1077" height="907" alt="Screenshot 2026-09-16 at 13 01 10" src="https://github.com/user-attachments/assets/c3860d62-6cd0-4beb-970a-a134e5b99d5b" />
<img width="1528" height="786" alt="Screenshot 2026-09-16 at 13 18 02" src="https://github.com/user-attachments/assets/38061b98-952f-4ab8-82a6-f13d15755f33" />


## Run the demo

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
# Open the printed local URL manually.
```

The demo includes an editable ESP32 + HX711 + load-cell + DS18B20 circuit in [`examples/beehive.yaml`](examples/beehive.yaml). Changes apply only after validation succeeds. No backend, API keys, or cloud service is needed. Supplier links open only when clicked; custom models are fetched when 3D is activated.

```sh
npm test          # Parser, SVG, widget integration and mocked 3D lifecycle tests
npm run build     # ESM library + CSS + TypeScript declarations in dist/
npm run build:demo # Standalone demo site in demo-dist/
npm pack          # Build and package locally; does not publish
```

## Plain HTML embedding

Copy **all** files from `dist/` into a public directory. Keep hashed lazy chunks beside the entry point. Serve over HTTP(S), not `file://`.

```html
<link rel="stylesheet" href="/assets/wire-diagram/wire-diagram.css">
<div id="wiring"></div>
<script type="module">
  import { createWiringDiagram } from '/assets/wire-diagram/wire-diagram.js';
  const response = await fetch('/assets/beehive.yaml');
  if (!response.ok) throw new Error(`Wiring source: HTTP ${response.status}`);
  const widget = createWiringDiagram(
    document.getElementById('wiring'),
    await response.text(),
    { view: '2d' }
  );
  // widget.select('hx-data');
  // await widget.setView('3d');
  // widget.update(nextYaml); // Invalid updates throw, leaving the previous diagram intact.
  // const standaloneSVG = widget.exportSVG();
  // widget.destroy(); // Call when unmounting an SPA component.
</script>
```

With a bundler and a locally installed package:

```ts
import { createWiringDiagram, parseDiagram, renderSVG, getBom } from 'wire-diagram';
import 'wire-diagram/style.css';

const diagram = parseDiagram(yamlText); // Also accepts plain JS objects.
const svg = renderSVG(diagram);        // No DOM/WebGL needed, usable on a server.
const parts = getBom(diagram);
const widget = createWiringDiagram(container, diagram);
```

This package has not been published to npm. Install the generated tarball or use a local file dependency. The build includes runtime dependencies and lazily loads Three.js only when 3D is requested. `setView('3d')` resolves when the view handle is created, not when GPU initialization or external models finish. Model/WebGL errors appear in the widget; the schematic remains available.

## Minimal document

```yaml
version: 1
title: A simple connection
components:
  - id: controller
    label: Controller
    kind: board
    dimensions: [40, 3, 25]
    pins:
      - { id: OUT, label: Signal, side: right, position: [20, 2, 0] }
  - id: sensor
    label: Sensor
    position: [90, 5, 0]
    pins:
      - { id: IN, label: Signal, side: left, position: [-20, 2, 0] }
wires:
  - id: data
    from: controller.OUT
    to: sensor.IN
    color: '#e78924'
    label: Data
    lengthMm: 150
    diameterMm: 1.6
    gaugeAwg: 26
```

See [format reference](docs/format.md), [decisions](docs/decisions.md).

## Included in 0.1

- YAML or JavaScript input with schema validation, duplicate/reference checks, safe URLs and bounded YAML aliases.
- SVG component boxes, explicit contacts, groups, colored/dashed wires, pan/zoom, keyboard selection, SVG export.
- Orbit/zoom 3D with wire hover/picking, component labels, pin markers, optional external GLB/glTF models, lazy loading and cleanup.
- Illustrative built-in ESP32, HX711, load-cell, probe, resistor, power and generic board models.
- Shared inspector, keyboard-accessible selection list and purchase links.
- Multiple independent instances and explicit `update` / `destroy` lifecycle.

## Accuracy and current limitations

**This is a visualization tool, not an electrical simulator or a verified assembly specification.** It validates the structure, not voltage compatibility, current capacity, circuit correctness, polarity or wire ampacity. Check your actual hardware and datasheets before powering it.

- Built-in models are illustrative, not verified manufacturing CAD. Dimensions control approximate body geometry; attached headers/USB sockets/leads can extend beyond the body dimensions. Board variants have different pinouts. Supply explicit pin positions and verified CAD for exact assembly.
- Basic grid placement and orthogonal routing are not a general obstacle-avoiding router. Dense diagrams may overlap or hide portions of routes behind other components. Use explicit `schematic` positions and inspect endpoint names. Crossing lines do not imply a connection; only shared endpoint references do.
- Physical wires are visual curves, not constrained to declared cut length, bend radius or collision avoidance. `lengthMm`, `gaugeAwg`, `voltage`, and `net` are metadata; `diameterMm` controls 3D thickness. `dashed` applies only to SVG. A shared `net` label does not electrically connect separate endpoints or highlight the entire net.
- A component quantity is a procurement count, not repeated physical instances. Use separate component IDs for separately wired parts. BOM lists components; wires/connectors/tools are not automatically aggregated.
- External models need correct origins, rotations, scale, and author-defined anchors. No STEP import, compressed model decoder setup, model catalog, or asset-license verification is included. Use plain GLB/glTF and trusted asset hosts with CORS.
- YAML is a new versioned format, not Mermaid or WireViz compatibility. Unknown fields are rejected; use `properties` for component metadata.
- Modern browsers with ES modules are required; 3D needs WebGL2. The SVG view works without WebGL. Tests mock GPU initialization; actual 3D appearance and browser interaction remain unverified after the user's request to stop browser checks.
- SVG uses embedded styles and the widget uses inline positioning/styles; restrictive CSP configurations need an explicit integration review. Serve user-supplied YAML only within appropriate size/resource limits and trust boundaries.

## License
MIT
