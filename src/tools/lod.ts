import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

type MaterialState = {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type LoadCallbacks = {
  onProxyShown?: (root: THREE.Object3D, meshes: THREE.Mesh[]) => void;
  onHighShown?: (root: THREE.Object3D, meshes: THREE.Mesh[]) => void;
  onStatus?: (status: string) => void;
  onProgress?: (value: number | null) => void;
};

type LodOptions = {
  highUrl: string;
  proxyUrl?: string;
  modelPivot: THREE.Group;
  hideInteriorOnProxy?: boolean;
  fadeDurationMs?: number;
  idleDelayMs?: number;
};

export class LodTool {
  private loader = new GLTFLoader();
  private proxyRoot: THREE.Object3D | null = null;
  private highRoot: THREE.Object3D | null = null;
  private stage: "loading" | "proxy" | "high" = "loading";
  private manualLock: "auto" | "proxy" | "high" = "auto";
  private proxyMaterials = new Map<THREE.Material, MaterialState>();
  private highMaterials = new Map<THREE.Material, MaterialState>();

  constructor(private options: LodOptions, private callbacks: LoadCallbacks) {}

  load() {
    const { proxyUrl } = this.options;
    this.callbacks.onStatus?.("Loading preview...");

    if (proxyUrl) {
      this.loadGltf(proxyUrl)
        .then((gltf) => {
          if (this.stage !== "loading") {
            return;
          }
          this.proxyRoot = gltf.scene;
          this.prepareProxy(this.proxyRoot);
          this.attachProxy(this.proxyRoot);
          this.callbacks.onStatus?.("Low-detail preview loaded");
        })
        .catch(() => {
          if (this.stage === "loading") {
            this.callbacks.onStatus?.("Loading preview...");
          }
        });
    }

    this.loadGltf(this.options.highUrl, (value) => {
      this.callbacks.onProgress?.(value);
    })
      .then((gltf) => {
        this.highRoot = gltf.scene;

        if (!this.proxyRoot) {
          // No real proxy asset. We clone the high model and simplify it so the
          // user still sees a "preview" first, while intent is clearly expressed.
          this.proxyRoot = this.buildProxyFromHigh(this.highRoot);
          this.attachProxy(this.proxyRoot);
          this.callbacks.onStatus?.("Low-detail preview loaded");
        }

        if (this.manualLock === "high") {
          this.showHigh();
          return;
        }
        if (this.manualLock === "proxy") {
          this.showProxy();
          return;
        }
        this.scheduleHighSwap();
      })
      .catch(() => {
        this.callbacks.onStatus?.("Failed to load model");
      });
  }

  private loadGltf(url: string, onProgress?: (value: number | null) => void) {
    return new Promise<GLTF>((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => resolve(gltf),
        (event) => {
          if (!onProgress) {
            return;
          }
          if (event.total && event.total > 0) {
            onProgress((event.loaded / event.total) * 100);
          } else {
            onProgress(null);
          }
        },
        () => reject(new Error(`Failed to load ${url}`))
      );
    });
  }

  private attachProxy(root: THREE.Object3D) {
    this.clearPivot();
    this.options.modelPivot.add(root);
    this.stage = "proxy";
    this.callbacks.onProxyShown?.(root, this.collectMeshes(root));
  }

  private attachHigh(root: THREE.Object3D) {
    this.options.modelPivot.add(root);
    this.stage = "high";
    this.callbacks.onHighShown?.(root, this.collectMeshes(root));
  }

  private scheduleHighSwap() {
    if (!this.highRoot || !this.proxyRoot) {
      return;
    }
    if (this.manualLock !== "auto") {
      return;
    }

    const fallbackDelay = this.options.idleDelayMs ?? 1400;
    // Swap during idle time to minimize hitches while the user is interacting.
    const schedule = (
      callback: (deadline: IdleDeadlineLike) => void
    ): number => {
      const idle = (
        window as Window & {
          requestIdleCallback?: (
            cb: (deadline: IdleDeadlineLike) => void,
            opts?: { timeout: number }
          ) => number;
        }
      ).requestIdleCallback;
      if (idle) {
        return idle(callback, { timeout: fallbackDelay });
      }
      return window.setTimeout(
        () =>
          callback({
            didTimeout: true,
            timeRemaining: () => 0,
          }),
        fallbackDelay
      );
    };

    schedule(() => {
      if (this.stage !== "proxy" || !this.highRoot) {
        return;
      }
      this.swapToHigh(this.highRoot, this.proxyRoot as THREE.Object3D);
    });
  }

  private swapToHigh(highRoot: THREE.Object3D, proxyRoot: THREE.Object3D) {
    const fadeDuration = this.options.fadeDurationMs ?? 700;
    this.prepareHigh(highRoot);
    this.attachHigh(highRoot);

    this.applyOpacity(highRoot, 0, this.highMaterials);
    this.applyOpacity(proxyRoot, 1, this.proxyMaterials);

    const fade = (from: number, to: number, root: THREE.Object3D, map: Map<THREE.Material, MaterialState>) => {
      return new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / fadeDuration);
          const alpha = THREE.MathUtils.lerp(from, to, t);
          this.applyOpacity(root, alpha, map);
          if (t < 1) {
            requestAnimationFrame(tick);
            return;
          }
          resolve();
        };
        requestAnimationFrame(tick);
      });
    };

    Promise.all([
      fade(1, 0, proxyRoot, this.proxyMaterials),
      fade(0, 1, highRoot, this.highMaterials),
    ]).then(() => {
      this.options.modelPivot.remove(proxyRoot);
      this.callbacks.onStatus?.("High-detail model loaded");
    });
  }

  showProxy() {
    this.manualLock = "proxy";
    if (!this.proxyRoot) {
      if (!this.highRoot) {
        return false;
      }
      this.proxyRoot = this.buildProxyFromHigh(this.highRoot);
    }
    this.applyOpacity(this.proxyRoot, 1, this.proxyMaterials);
    if (this.highRoot) {
      this.applyOpacity(this.highRoot, 0, this.highMaterials);
    }
    this.clearPivot();
    this.attachProxy(this.proxyRoot);
    this.callbacks.onStatus?.("Proxy loaded");
    return true;
  }

  showHigh() {
    this.manualLock = "high";
    if (!this.highRoot) {
      return false;
    }
    this.prepareHigh(this.highRoot);
    this.applyOpacity(this.highRoot, 1, this.highMaterials);
    if (this.proxyRoot) {
      this.applyOpacity(this.proxyRoot, 0, this.proxyMaterials);
    }
    this.clearPivot();
    this.attachHigh(this.highRoot);
    this.callbacks.onStatus?.("High-detail loaded");
    return true;
  }

  private prepareProxy(root: THREE.Object3D) {
    const hideInterior = Boolean(this.options.hideInteriorOnProxy);
    root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) {
        return;
      }
      const mesh = child as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      if (hideInterior && this.isInterior(mesh.name)) {
        mesh.visible = false;
        return;
      }

      const sourceMaterials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const proxyMaterials = sourceMaterials.map((material) => {
        const materialColor = (material as THREE.Material & { color?: THREE.Color }).color;
        const color = materialColor ? materialColor.clone() : new THREE.Color(0x7b7f86);
        return new THREE.MeshBasicMaterial({ color });
      });
      mesh.material = Array.isArray(mesh.material) ? proxyMaterials : proxyMaterials[0];
    });
  }

  private prepareHigh(root: THREE.Object3D) {
    root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) {
        return;
      }
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }

  private buildProxyFromHigh(highRoot: THREE.Object3D) {
    const clone = highRoot.clone(true);
    this.prepareProxy(clone);
    return clone;
  }

  private applyOpacity(
    root: THREE.Object3D,
    alpha: number,
    map: Map<THREE.Material, MaterialState>
  ) {
    root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) {
        return;
      }
      const mesh = child as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const base = map.get(material) ?? {
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
        };
        map.set(material, base);
        material.transparent = true;
        material.opacity = base.opacity * alpha;
        material.depthWrite = alpha >= 1 ? base.depthWrite : false;
        if (alpha >= 1) {
          material.transparent = base.transparent;
        }
      });
    });
  }

  private collectMeshes(root: THREE.Object3D) {
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });
    return meshes;
  }

  private clearPivot() {
    const { modelPivot } = this.options;
    modelPivot.children
      .filter((child) => child !== undefined)
      .forEach((child) => {
        modelPivot.remove(child);
      });
  }

  private isInterior(name: string) {
    const key = name.toLowerCase();
    return /(^int[_-]|_int_|interior|cockpit|salpicadero|asiento|reposabrazos|hmi|suelo|techo|maletero|dash|console|steer|seat)/.test(
      key
    );
  }
}
