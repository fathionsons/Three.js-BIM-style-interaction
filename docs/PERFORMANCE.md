# PERFORMANCE

## What is measured in-app

The viewer reports two runtime metrics in the UI:

- `FPS` (rolling estimate)
- `Total triangles` (computed from active meshes)

These metrics are updated continuously in the render loop.

## Rendering strategy

### Progressive loading

`src/tools/lod.ts` uses a two-stage strategy:

1. show proxy model first
2. swap to high-detail model during idle time with opacity fade

If `/models/seat_ibiza_2022_proxy.glb` is not present, a proxy is synthesized from the high model by cloning and simplifying materials.

### Lighting and shading

- ACES tone mapping
- PMREM environment map (`RoomEnvironment`)
- ambient + key + fill + rim lights
- five controllable stage spotlights

This yields high visual quality but increases per-frame lighting cost compared with a minimal setup.

### Shadows

- soft shadows enabled (`PCFSoftShadowMap`)
- high-detail meshes cast/receive shadows
- proxy meshes are configured with reduced shadow cost

## Geometry and memory considerations

- Triangle count depends on current LOD stage.
- During LOD transitions, both proxy and high meshes may coexist briefly while fading.
- Clipping duplicates materials (for safe clipping plane assignment) and restores originals when disabled.
- Issue screenshots are stored as base64 strings and can become the dominant localStorage usage over time.

## Interaction performance considerations

- Raycasting is executed against current mesh list for selection/issue/measure/move.
- Move mode uses ground-plane intersection to avoid expensive physics.
- Camera damping is disabled when user prefers reduced motion.

## Practical optimization options

- provide a real low-poly proxy file for best startup behavior
- reduce shadow map resolution when targeting lower-end hardware
- limit stage light count/intensity on constrained GPUs
- downscale issue thumbnails before persistence
- add optional "proxy-only" mode for mobile or battery-constrained sessions
