# ARCHITECTURE

## System Shape

The current codebase is a single-app viewer built around one entry file (`src/main.ts`) plus focused tool modules.

There is no separate backend/data-service layer in this repository right now. Business metadata is inferred from mesh names and issue data is stored locally.

## Module Boundaries

### `src/main.ts`

`main.ts` is the application orchestrator. It owns:

- Three.js scene setup and renderer configuration
- camera controls and transform controls wiring
- model loading lifecycle and LOD callbacks
- app mode switching (`navigate`, `move`, `select`, `issue`, `measure`, `clip`)
- event routing between UI and tools
- global reset and runtime metrics updates

### `src/ui.ts`

`UI` is a DOM adapter class responsible for:

- binding panel controls and mode buttons
- rendering selection, issue cards, and performance fields
- exposing callback hooks (`onModeChange`, `onIssueSelect`, etc.)

It does not perform rendering or scene raycasting itself.

### `src/tools/*`

Tool modules encapsulate focused behavior:

- `selection.ts`: mesh highlighting + category/status inference from mesh names
- `layers.ts`: per-category visibility with localStorage persistence
- `issues.ts`: issue records, issue pins, thumbnail capture, export, and camera focus
- `measure.ts`: two-point measurement markers and line
- `clipping.ts`: axis-aligned clipping plane material cloning/restore
- `explode.ts`: grouped explode offsets by inferred part category
- `move.ts`: ground-plane constrained dragging
- `lod.ts`: proxy/high load strategy and fade swap

## Data and State Flow

1. UI emits user intent via callbacks.
2. `main.ts` receives intent and invokes tools.
3. Tools update scene objects and local state.
4. `main.ts` pushes resulting state back to UI.

Examples:

- Selection: raycast hit -> `SelectionTool.select()` -> `ui.setSelection(...)`
- Issue creation: raycast point -> `IssuesTool.addIssue()` -> `ui.setIssues(...)`
- Layer toggle: UI change -> `LayersTool.toggle()` -> mesh visibility update

## Persistence Model

The app uses browser localStorage only:

- theme (`seat-ibiza-theme`)
- layer state (`seat-ibiza-layers`)
- issues + thumbnails (`seat-ibiza-issues`, `seat-ibiza-issue-thumbs`)

Global reset clears localStorage for the active origin.

## Current Constraints

- Metadata is heuristic (name-based), not linked to stable BIM element IDs.
- No backend API abstraction exists in the current implementation.
- `main.ts` is intentionally central but large; a future refactor could split scene/app/state coordinators.
