# Home Organizer

A mobile-first, offline PWA for people with messy homes: draw your floor plans,
furnish them with storage furniture, define the storage areas inside each piece
(drawers, shelves, sections), and record which items live where. When you forget
where something is, search for it and the app shows the exact spot on your plan.

All data stays on your device (localStorage). Export/import a JSON backup from
Settings.

## Features

- **Plan tab** — multiple floors; draw rooms by dragging (they snap to a 1 m
  grid and clip against neighbouring rooms); shape them into L/T/U layouts with
  **Extend** and **Carve**, or drag a wall's edge handle to push it in or out;
  place doors, windows and furniture (shelf, dresser, wardrobe, cabinet, chest,
  …); live dimensions show wall lengths and floor area; pinch to zoom,
  two-finger pan.
- **3D dollhouse view** — floors render as an isometric miniature: low
  extruded walls with door openings and window glass, wood floors, furniture
  as 3D volumes poking above the walls so nothing is ever hidden; all editing
  works directly in 3D, and a corner FAB toggles the flat 2D plan.
- **Furniture sheet** — tap a piece of furniture to manage its storage areas and
  the items inside each area.
- **Items tab** — search everything you own; "＋ Add" opens a quick-entry sheet
  with a grouped location picker for rapid cataloguing; each result shows its
  location (Floor › Room › Furniture › Area), opens its furniture for editing
  on tap, and "Show on plan" highlights it on the map.
- **Real-world scale** — furniture spawns at realistic footprints (a shelf is
  0.8 × 0.3 m) on a 0.25 m grid; doors and windows have draggable end handles
  to set their width and slide along their wall.
- **Undo/redo** — every edit (shapes, deletes, imports) is reversible; ↩/↪ on
  the plan, Cmd/Ctrl+Z anywhere; rapid edits coalesce into single steps.
- **Move items** — relocate an item to any other storage area from its notes
  panel without re-creating it.
- **Example home** — load a furnished two-floor demo from the empty plan or
  Settings to explore the app instantly (undoable).
- **Dark mode** — follows the system theme, floor plan included.
- **Offline-first PWA** — installable, works with no connection; data persists
  locally with backup export/import.

## Development

```bash
npm install
npm run dev       # dev server
npm test          # vitest unit tests (geometry, store, persistence)
npm run build     # type-check + production build (generates the service worker)
npm run preview   # serve the production build
```

## Architecture

- `src/model/` — pure, unit-tested core: entity types, a grid cell-set engine
  for rectilinear room shapes (union/carve, connectivity and hole checks,
  outline tracing), wall hit-testing, a zustand store with cascade deletes and
  shape editing, and localStorage persistence with validation and schema
  migration.
- `src/components/` — React UI: SVG floor-plan canvas with pointer-gesture
  editing, bottom-sheet furniture editor, searchable item list, settings.

Design and plan documents live in `docs/superpowers/`.

### Rendering

The 3D dollhouse view is rendered with WebGL via **three.js / react-three-fiber**, giving real z-buffered occlusion and shadow casting without the overdraw and painter's-order artifacts that plagued the previous SVG approach. The 2D editor view remains SVG for crisp resolution-independent drawing and direct DOM hit-testing. See `docs/renderer-analysis.md` for the full rationale. `docs/torture-scene.json` is a verification fixture covering every known renderer stress case (T-junctions, corner-adjacent doors, overlapping shared-wall openings, both swing directions, windows on shared walls, flush and tall furniture); paste its contents into the `home-organizer/v1` localStorage key to load it in any browser tab.
