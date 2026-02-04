import * as THREE from "three";

export type Category =
  | "Body"
  | "Glass"
  | "Wheels"
  | "Interior"
  | "Lights"
  | "Other";

export type Status = "OK" | "Needs review" | "Fix";

export type Metadata = {
  category: Category;
  status: Status;
  notes: string;
};

export type SelectionInfo = {
  name: string;
  category: Category;
  status: Status;
  material?: string;
  triangles?: number;
  notes?: string;
};

const statusByCategory: Record<Category, Status> = {
  Body: "OK",
  Glass: "OK",
  Wheels: "OK",
  Interior: "Needs review",
  Lights: "OK",
  Other: "Fix",
};

const notesByCategory: Record<Category, string> = {
  Body: "Exterior bodywork surfaces and panels.",
  Glass: "Transparent glass assemblies.",
  Wheels: "Wheel and tire assemblies.",
  Interior: "Interior components and seating.",
  Lights: "Lighting units and reflectors.",
  Other: "Uncategorized parts for review.",
};

export const resolveMetadata = (name: string): Metadata => {
  const key = name.toLowerCase();
  let category: Category = "Other";

  if (/(llanta|freno|brake|rueda|wheel|tire|rim)/.test(key)) {
    category = "Wheels";
  } else if (/(cristal|vidrio|glass|window|windshield|screen)/.test(key)) {
    category = "Glass";
  } else if (/(faro|faros|light|lamp|head|tail)/.test(key)) {
    category = "Lights";
  } else if (
    /(^int[_-]|_int_|interior|cockpit|salpicadero|asiento|reposabrazos|hmi|suelo|techo|maletero|dash|console|steer|seat)/.test(
      key
    )
  ) {
    category = "Interior";
  } else if (
    /(^ext[_-]|_ext_|chapa|puerta|capo|hood|bonnet|bumper|fender|carroceria|parachoques|detalles|plastico|cortina)/.test(
      key
    )
  ) {
    category = "Body";
  } else {
    category = "Other";
  }

  return {
    category,
    status: statusByCategory[category],
    notes: notesByCategory[category],
  };
};

export class SelectionTool {
  private selected: THREE.Mesh | null = null;
  private originalEmissive = new Map<THREE.Material, THREE.Color>();
  private originalEmissiveIntensity = new Map<THREE.Material, number>();
  private hasEmissive = (material: THREE.Material): material is THREE.Material & {
    emissive: THREE.Color;
  } => "emissive" in material;
  private hasEmissiveIntensity = (
    material: THREE.Material
  ): material is THREE.Material & { emissiveIntensity: number } =>
    "emissiveIntensity" in material;

  select(mesh: THREE.Mesh): SelectionInfo {
    this.clear();
    this.selected = mesh;
    this.applyHighlight(mesh);

    const materialName = this.getMaterialName(mesh);
    const triangles = this.getTriangleCount(mesh);
    const name = mesh.name || "Unnamed mesh";
    const metadata = resolveMetadata(name);

    return {
      name,
      category: metadata.category,
      status: metadata.status,
      material: materialName,
      triangles,
      notes: metadata.notes,
    };
  }

  clear() {
    if (!this.selected) {
      return;
    }
    this.restoreHighlight(this.selected);
    this.selected = null;
  }

  getSelected(): THREE.Mesh | null {
    return this.selected;
  }

  private applyHighlight(mesh: THREE.Mesh) {
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    materials.forEach((material) => {
      if (this.hasEmissive(material)) {
        const emissive = material.emissive;
        this.originalEmissive.set(material, emissive.clone());
        if (this.hasEmissiveIntensity(material)) {
          this.originalEmissiveIntensity.set(
            material,
            material.emissiveIntensity
          );
          material.emissiveIntensity = 1.0;
        }
        emissive.set(0x1f6feb);
      }
    });
  }

  private restoreHighlight(mesh: THREE.Mesh) {
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    materials.forEach((material) => {
      if (this.hasEmissive(material)) {
        const original = this.originalEmissive.get(material);
        if (original) {
          material.emissive.copy(original);
        }
        const originalIntensity = this.originalEmissiveIntensity.get(material);
        if (
          originalIntensity !== undefined &&
          this.hasEmissiveIntensity(material)
        ) {
          material.emissiveIntensity = originalIntensity;
        }
      }
    });

    this.originalEmissive.clear();
    this.originalEmissiveIntensity.clear();
  }

  private getMaterialName(mesh: THREE.Mesh): string | undefined {
    if (Array.isArray(mesh.material)) {
      return (
        mesh.material
          .map((mat) => mat.name)
          .filter(Boolean)
          .join(", ") || undefined
      );
    }
    return mesh.material?.name || undefined;
  }

  private getTriangleCount(mesh: THREE.Mesh): number | undefined {
    const geometry = mesh.geometry;
    if (!geometry) {
      return undefined;
    }
    if (geometry.index) {
      return geometry.index.count / 3;
    }
    const position = geometry.getAttribute("position");
    if (!position) {
      return undefined;
    }
    return position.count / 3;
  }
}
