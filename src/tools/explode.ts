import * as THREE from "three";

type ExplodeCategory = "Body" | "Wheels" | "Doors" | "Interior" | "Lights";

type ExplodeGroup = {
  id: string;
  category: ExplodeCategory;
  group: THREE.Group;
  original: THREE.Vector3;
  direction: THREE.Vector3;
};

const DEFAULT_DIRECTIONS: Record<ExplodeCategory, THREE.Vector3> = {
  Body: new THREE.Vector3(0, 0.18, -0.12),
  Wheels: new THREE.Vector3(1, 0, 1),
  Doors: new THREE.Vector3(1, 0, 0),
  Interior: new THREE.Vector3(0, 1, 0),
  Lights: new THREE.Vector3(0, 0.15, 1),
};

export class ExplodeTool {
  private groups: ExplodeGroup[] = [];
  private root: THREE.Object3D | null = null;
  private amount = 0;
  private explodeDistance = 1;
  private temp = new THREE.Vector3();

  setModel(root: THREE.Object3D, meshes: THREE.Mesh[], bounds: THREE.Box3) {
    this.clear();
    this.root = root;
    // Scale by model size so the visual separation feels consistent across assets.
    this.explodeDistance = Math.max(1, bounds.getSize(new THREE.Vector3()).length() * 0.12);
    root.updateMatrixWorld(true);

    const center = bounds.getCenter(new THREE.Vector3());
    const groupMap = new Map<string, ExplodeGroup>();

    meshes.forEach((mesh) => {
      const category = this.classify(mesh.name || "");
      const meshCenter = this.getMeshCenter(mesh);
      const rel = meshCenter.clone().sub(center);
      const key = this.getGroupKey(category, rel);

      let entry = groupMap.get(key);
      if (!entry) {
        const group = new THREE.Group();
        group.name = `explode_${key}`;
        root.add(group);

        const direction = this.getDirection(category, rel);
        entry = {
          id: key,
          category,
          group,
          original: group.position.clone(),
          direction,
        };
        groupMap.set(key, entry);
      }

      entry.group.attach(mesh);
    });

    this.groups = Array.from(groupMap.values());
    this.apply();
  }

  setAmount(value: number) {
    this.amount = THREE.MathUtils.clamp(value, 0, 1);
    this.apply();
  }

  reset() {
    this.setAmount(0);
  }

  clear() {
    if (this.root) {
      this.groups.forEach((entry) => {
        this.root?.remove(entry.group);
      });
    }
    this.groups = [];
  }

  private apply() {
    this.groups.forEach((entry) => {
      this.temp.copy(entry.direction).multiplyScalar(this.explodeDistance * this.amount);
      entry.group.position.copy(entry.original).add(this.temp);
    });
  }

  private classify(name: string): ExplodeCategory {
    const key = name.toLowerCase();
    if (/(puerta|door)/.test(key)) {
      return "Doors";
    }
    if (/(llanta|freno|brake|rueda|wheel|tire|rim)/.test(key)) {
      return "Wheels";
    }
    if (/(faros|faro|light|lamp|head|tail)/.test(key)) {
      return "Lights";
    }
    if (
      /(^int[_-]|_int_|interior|cockpit|salpicadero|asiento|reposabrazos|hmi|suelo|techo|maletero|dash|console|steer|seat)/.test(
        key
      )
    ) {
      return "Interior";
    }
    return "Body";
  }

  private getGroupKey(category: ExplodeCategory, rel: THREE.Vector3) {
    // Split wheels/doors into side buckets so a single category still moves outward.
    if (category === "Wheels") {
      const side = rel.x >= 0 ? "R" : "L";
      const axle = rel.z >= 0 ? "F" : "B";
      return `Wheels_${axle}${side}`;
    }
    if (category === "Doors") {
      const side = rel.x >= 0 ? "R" : "L";
      return `Doors_${side}`;
    }
    if (category === "Lights") {
      const side = rel.z >= 0 ? "F" : "B";
      return `Lights_${side}`;
    }
    return category;
  }

  private getDirection(category: ExplodeCategory, rel: THREE.Vector3) {
    const direction = DEFAULT_DIRECTIONS[category].clone();
    if (category === "Wheels") {
      direction.set(Math.sign(rel.x) || 1, 0, Math.sign(rel.z) || 1);
    } else if (category === "Doors") {
      direction.set(Math.sign(rel.x) || 1, 0, 0);
    } else if (category === "Lights") {
      direction.set(0, 0.1, Math.sign(rel.z) || 1);
    }
    if (direction.lengthSq() < 1e-4) {
      direction.set(0, 1, 0);
    }
    return direction.normalize();
  }

  private getMeshCenter(mesh: THREE.Mesh) {
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    const bounds = (geometry.boundingBox ?? new THREE.Box3()).clone();
    bounds.applyMatrix4(mesh.matrixWorld);
    return bounds.getCenter(new THREE.Vector3());
  }
}
