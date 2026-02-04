import type * as THREE from "three";
import { resolveMetadata, type Category } from "./selection";

const STORAGE_KEY = "seat-ibiza-layers";

export class LayersTool {
  private meshes: THREE.Mesh[] = [];
  private meshCategory = new Map<THREE.Mesh, Category>();
  private state: Record<Category, boolean> = {
    Body: true,
    Glass: true,
    Wheels: true,
    Interior: true,
    Lights: true,
    Other: true,
  };

  setMeshes(meshes: THREE.Mesh[]) {
    this.meshes = meshes;
    this.meshCategory.clear();
    meshes.forEach((mesh) => {
      const metadata = resolveMetadata(mesh.name || "");
      this.meshCategory.set(mesh, metadata.category);
    });
  }

  loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return this.state;
    }
    try {
      const parsed = JSON.parse(raw) as Record<Category, boolean>;
      this.state = { ...this.state, ...parsed };
    } catch {
      this.state = { ...this.state };
    }
    return this.state;
  }

  persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  getState() {
    return { ...this.state };
  }

  toggle(category: Category, visible: boolean) {
    this.state[category] = visible;
    this.applyVisibility();
    this.persistState();
  }

  applyVisibility() {
    this.meshes.forEach((mesh) => {
      const category = this.meshCategory.get(mesh);
      if (!category) {
        return;
      }
      mesh.visible = this.state[category];
    });
  }
}
