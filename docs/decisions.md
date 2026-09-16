# Initial decisions

- User requested a reusable library plus a runnable demo, not a website-only implementation.
- User accepted the recommended approach; YAML is the initial authoring format, with a versioned schema and a typed JavaScript API. This is not WireViz syntax compatibility.
- User selected a widget with SVG for the schematic and a canvas for 3D, rather than literally one canvas for all UI.
- Framework-independent TypeScript, Three.js loaded only on demand, Vite library build.
- Both views consume one validated, pin-level graph. Repeated endpoint references form junctions. A resistor remains a component, never a direct short between its terminals.
- Physical units are millimetres, schematic coordinates are independent SVG units. Built-in models are illustrative, not verified manufacturing CAD. External glTF/GLB models require author-supplied local pin anchors and scale.
- Work stays in this repository. The Gratheon reference is read-only; integration is documented separately.
- Demo page review (2026-09-16): rebuild the 20 kg load cell as a bar/I-beam, enlarge the canvas, cut secondary copy, remove assembly notes and BOM from widget chrome, drop the marketing hero, and keep YAML as a compact editor only. `getBom` stays in the API.
- Browser checks are allowed for this visual pass. The earlier "no browser" request applied to the initial library delivery, not to later screenshot reviews.
- Schematic wheel zoom keeps the diagram point under the cursor fixed. Scaling only the transform previously zoomed around the SVG origin (top-left).
- Screenshot annotation 1 (2026-09-16, USB power supply gray/black dashes on the blue part) maps to the 3D `kind: power` brick. The blue badge shared the housing top plane and z-fought with the dark body.
- Screenshot annotation 1 (2026-09-16, improve ESP32 3D model to have pins with wires on them) maps to `kind: esp32`. The previous model used two short header bars on the long edges while demo pin anchors sat at y=3 and, for VIN/GND/3V3, beyond the bar length. The built-in model now has a 19-pin dual header at 2.54 mm pitch; demo anchors sit on the gold pin tops. Schematic `side` still means left/right; in 3D those rows are +Z and -Z.
- Canvas chrome (2026-09-16): Schematic/3D becomes an iOS-style switch in the canvas top-right; Reset is a link under that switch; Export SVG moves to the canvas bottom-right; the inspector/select sidebar stays hidden until a component or wire is selected.
- Entrance Observer Phase 1 BOM (2026-09-16): add built-in kinds for Jetson, USB camera, CS lens, M.2 SSD, WiFi NIC, HDMI display, camera mount, 2020 extrusion, acrylic cover and paddle antenna. These are product-interconnect silhouettes, not GPIO pin maps. Keep Jetson USB-C at PD 19 V; do not copy the ESP32 5 V lab map.
