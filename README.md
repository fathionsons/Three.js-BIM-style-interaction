# Seat Ibiza 2022 - Interactive 3D Inspection Viewer

This project is a Three.js + TypeScript viewer focused on BIM-style inspection interactions.

It is currently a rich front-end viewer, not a full BIM platform backend. The implementation emphasizes practical interaction tooling (selection, clipping, measure, issue pins, layers, LOD, and scene controls) around a GLB asset.

## What It Does

- Loads a high-detail GLB model with progressive LOD behavior.
- Supports navigation and camera presets for inspection workflows.
- Provides model interaction modes:
  - `Navigate`
  - `Move`
  - `Select`
  - `Issue`
  - `Measure`
  - `Clip`
- Includes exploded view, model rotation, and stage light manipulation.
- Tracks issue pins with severity, screenshots, and saved camera viewpoints.
- Shows runtime performance counters (FPS and total triangles).

## Current Feature Set

### Model loading and rendering

- GLTF/GLB loading via `GLTFLoader`
- Progressive LOD via `src/tools/lod.ts`
  - attempts `/models/seat_ibiza_2022_proxy.glb`
  - falls back to a generated proxy from high-detail model if proxy file is missing
  - swaps to high-detail on idle with fade
- PBR rendering with ACES tone mapping and environment lighting
- Ground alignment logic to keep model resting on plane

### Interaction and tools

- Selection highlight with per-mesh metadata derived from mesh names (`src/tools/selection.ts`)
- Layer visibility toggles by inferred category (`Body`, `Glass`, `Wheels`, `Interior`, `Lights`, `Other`)
- Issue workflow (local):
  - create pins on click
  - severity + notes
  - snapshot thumbnail capture
  - focus camera to issue
  - export JSON
- Two-point measurement tool
- Axis clipping plane tool (`x/y/z`)
- Exploded view grouping and slider
- Move tool constrained to ground plane
- Transform controls for rotating model and stage lights

### UI and UX

- Dark/light theme toggle
- Global reset button
- Mobile-adaptive side panel layout
- Reduced-motion handling for orbit damping

## Persistence

The app persists to `localStorage`:

- theme preference
- layer visibility state
- issue records + thumbnails

The reset action currently clears all local storage for the app origin.

## Why a Car Model?

The car asset is a stand-in geometry model used to demonstrate BIM-style inspection interactions in a lightweight portfolio project.

The interaction patterns (selection, clipping, issue capture, camera recall, layers, and LOD) are the transferable part. A real BIM deployment would replace the source geometry and add a proper BIM data backend.

## Tech Stack

- Three.js
- TypeScript (strict)
- Vite

## Setup

### Requirements

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

## Repository Layout

```text
/src
  main.ts                 App bootstrap + scene/runtime orchestration
  ui.ts                   UI controller class for panel interactions
  style.css               Application styles
  /tools
    clipping.ts
    explode.ts
    issues.ts
    layers.ts
    lod.ts
    measure.ts
    move.ts
    selection.ts
/docs
  ARCHITECTURE.md
  DECISIONS.md
  PERFORMANCE.md
  TECHNICAL.md
```

## Documentation

- `docs/ARCHITECTURE.md`: how modules are split and wired
- `docs/DECISIONS.md`: implementation choices and trade-offs
- `docs/PERFORMANCE.md`: performance strategy and constraints
- `docs/TECHNICAL.md`: IFC context and BIM integration path

## Credits

- Car model: Ddiaz Design - https://skfb.ly/ptVUo
- Spotlight model: Mike Rowley - https://skfb.ly/M6TS
