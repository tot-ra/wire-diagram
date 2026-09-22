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
| `kind` | `board` | Built-in: `board`, `esp32`, `hx711`, `load-cell`, `probe`, `resistor`, `power`, `max4466`, `max9814`, `ds18b20`, `lcd1602`, `lcd2004`, `raspberry-pi`, `jetson-nano`, `jetson-orin-nano`, `barrel-jack`, `jst-connector`, `stepper-motor`, `stepper-driver`, `led`, `status-led`, `arduino-uno`. Any other lowercase kebab-case id is valid YAML; 3D uses a registered model or the generic board fallback. `esp32` is a 38-pin USB-C ESP32-WROOM-32 DevKit clone (dual 19-pin males, EN/BOOT, CH340, AMS1117). `raspberry-pi` uses `properties.variant` (`4`, `5`, `zero`, `pico`). Pi 4 is the 85 x 56 mm Model B silhouette (USB-C, dual micro-HDMI, TRRS, stacked USB-A, magjack). Waterproof DS18B20 is `probe`; the 3-pin PCB module is `ds18b20`. Character LCDs (`lcd1602`, `lcd2004`) are flat I2C modules with glass on +Y. Other product silhouettes such as USB camera, HDMI panel, extrusion and cover are registered by the host with `registerModel` or widget `models`. `arduino-uno` is the UNO R3 development board (USB-B, DC jack, DIP ATmega328P, female headers). |
| `pins` | `[]` | Contact definitions below; referenced builtin contacts are created automatically |
| `pinout` | inferred from kind/variant | Explicit pinout profile, see below |
| `dimensions` | board profile, otherwise `[40, 3, 25]` | Approximate body width X, height Y, depth Z in mm; positive finite numbers |
| `position` | grid | Component origin `[x,y,z]` in mm, Y up |
| `schematic` | grid | Independent SVG top-left `[x,y]`; negative coordinates supported |
| `color` | renderer default | SVG box color; some built-in models have their own material colors |
| `group` | none | Existing group ID |
| `notes` | none | Component instructions in inspector |
| `properties` | none | Custom mapping of strings to string/number/boolean |
| `quantity` | `1` | Positive integer for procurement, not repeated visual instances |
| `purchase` | none | `{url, label?, partNumber?}`; http(s) only |
| `model` | none | External model descriptor below |

Pins require a string `id`. Optional fields: `label`, `number` (positive integer physical contact), `gpio` (nonnegative integer), `side` (schematic `left`/`right`), `position` (local `[x,y,z]` in mm), `voltage` (nominal metadata). Quote numeric IDs, e.g. `id: '7'`. Numeric *metadata* is unquoted: `number: 7`.

### Physical numbers and GPIO

For a supported board, use `board.PIN7` or `board.7` for physical contact 7, and `board.GPIO4` for GPIO4. `GP4` / `IO4` also address GPIO; `BCM4` is accepted only on BCM profiles. They are not interchangeable numbers: Raspberry Pi `PIN7` is `GPIO4`, while `PIN4` is 5 V. Only referenced pins are created automatically, avoiding an enormous schematic when only two contacts are wired. Explicit `pins` lists can expose extra contacts.

```yaml
components:
  - id: pi
    label: Raspberry Pi 4
    kind: raspberry-pi
    properties: { variant: '4' }
  - id: esp
    label: ESP32 DevKit
    kind: esp32
    pins:
      - { id: sensor, number: 27, gpio: 16, label: Sensor data }
wires:
  - { id: signal, from: pi.PIN7, to: esp.GPIO16 }
```

Both fields are optional, but when supplied together must identify the same contact. Existing named IDs are preserved: `esp.sensor`, `esp.PIN27`, `esp.27` and `esp.GPIO16` normalize to `esp.sensor`. The parser returns canonical wire endpoints, so aliases share one junction in both SVG and 3D. Re-parsing a normalized `Diagram` is supported. Invalid GPIOs, physical numbers, conflicting identities and duplicate definitions of a physical contact are errors. Define one contact and reference it multiple times instead.

| Kind / variant | Pinout profile | Numbering / default dimensions |
| --- | --- | --- |
| `esp32` | `esp32-devkit-38` | WROOM 38-pin DevKitC-compatible dual headers, GPIO numbers; `[52,3,28]` |
| `raspberry-pi`, variant `4`/`5`/`zero` | `raspberry-pi-40` | Physical 1-40 / BCM GPIO; `[85,18,56]`, Zero `[65,3,30]` |
| `raspberry-pi`, variant `pico` | `raspberry-pi-pico` | Physical 1-40 / RP2040 GPIO; `[51,3,21]` |
| `jetson-nano` | `jetson-nano` | Nano developer carrier 40-pin header / **Jetson.GPIO BCM mode**; `[100,18,80]` |
| `jetson-orin-nano` | `jetson-orin-nano` | Orin Nano developer carrier 40-pin header / **Jetson.GPIO BCM mode**; `[100,18,79]` |

