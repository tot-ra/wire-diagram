# Lessons learned

- Verify local reference repository paths before using them as working directories. On this machine the Gratheon site is under `~/git/gratheon/gratheon.com`, not `~/git/gratheon/website`.
- Discover upstream documentation paths from the repository README instead of assuming tutorial filenames; the guessed WireViz tutorial URL returned 404.
- Check agent project binding before delegation. A reusable agent definition on disk does not guarantee that the configured runtime is available to this project (`dev-coder-balanced` was bound elsewhere).
- New repositories may have no commits; use `git status` before querying commit history.
- Audit initial dependencies before shipping; upgrade Vitest to a release fixing GHSA-82fw-gwwq-j7x9 instead of accepting the vulnerable initial test-runner version.
- View synchronization methods must not emit user callbacks: `view.select()` calling `onSelect()` caused recursive widget selection. Cover the integrated widget, not only isolated renderers, in tests.
- Stop browser tooling when the user requests no browser. A prior selector-based click timed out; complete remaining checks with build, unit/integration tests and code review, and report visual verification as incomplete.
- Do not use a callback-based test as evidence of 3D initialization. jsdom has no WebGL; mock the renderer for lifecycle tests and keep actual GPU rendering explicitly unverified.
- In Vitest's jsdom environment, transformed `import.meta.url` may be HTTP-based. Read repository fixtures via a known filesystem path or Vite raw import, not an assumed file URL.
- Include routed-wire extents when computing SVG viewBox, not just component/group bounds; long detours otherwise disappear in exports.
