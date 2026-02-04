# DECISIONS

## 1) Keep a single runtime orchestrator (`main.ts`)

### Decision
Use one explicit entrypoint to wire scene setup, tool lifecycle, and UI callbacks.

### Why

- fast iteration for a portfolio-sized viewer
- all interaction flows visible in one place
- easier debugging of tool interactions

### Trade-off

- file size has grown significantly
- less modular than a multi-layer application architecture

## 2) GLB/glTF as runtime format

### Decision
Use GLB assets loaded through `GLTFLoader`.

### Why

- compact delivery format
- reliable material/shader support in Three.js
- straightforward integration with LOD swapping

### Trade-off

- semantics are limited unless explicitly mapped
- current implementation relies on mesh naming conventions for metadata

## 3) Progressive LOD with proxy fallback

### Decision
Load a proxy first when available, then swap to high-detail after idle.

### Why

- improves first-interaction responsiveness
- keeps load UX smooth with fade transition
- still works when a dedicated proxy file is missing

### Trade-off

- generated proxy from high model is less efficient than a handcrafted low-poly proxy
- duplicate scene clones during transition can temporarily increase memory use

## 4) Local-only issue storage

### Decision
Persist issues, thumbnails, and layer state in localStorage.

### Why

- zero backend setup
- immediate persistence across refreshes
- suitable for portfolio/demo environment

### Trade-off

- no multi-user sync
- no permissions, audit, or server validation
- storage size can grow quickly due to base64 thumbnails

## 5) Heuristic metadata classification

### Decision
Derive category/status/notes from mesh names using regex matching.

### Why

- avoids dependency on external BIM metadata source
- enables layers and selection details immediately

### Trade-off

- classification quality depends on mesh naming quality
- not robust for heterogeneous production models

## 6) Transform controls for model and stage lights

### Decision
Use `TransformControls` for in-scene rotation workflows.

### Why

- familiar 3D manipulation UX
- useful for presentation and inspection framing

### Trade-off

- requires careful control state management with orbit/move modes
- interaction complexity increases (selection vs transform intent)

## Future Improvement Path

- split `main.ts` into scene/app-state/input coordinators
- introduce a real BIM data layer with stable `elementId` mapping
- add backend API adapter for issues and revisions
- add tests for tool-level logic (classification, transitions, clipping/material restore)