`pinout` can be explicit; a profile incompatible with a built-in kind/variant is rejected. ESP32 defaults to the existing 38-pin WROOM silhouette, not a 30-pin, S2, S3 or C3 board. Pi model variants use the existing `properties.variant` selection (unknown variants retain the historical Pi 4 fallback).

**ESP32 physical numbering convention:** unified library numbers 1-19 are DevKitC J2.1-J2.19, from antenna to USB on -Z; 20-38 are J3.19-J3.1, from USB to antenna on +Z. This is not the ESP32 chip/module pad numbering, and clone silkscreens may differ. GPIO16 = pin 27, GPIO17 = pin 28, GPIO4 = pin 26, 3V3 = pin 1, 5V/VIN = pin 19. Pins GPIO6-11 normally connect to flash; showing them is not a recommendation to use them.

**Pi/Pico orientation:** Pi 40-pin headers have odd contacts on +Z, even contacts on the inner row, pin 1 at the -X end. Pico pins 1-20 run USB to far end on -Z, pins 21-40 run back on +Z; e.g. GPIO0 = pin 1, GPIO28 = pin 34. Physical contact selection never depends on schematic `side` or the order/subset of declared pins.

**Jetson:** GPIO4/BCM4 = physical pin 7 on both carriers. This API does **not** use Tegra CVM labels such as `GPIO09`, Linux GPIO line offsets, or TEGRA_SOC IDs. Special-purpose I2C/UART contacts not exposed as GPIO by Jetson.GPIO are addressed by physical number or signal name, not invented GPIO numbers. Header function/pinmux configuration and logic compatibility are not validated. Orin Nano USB-C is data/recovery only; `POWER`, `DC`, `BARREL`, `VIN` refer to its DC input. Use `PIN2` or `5V` for the header rail instead. Legacy custom `kind: jetson` remains a host extension; select the explicit new kinds for builtin models.

For repeated rails, unqualified `GND`, `3V3` or `5V` defaults to the first matching physical contact. Select the exact one with `PIN9` or `{id: GND, number: 9}`. Ground pins 6 and 9 remain separate physical contacts, even though they are electrically common. Known signal/rail names cannot be reassigned to a different signal, but equivalent rail contacts are allowed.

**3D precedence:** explicit `pin.position` always wins, including on custom GLB/glTF or registered models. Otherwise model resolvers use the physical number to attach the wire to the gold contact tip. Old named/custom contacts without a mapped identity retain the model-specific fallback placement. `side` only affects SVG. `getPinout(component)` exposes the full contact map, and `resolvePhysicalPinNumber(component, pin)` is exported for host model resolvers. A host model can opt into a profile via `pinout` and implement `resolvePinPosition`; custom numbered contacts without a profile require explicit positions. Registration alone does not change parser pinouts.

Models and mappings are illustrative, not verified assembly CAD. Verify your exact carrier/module revision before powering anything. Mapping references: [Espressif DevKitC J2/J3 tables](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html), [Raspberry Pi GPIO](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio), [Pico pinout](https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf), [NVIDIA Jetson.GPIO numbering tables](https://github.com/NVIDIA/jetson-gpio/blob/master/lib/python/Jetson/GPIO/gpio_pin_data.py).

See [`examples/numbered-pins.yaml`](../examples/numbered-pins.yaml) for all four board families. Paste it into the demo YAML editor and apply to inspect the wires in 3D.

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

Shared connector silhouettes live under `src/models/parts/` and are safe to import from the public package (`addPinHeader`, `addUsbA`, `addUsbB`, `addUsbC`, `addMicroUsb`, `USB_A_SINGLE_MM`, `USB_C_MM`) without pulling the 3D view chunk. Use them for 2.54 mm headers and USB shells instead of one-off boxes so Pi GPIO, Pico rails, ESP32 DevKit headers, Arduino UNO Type-B, and stacked USB-A stay visually consistent. Host-registered product models should reuse these helpers rather than drawing USB as a plain box.

## Demo electrical decisions

The Gratheon reference uses 5 V HX711 supply. This demo deliberately uses 3.3 V supply for HX711 and DS18B20, with an explicit warning to verify the exact module. ESP32 GPIO is not 5 V tolerant. This does not guarantee every HX711 breakout operates correctly at 3.3 V.

USB VBUS/GND depict the USB cable conductors, not instructions to connect a second external supply in parallel with USB. All grounds share the ESP32 GND endpoint. The pull-up is an actual component between 3.3 V and the DQ junction, not a direct short. Load-cell colors are illustrative and must be checked against the manufacturer's datasheet.
