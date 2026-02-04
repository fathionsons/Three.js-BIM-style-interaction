import * as THREE from "three";

export class MoveTool {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  // Fixed plane keeps motion planar (XZ) and stable across camera angles.
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private dragStart = new THREE.Vector3();
  private targetStart = new THREE.Vector3();
  private temp = new THREE.Vector3();
  private enabled = false;
  private dragging = false;
  private hovering = false;
  private target: THREE.Object3D | null = null;
  private pickables: THREE.Object3D[] = [];

  constructor(private camera: THREE.Camera, private domElement: HTMLElement) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.dragging = false;
      this.hovering = false;
      this.domElement.style.cursor = "default";
    }
  }

  setTarget(target: THREE.Object3D | null) {
    this.target = target;
  }

  setPickables(objects: THREE.Object3D[]) {
    this.pickables = objects;
  }

  setGroundHeight(y: number) {
    this.groundPlane.constant = -y;
  }

  isDragging() {
    return this.dragging;
  }

  onPointerDown(event: PointerEvent) {
    if (!this.enabled || !this.target) {
      return false;
    }
    this.updatePointer(event);
    // Only start dragging when we actually hit the model.
    const hit = this.raycastPickables();
    if (!hit) {
      return false;
    }

    const intersection = this.intersectGround();
    if (!intersection) {
      return false;
    }

    this.dragging = true;
    this.dragStart.copy(intersection);
    this.targetStart.copy(this.target.position);
    this.domElement.style.cursor = "grabbing";
    return true;
  }

  onPointerMove(event: PointerEvent) {
    if (!this.enabled || !this.target) {
      return false;
    }
    this.updatePointer(event);

    if (this.dragging) {
      const intersection = this.intersectGround();
      if (!intersection) {
        return true;
      }
      this.temp.copy(intersection).sub(this.dragStart);
      this.temp.y = 0;
      this.target.position.copy(this.targetStart).add(this.temp);
      return true;
    }

    const hit = this.raycastPickables();
    const hovering = Boolean(hit);
    if (hovering !== this.hovering) {
      this.hovering = hovering;
      this.domElement.style.cursor = hovering ? "grab" : "default";
    }
    return false;
  }

  onPointerUp() {
    if (!this.enabled) {
      return false;
    }
    if (!this.dragging) {
      return false;
    }
    this.dragging = false;
    this.domElement.style.cursor = this.hovering ? "grab" : "default";
    return true;
  }

  cancel() {
    this.dragging = false;
    this.domElement.style.cursor = this.hovering ? "grab" : "default";
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastPickables() {
    if (this.pickables.length === 0) {
      return null;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, true);
    return hits.length > 0 ? hits[0] : null;
  }

  private intersectGround() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
    return hit ? intersection : null;
  }
}
