import * as THREE from "three";

export class MeasureTool {
  private points: THREE.Vector3[] = [];
  private markers: THREE.Mesh[] = [];
  private line: THREE.Line | null = null;

  constructor(
    private scene: THREE.Scene,
    private onUpdate: (distance: number | null) => void
  ) {}

  addPoint(point: THREE.Vector3) {
    if (this.points.length >= 2) {
      this.clear();
    }

    const markerGeometry = new THREE.SphereGeometry(0.035, 12, 12);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0x4cc3ff,
      emissive: 0x4cc3ff,
      emissiveIntensity: 0.35,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(point);
    marker.castShadow = true;
    this.scene.add(marker);

    this.points.push(point.clone());
    this.markers.push(marker);

    if (this.points.length === 2) {
      this.createLine();
      this.onUpdate(this.points[0].distanceTo(this.points[1]));
    } else {
      this.onUpdate(null);
    }
  }

  clear() {
    this.points = [];
    this.markers.forEach((marker) => {
      this.scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    });
    this.markers = [];

    if (this.line) {
      this.scene.remove(this.line);
      this.line.geometry.dispose();
      (this.line.material as THREE.Material).dispose();
      this.line = null;
    }

    this.onUpdate(null);
  }

  private createLine() {
    if (this.points.length !== 2) {
      return;
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    const material = new THREE.LineBasicMaterial({ color: 0x4cc3ff });
    this.line = new THREE.Line(geometry, material);
    this.scene.add(this.line);
  }
}
