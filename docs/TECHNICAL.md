# TECHNICAL

## IFC Awareness: Current vs Target

This codebase does not parse IFC and does not yet include an IFC-derived property service.

Current implementation:

- runtime geometry is GLB
- metadata shown in selection is inferred from mesh names
- no stable IFC GUID or BIM element ID mapping is stored

So the viewer is IFC-aware conceptually, but not IFC-integrated at data level.

## Current Runtime Mapping

Today, the effective chain is:

`glTF mesh name -> regex classification -> category/status/notes`

This powers selection details and layer grouping, but it is heuristic and model-dependent.

## Typical IFC -> Viewer pipeline (recommended)

A production BIM pipeline would generally look like:

1. Authoring tool exports IFC.
2. Conversion service generates glTF/GLB for rendering.
3. Conversion emits stable mapping artifacts (for example: `ifcGuid -> elementId -> mesh node`).
4. Viewer reads geometry from GLB and properties/issues from a data service.
5. Selection uses `elementId` lookup instead of mesh-name heuristics.

## Example target mapping

- IFC entity: `IFCWall` (GUID `2H$k9abc...`)
- Converted node: `Wall_North_A`
- Runtime node metadata: `elementId = wall_1023`
- Property panel source: API/data store keyed by `wall_1023`

## Where Three.js fits

Three.js is the rendering and interaction layer:

- camera/navigation/controls
- raycasting and selection hits
- shading, clipping, and scene composition

BIM truth (properties, revisions, issue lifecycle, permissions) should live outside the viewer in dedicated services.

## What this project demonstrates well

- practical interaction tooling around large GLB models
- progressive loading behavior
- issue pin workflow with persisted snapshots
- clear path toward BIM data integration

## What would be needed for Dalux-style parity

- backend data model for elements/properties/issues/revisions
- stable element ID mapping from IFC conversion pipeline
- transition validation and audit trail server-side
- multi-user sync and role-based permissions
- conflict-safe updates across web/mobile clients
