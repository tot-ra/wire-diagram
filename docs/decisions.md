# Initial decisions

- User requested a reusable library plus a runnable demo, not a website-only implementation.
- User accepted the recommended approach; YAML is the initial authoring format, with a versioned schema and a typed JavaScript API. This is not WireViz syntax compatibility.
- User selected a widget with SVG for the schematic and a canvas for 3D, rather than literally one canvas for all UI.
- Framework-independent TypeScript, Three.js loaded only on demand, Vite library build.
- Both views consume one validated, pin-level graph. Repeated endpoint references form junctions. A resistor remains a component, never a direct short between its terminals.
- Physical units are millimetres, schematic coordinates are independent SVG units. Built-in models are illustrative, not verified manufacturing CAD. External glTF/GLB models require author-supplied local pin anchors and scale.
- Work stays in this repository. The Gratheon reference is read-only; integration is documented separately.
- User requested no browser during verification. Stop browser tools; rely on static review, build, and automated non-browser tests. GPU rendering/visual accuracy remains unverified.
