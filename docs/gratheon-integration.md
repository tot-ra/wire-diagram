# Gratheon integration plan

The reference repository is `~/git/gratheon/gratheon.com`, not `~/git/gratheon/website`. No files in that repository were modified.

Reference article:

`content/docs/beehive-sensors/phase-1-lab-validation/wiring-diagrams/full-system-wiring.html`

The current site uses a Go-based Markdown/HTML blog engine. The article embeds its own SVG plus a Three.js module and import map. This library does not require a React/Docusaurus adapter or the site's classic-script bundle.

## Proposed migration

1. Verify the actual board models and electrical design, particularly HX711 supply/DT logic voltage. Do not silently replace the site's existing electrical instructions with the illustrative demo.
2. Build this library with `npm ci && npm run build`. Copy the entire `dist/` directory to the site's public assets, using its existing asset conventions. Include all hashed chunks and CSS, not only `wire-diagram.js`.
3. Author a reviewed YAML document for the article. Keep the current pin table, safety checklist and static diagram until the new representation is verified.
4. Add a widget container, stylesheet link and a `type="module"` script following the README HTML example. Fetch the YAML with an HTTP status check and present a useful failure message. Use absolute asset URLs so localized/nested article paths work.
5. Remove the old article-specific import map/3D module only after confirming no other scripts depend on them. The library bundles its dependencies and needs no import map.
6. Integrate the translated article separately with localized titles/notes. Built-in widget controls are currently English; a localization API is future work.
7. Test the site's static build, CSP and asset caching. Verify multiple diagrams, missing WebGL, failed model URLs, narrow screens, keyboard selection and unmount/remount if navigation is client-side. Visual/GPU verification must be done with user permission.

For a no-JavaScript fallback, generate an SVG using `renderSVG(parseDiagram(yaml))` during the site build and retain the pin table. This is a site integration responsibility, not automatic fallback markup emitted by the widget.
