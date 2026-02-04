import * as THREE from "three";

export type ClipAxis = "x" | "y" | "z";

export class ClippingTool {
  private plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  private axis: ClipAxis = "x";
  private value = 0;
  private enabled = false;
  private meshes: THREE.Mesh[] = [];
  private originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  constructor(private renderer: THREE.WebGLRenderer) {}

  setMeshes(meshes: THREE.Mesh[]) {
    this.meshes = meshes;
  }

  setAxis(axis: ClipAxis) {
    this.axis = axis;
    this.updatePlane();
  }

  setValue(value: number) {
    this.value = value;
    this.updatePlane();
  }

  enable() {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    this.renderer.localClippingEnabled = true;
    this.applyClipping();
  }

  disable() {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    this.renderer.localClippingEnabled = false;
    this.restoreMaterials();
  }

  isEnabled() {
    return this.enabled;
  }

  private updatePlane() {
    const normal = new THREE.Vector3(0, 0, 0);
    if (this.axis === "x") {
      normal.set(1, 0, 0);
    } else if (this.axis === "y") {
      normal.set(0, 1, 0);
    } else {
      normal.set(0, 0, 1);
    }
    this.plane.normal.copy(normal).normalize();
    this.plane.constant = -this.value;
  }

  private applyClipping() {
    this.meshes.forEach((mesh) => {
      if (!this.originalMaterials.has(mesh)) {
        this.originalMaterials.set(mesh, mesh.material);
      }
      mesh.material = this.cloneMaterial(mesh.material);
      this.setMaterialClipping(mesh.material);
    });
  }

  private restoreMaterials() {
    this.meshes.forEach((mesh) => {
      const original = this.originalMaterials.get(mesh);
      if (original) {
        mesh.material = original;
      }
    });
    this.originalMaterials.clear();
  }

  private cloneMaterial(material: THREE.Material | THREE.Material[]) {
    if (Array.isArray(material)) {
      return material.map((mat) => mat.clone());
    }
    return material.clone();
  }

  private setMaterialClipping(material: THREE.Material | THREE.Material[]) {
    if (Array.isArray(material)) {
      material.forEach((mat) => {
        this.applyPlaneToMaterial(mat);
      });
      return;
    }
    this.applyPlaneToMaterial(material);
  }

  private applyPlaneToMaterial(material: THREE.Material) {
    if ("clippingPlanes" in material) {
      material.clippingPlanes = [this.plane];
      material.clipShadows = true;
      material.needsUpdate = true;
    }
  }
}
