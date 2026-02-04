# Seat Ibiza 2022 – Interactive 3D Inspection Demo

A production-style Three.js viewer inspired by BIM/Dalux workflows. Includes selection, properties, layers, issue pins, measurement, and clipping tools.

## Setup

1) Create the Vite project (vanilla TypeScript):

```bash
npm create vite@latest seat-ibiza-demo -- --template vanilla-ts
cd seat-ibiza-demo
```

2) Install dependencies:

```bash
npm install
npm install three
```

3) Copy these files into the project:

- `index.html`
- `src/style.css`
- `src/main.ts`
- `src/ui.ts`
- `src/tools/selection.ts`
- `src/tools/layers.ts`
- `src/tools/issues.ts`
- `src/tools/measure.ts`
- `src/tools/clipping.ts`
- `README.md`

4) Place the model at:

```
public/models/seat_ibiza_2022.glb
```

5) Run the dev server:

```bash
npm run dev
```

## Usage

- Navigate: drag to orbit, scroll to zoom.
- Select: click a mesh to inspect metadata.
- Issue: click to place a pin and fill out the issue form.
- Measure: click two points to measure distance.
- Clip: choose axis and move the slider to slice the model.

## Troubleshooting

- **404 model path**: Ensure the file is exactly at `public/models/seat_ibiza_2022.glb` (case sensitive).
- **CORS**: Not relevant for the local `public` folder in Vite.
- **Huge model performance**: Decimate meshes, resize textures, or compress the GLB (e.g. Draco/meshopt) to improve performance.

## Notes

- Issues are stored in `localStorage` and exported as JSON (thumbnails stored separately in localStorage).
- Layers visibility is persisted in `localStorage`.
