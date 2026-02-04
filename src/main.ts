import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { UI, type Mode, type ViewPreset } from "./ui";
import { SelectionTool } from "./tools/selection";
import { LayersTool } from "./tools/layers";
import { IssuesTool } from "./tools/issues";
import { MeasureTool } from "./tools/measure";
import { ClippingTool, type ClipAxis } from "./tools/clipping";
import { LodTool } from "./tools/lod";
import { ExplodeTool } from "./tools/explode";
import { MoveTool } from "./tools/move";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app container");
}

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const ui = new UI();

// Leave one texture unit headroom (target 15/16) on lower-end GPUs.
let keepPbrTextures = true;
const TARGET_TEXTURE_UNIT_BUDGET = 15;
const MAX_STAGE_SHADOW_LIGHTS = 1;
const FORCE_SMOOTH_NORMALS = true;
const DEFAULT_STAGE_LIGHT_STRENGTH = 1.6;
const DEFAULT_THEME_LIGHT = false;
const GROUND_LEVEL = 0;
const CAMERA_GROUND_CLEARANCE = 0.08;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const maxTextureUnits = renderer.capabilities.maxTextures;
if (maxTextureUnits <= TARGET_TEXTURE_UNIT_BUDGET + 1) {
  // Trim material texture usage so lighting + shadows stay below the GPU cap.
  keepPbrTextures = false;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f14);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();

const textureLoader = new THREE.TextureLoader();
const modelPivot = new THREE.Group();
scene.add(modelPivot);
// Keep LOD swaps isolated so we can replace the model without touching pins/tools.
const modelContainer = new THREE.Group();
modelPivot.add(modelContainer);
const issuesAnchor = new THREE.Group();
modelPivot.add(issuesAnchor);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !prefersReducedMotion;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
// Prevent orbiting below the horizon around the current target.
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.update();

type TransformControlsLike = THREE.Object3D & {
  dragging: boolean;
  enabled: boolean;
  showX: boolean;
  showY: boolean;
  showZ: boolean;
  object?: THREE.Object3D | null;
  attach: (object: THREE.Object3D) => void;
  detach: () => void;
  setMode: (mode: "rotate" | "translate" | "scale") => void;
  setSpace: (space: "local" | "world") => void;
  setSize: (size: number) => void;
  getHelper?: () => THREE.Object3D;
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
};

const transformControls = new TransformControls(
  camera,
  renderer.domElement
) as unknown as TransformControlsLike;
transformControls.setMode("rotate");
transformControls.setSpace("local");
transformControls.setSize(0.9);
transformControls.showX = true;
transformControls.showY = true;
transformControls.showZ = true;
transformControls.enabled = false;
transformControls.addEventListener("dragging-changed", (event) => {
  const isDragging = (event as { value?: boolean }).value ?? false;
  controls.enabled = !isDragging;
});
const transformHelper =
  transformControls.getHelper?.() ??
  (transformControls as unknown as THREE.Object3D);
transformHelper.visible = false;
scene.add(transformHelper);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(6, 10, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8bb7ff, 0.9);
fillLight.position.set(-8, 4, 6);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 1.1);
rimLight.position.set(-4, 8, -8);
scene.add(rimLight);

const groundGeometry = new THREE.PlaneGeometry(300, 300);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x141b24,
  roughness: 0.9,
  metalness: 0.05,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_LEVEL;
ground.receiveShadow = true;
scene.add(ground);

const logoGeometry = new THREE.PlaneGeometry(1, 1);
const logoTexture = textureLoader.load(
  "/assets/png-clipart-seat-ateca-logo-car-seat-angle-text-removebg-preview.png",
  (texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const image = texture.image as { width?: number; height?: number } | null;
    if (image && typeof image.width === "number" && typeof image.height === "number") {
      logoAspect = image.width / image.height;
      updateLogoSize();
    }
  }
);
logoTexture.colorSpace = THREE.SRGBColorSpace;
const logoMaterial = new THREE.MeshBasicMaterial({
  map: logoTexture,
  transparent: true,
  depthWrite: false,
});
const logoPlane = new THREE.Mesh(logoGeometry, logoMaterial);
logoPlane.rotation.x = -Math.PI / 2;
logoPlane.position.y = 0.001;
logoPlane.renderOrder = 1;
scene.add(logoPlane);

const nameCanvas = document.createElement("canvas");
nameCanvas.width = 2048;
nameCanvas.height = 512;
const nameCtx = nameCanvas.getContext("2d");
if (nameCtx) {
  nameCtx.clearRect(0, 0, nameCanvas.width, nameCanvas.height);
  nameCtx.fillStyle = "rgba(0,0,0,0)";
  nameCtx.fillRect(0, 0, nameCanvas.width, nameCanvas.height);
  nameCtx.font = "bold 240px 'Space Grotesk', Arial, sans-serif";
  nameCtx.textAlign = "center";
  nameCtx.textBaseline = "middle";
  nameCtx.fillStyle = "rgba(20, 20, 20, 0.75)";
  nameCtx.fillText("Fathi", nameCanvas.width / 2, nameCanvas.height / 2);
  nameCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  nameCtx.lineWidth = 6;
  nameCtx.strokeText("Fathi", nameCanvas.width / 2, nameCanvas.height / 2);
}

const nameTexture = new THREE.CanvasTexture(nameCanvas);
nameTexture.colorSpace = THREE.SRGBColorSpace;
nameTexture.needsUpdate = true;
const namePlaneGeometry = new THREE.PlaneGeometry(4, 1);
const namePlaneMaterial = new THREE.MeshBasicMaterial({
  map: nameTexture,
  transparent: true,
  depthWrite: false,
});
const namePlane = new THREE.Mesh(namePlaneGeometry, namePlaneMaterial);
namePlane.rotation.x = -Math.PI / 2;
namePlane.position.set(0, 0.002, -3);
namePlane.renderOrder = 2;
scene.add(namePlane);

type StageLight = {
  group: THREE.Group;
  spot: THREE.SpotLight;
  baseIntensity: number;
  isOn: boolean;
};

const stageLightRig = new THREE.Group();
scene.add(stageLightRig);

const stageLights: StageLight[] = [];
const stageLightPickables: THREE.Object3D[] = [];
let stageLightTemplate: THREE.Object3D | null = null;
let stageLightsReady = false;
let stageLightStrength = DEFAULT_STAGE_LIGHT_STRENGTH;
let activeStageLight: StageLight | null = null;

ui.setLightStrength(stageLightStrength);

const stageLightPositions = [
  new THREE.Vector3(1.1, 0.9, 1.1),
  new THREE.Vector3(-1.2, 0.85, 1.0),
  new THREE.Vector3(1.0, 1.1, -1.1),
  new THREE.Vector3(-1.1, 1.0, -1.2),
  new THREE.Vector3(0.0, 1.6, 0.3),
];

const stageLightIntensities = [2.8, 2.2, 2.4, 2.0, 1.8];

const registerStageLightPickable = (
  object: THREE.Object3D,
  light: StageLight
) => {
  object.userData.stageLight = light;
  stageLightPickables.push(object);
};

const createFallbackStageLight = (group: THREE.Group) => {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b2430,
    roughness: 0.35,
    metalness: 0.5,
  });
  const bodyGeometry = new THREE.CylinderGeometry(0.14, 0.16, 0.28, 16);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const lensMaterial = new THREE.MeshStandardMaterial({
    color: 0x11151b,
    roughness: 0.2,
    metalness: 0.1,
  });
  const lensGeometry = new THREE.ConeGeometry(0.13, 0.18, 16);
  const lens = new THREE.Mesh(lensGeometry, lensMaterial);
  lens.position.z = -0.2;
  lens.rotation.x = Math.PI / 2;
  lens.castShadow = true;
  group.add(lens);

  return [body, lens];
};

const computeLightEmitter = (root: THREE.Object3D) => {
  let lens: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (lens) {
      return;
    }
    const name = (child.name || "").toLowerCase();
    if (name.includes("lens")) {
      lens = child;
    }
  });

  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());

  if (lens) {
    const lensObject = lens as THREE.Object3D;
    const lensWorld = new THREE.Vector3();
    lensObject.getWorldPosition(lensWorld);
    const dir = lensWorld.clone().sub(center);
    if (dir.lengthSq() < 1e-6) {
      lensObject.getWorldDirection(dir);
    }
    if (dir.lengthSq() < 1e-6) {
      dir.set(0, 0, -1);
    }
    dir.normalize();
    return { position: lensWorld, direction: dir };
  }

  const frontZ =
    Math.abs(bounds.min.z - center.z) > Math.abs(bounds.max.z - center.z)
      ? bounds.min.z
      : bounds.max.z;
  const direction = frontZ < center.z ? -1 : 1;
  return {
    position: new THREE.Vector3(center.x, center.y, frontZ),
    direction: new THREE.Vector3(0, 0, direction),
  };
};

const createStageLight = (
  name: string,
  baseIntensity: number,
  template: THREE.Object3D | null,
  castShadow: boolean
) => {
  const group = new THREE.Group();
  group.name = name;

  let modelObjects: THREE.Object3D[] = [];
  let modelRoot: THREE.Object3D | null = null;
  if (template) {
    const model = template.clone(true);
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    group.add(model);
    modelObjects = [model];
    modelRoot = model;
  } else {
    modelObjects = createFallbackStageLight(group);
    modelRoot = group;
  }

  const emitter = modelRoot ? computeLightEmitter(modelRoot) : null;

  const spot = new THREE.SpotLight(0xffffff, 0, 40, Math.PI / 7, 0.45, 1.0);
  spot.castShadow = castShadow;
  if (castShadow) {
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0002;
  }

  const target = new THREE.Object3D();
  group.add(spot, target);
  spot.target = target;

  if (emitter) {
    const localPosition = emitter.position.clone();
    const localTarget = emitter.position
      .clone()
      .add(emitter.direction.clone().multiplyScalar(1));
    group.worldToLocal(localPosition);
    group.worldToLocal(localTarget);
    spot.position.copy(localPosition);
    target.position.copy(localTarget);
  } else {
    spot.position.set(0, 0, 0);
    target.position.set(0, 0, -1);
  }

  const stageLight: StageLight = {
    group,
    spot,
    baseIntensity,
    isOn: false,
  };

  const hitSphereGeometry = new THREE.SphereGeometry(0.35, 12, 12);
  const hitSphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const hitSphere = new THREE.Mesh(hitSphereGeometry, hitSphereMaterial);
  hitSphere.position.set(0, 0, 0);
  group.add(hitSphere);

  modelObjects.forEach((object) => {
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        registerStageLightPickable(child, stageLight);
      }
    });
  });
  registerStageLightPickable(hitSphere, stageLight);

  stageLights.push(stageLight);
  stageLightRig.add(group);

  return stageLight;
};

const applyStageLightIntensity = (light: StageLight) => {
  light.spot.intensity = light.isOn
    ? light.baseIntensity * stageLightStrength
    : 0;
};

const setStageLightOn = (light: StageLight, on: boolean) => {
  light.isOn = on;
  applyStageLightIntensity(light);
};

const aimStageLights = (target: THREE.Vector3, scale: number) => {
  stageLights.forEach((light, index) => {
    const position = stageLightPositions[index].clone().multiplyScalar(scale);
    light.group.position.copy(position);
    light.group.lookAt(target);
    light.spot.distance = scale * 4.5;
    light.spot.target.updateMatrixWorld();
  });
};

const setupStageLights = () => {
  if (stageLightsReady) {
    return;
  }
  for (let i = 0; i < 5; i += 1) {
    const light = createStageLight(
      `StageLight_${i + 1}`,
      stageLightIntensities[i],
      stageLightTemplate,
      i < MAX_STAGE_SHADOW_LIGHTS
    );
    setStageLightOn(light, true);
  }
  stageLightsReady = true;
  if (modelReady) {
    aimStageLights(stageLightTarget, stageLightRigScale);
  }
};

const selectionTool = new SelectionTool();
const layersTool = new LayersTool();
const issuesTool = new IssuesTool(issuesAnchor, renderer);
const measureTool = new MeasureTool(scene, (distance) => {
  if (distance === null) {
    ui.setMeasureValue("-");
    return;
  }
  ui.setMeasureValue(`${distance.toFixed(2)} m (${distance.toFixed(2)} units)`);
});
const clippingTool = new ClippingTool(renderer);
const explodeTool = new ExplodeTool();
const moveTool = new MoveTool(camera, renderer.domElement);
moveTool.setTarget(modelPivot);
moveTool.setGroundHeight(GROUND_LEVEL);

let mode: Mode = "navigate";
let modelBounds: THREE.Box3 | null = null;
let modelSize = new THREE.Vector3();
let modelCenter = new THREE.Vector3();
let initialView: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
let meshes: THREE.Mesh[] = [];
let totalTriangles = 0;
let modelRoot: THREE.Object3D | null = null;
let rotateEnabled = false;
let logoAspect = 1;
let modelReady = false;
let explodeAmount = 0;
let modelAlignment:
  | { centerOffset: THREE.Vector3; pivotOffset: THREE.Vector3 }
  | null = null;
const modelPivotLast = new THREE.Vector3();
let stageLightRigScale = 6;
const stageLightTarget = new THREE.Vector3(0, 0.8, 0);
const THEME_KEY = "seat-ibiza-theme";
const themeColors = {
  dark: {
    background: new THREE.Color(0x0b0f14),
    ground: new THREE.Color(0x141b24),
  },
  light: {
    background: new THREE.Color(0xf5f7fb),
    ground: new THREE.Color(0xe9edf3),
  },
};

const applyTheme = (light: boolean) => {
  document.body.dataset.theme = light ? "light" : "dark";
  scene.background = light
    ? themeColors.light.background
    : themeColors.dark.background;
  groundMaterial.color.copy(
    light ? themeColors.light.ground : themeColors.dark.ground
  );
  ui.setTheme(light);
  localStorage.setItem(THEME_KEY, light ? "light" : "dark");
};

const sanitizeMaterial = (material: THREE.Material) => {
  const mat = material as THREE.MeshStandardMaterial;
  if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
    return;
  }
  if (!keepPbrTextures) {
    // Keep only base color map to stay within low texture unit limits.
    mat.normalMap = null;
    mat.roughnessMap = null;
    mat.metalnessMap = null;
    mat.aoMap = null;
    mat.lightMap = null;
    mat.emissiveMap = null;
    const physical = mat as THREE.MeshPhysicalMaterial;
    if ("clearcoatMap" in physical) {
      physical.clearcoatMap = null;
    }
    if ("clearcoatNormalMap" in physical) {
      physical.clearcoatNormalMap = null;
    }
    if ("clearcoatRoughnessMap" in physical) {
      physical.clearcoatRoughnessMap = null;
    }
    if ("sheenColorMap" in physical) {
      physical.sheenColorMap = null;
    }
    if ("sheenRoughnessMap" in physical) {
      physical.sheenRoughnessMap = null;
    }
    if ("iridescenceMap" in physical) {
      physical.iridescenceMap = null;
    }
    if ("iridescenceThicknessMap" in physical) {
      physical.iridescenceThicknessMap = null;
    }
    if ("specularIntensityMap" in physical) {
      physical.specularIntensityMap = null;
    }
    if ("specularColorMap" in physical) {
      physical.specularColorMap = null;
    }
    if ("transmissionMap" in physical) {
      physical.transmissionMap = null;
    }
    if ("thicknessMap" in physical) {
      physical.thicknessMap = null;
    }
    if ("envMap" in physical) {
      physical.envMap = null;
    }
  }
  mat.needsUpdate = true;
};

const updateLogoSize = () => {
  if (!modelBounds) {
    return;
  }
  const width = Math.max(0.8, modelSize.x * 0.45);
  const height = width / logoAspect;
  logoPlane.scale.set(width, height, 1);
  const offsetX = modelSize.x * 0.8 + width * 0.6;
  logoPlane.position.set(offsetX, 0.001, 0);
};

const setMode = (nextMode: Mode) => {
  mode = nextMode;
  ui.setMode(nextMode);
  const isMoveMode = nextMode === "move";
  moveTool.setEnabled(isMoveMode && !rotateEnabled);
  renderer.domElement.style.cursor =
    nextMode === "navigate" || isMoveMode ? "grab" : "crosshair";

  if (nextMode !== "clip") {
    clippingTool.disable();
  }

  if (nextMode === "navigate") {
    ui.setInstruction("Navigate: orbit with drag, zoom with scroll.");
  } else if (nextMode === "move") {
    ui.setInstruction("Move: drag the car across the ground plane.");
  } else if (nextMode === "select") {
    ui.setInstruction("Select: click a mesh to inspect properties.");
  } else if (nextMode === "issue") {
    ui.setInstruction("Issue: click the model to place an issue pin.");
  } else if (nextMode === "measure") {
    ui.setInstruction("Measure: click two points to measure distance.");
  } else if (nextMode === "clip") {
    ui.setInstruction("Clip: adjust the axis and slider to slice.");
    clippingTool.enable();
  }
  if (rotateEnabled) {
    ui.setInstruction("Rotate model: drag the X/Y/Z gizmo rings.");
  }
};

const getClipRange = (axis: ClipAxis) => {
  if (!modelBounds) {
    return { min: -1, max: 1, value: 0 };
  }
  const component = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const min = modelBounds.min.getComponent(component);
  const max = modelBounds.max.getComponent(component);
  const value = THREE.MathUtils.lerp(min, max, 0.5);
  return { min, max, value };
};

const updateClipRange = (axis: ClipAxis) => {
  const { min, max, value } = getClipRange(axis);
  ui.setClipRange(min, max, value);
  clippingTool.setAxis(axis);
  clippingTool.setValue(value);
};

const enforceCameraGroundLock = () => {
  const minY = GROUND_LEVEL + CAMERA_GROUND_CLEARANCE;
  let changed = false;

  if (controls.target.y < GROUND_LEVEL) {
    controls.target.y = GROUND_LEVEL;
    changed = true;
  }

  if (camera.position.y < minY) {
    camera.position.y = minY;
    changed = true;
  }

  if (changed) {
    controls.update();
  }
};

const resetAppState = () => {
  localStorage.clear();

  selectionTool.clear();
  ui.setSelection(null);

  issuesTool.clear();
  ui.setIssues([]);

  measureTool.clear();
  ui.setMeasureValue("-");

  explodeAmount = 0;
  explodeTool.reset();
  ui.setExplodeValue(0);

  layersTool.reset();
  ui.setLayerState(layersTool.getState());

  clippingTool.disable();
  updateClipRange("x");
  ui.setClipAxis("x");

  rotateEnabled = false;
  ui.setRotateActive(false);
  activeStageLight = null;
  transformControls.detach();
  transformControls.enabled = false;
  transformHelper.visible = false;
  setMode("navigate");
  moveTool.cancel();
  controls.enabled = true;

  stageLightStrength = DEFAULT_STAGE_LIGHT_STRENGTH;
  ui.setLightStrength(stageLightStrength);
  stageLights.forEach((light) => setStageLightOn(light, true));

  if (modelAlignment) {
    modelPivot.position.copy(modelAlignment.pivotOffset);
  } else {
    modelPivot.position.set(0, 0, 0);
  }
  modelPivot.updateMatrixWorld(true);
  stageLightRig.position.copy(modelPivot.position);
  modelPivotLast.copy(modelPivot.position);

  if (initialView) {
    camera.position.copy(initialView.position);
    controls.target.copy(initialView.target);
    controls.update();
  }

  applyTheme(DEFAULT_THEME_LIGHT);
};

ui.onModeChange = (nextMode) => {
  setMode(nextMode);
};

ui.onViewPreset = (preset) => {
  if (!modelBounds || !initialView) {
    return;
  }
  const target = modelCenter.clone();
  target.y += modelSize.y * 0.2;
  const distance = Math.max(modelSize.x, modelSize.y, modelSize.z) * 1.6;

  const setView = (position: THREE.Vector3, targetOverride?: THREE.Vector3) => {
    camera.position.copy(position);
    controls.target.copy(targetOverride ?? target);
    controls.update();
  };

  const viewVectors: Record<ViewPreset, THREE.Vector3> = {
    front: new THREE.Vector3(0, 0.3, 1),
    rear: new THREE.Vector3(0, 0.3, -1),
    side: new THREE.Vector3(1, 0.2, 0),
    top: new THREE.Vector3(0, 1, 0.01),
    interior: new THREE.Vector3(0, 0.2, 0.4),
    reset: initialView.position.clone(),
  };

  if (preset === "reset") {
    setView(initialView.position, initialView.target);
    return;
  }

  const dir = viewVectors[preset].clone().normalize();
  const position = target.clone().add(dir.multiplyScalar(distance));
  setView(position);
};

ui.onRotateToggle = (enabled) => {
  rotateEnabled = enabled;
  ui.setRotateActive(enabled);
  if (enabled) {
    activeStageLight = null;
    if (mode === "move") {
      setMode("navigate");
    }
  }
  updateTransformTarget();
  if (enabled) {
    ui.setInstruction("Rotate model: drag the X/Y/Z gizmo rings.");
  } else {
    setMode(mode);
  }
};

ui.onThemeToggle = (light) => {
  applyTheme(light);
};

ui.onResetApp = () => {
  resetAppState();
};

ui.onLightStrengthChange = (value) => {
  stageLightStrength = value;
  stageLights.forEach((light) => applyStageLightIntensity(light));
};

ui.onExplodeChange = (value) => {
  explodeAmount = value;
  explodeTool.setAmount(value);
};

ui.onExplodeReset = () => {
  explodeAmount = 0;
  explodeTool.reset();
  ui.setExplodeValue(0);
};

ui.onLayerToggle = (category, visible) => {
  layersTool.toggle(category, visible);
};

ui.onIssueExport = () => {
  const data = issuesTool.exportIssues();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "issues.json";
  link.click();
  URL.revokeObjectURL(link.href);
};

ui.onIssueClear = () => {
  issuesTool.clear();
  ui.setIssues([]);
};

ui.onIssueSelect = (issueId) => {
  issuesTool.focusIssue(issueId, ({ position, target }) => {
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
  });
};

ui.onMeasureClear = () => {
  measureTool.clear();
  ui.setMeasureValue("-");
};

ui.onClipAxisChange = (axis) => {
  updateClipRange(axis);
  if (mode === "clip") {
    clippingTool.enable();
  }
};

ui.onClipValueChange = (value) => {
  clippingTool.setValue(value);
};

ui.onClipDisable = () => {
  clippingTool.disable();
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown: { x: number; y: number; time: number } | null = null;
let pendingIssue: { point: THREE.Vector3; meshName: string } | null = null;

const computeBounds = (list: THREE.Mesh[]) => {
  const bounds = new THREE.Box3();
  list.forEach((mesh) => {
    const geometry = mesh.geometry;
    if (!geometry) {
      return;
    }
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    if (!geometry.boundingBox) {
      return;
    }
    const meshBox = geometry.boundingBox.clone();
    meshBox.applyMatrix4(mesh.matrixWorld);
    bounds.union(meshBox);
  });
  return bounds;
};

const getFilteredMinY = (list: THREE.Mesh[], overall: THREE.Box3) => {
  const size = overall.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  let minY = Number.POSITIVE_INFINITY;

  list.forEach((mesh) => {
    const name = (mesh.name || "").toLowerCase();
    if (/ground|floor|shadow|plane/.test(name)) {
      return;
    }
    const geometry = mesh.geometry;
    if (!geometry) {
      return;
    }
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    if (!geometry.boundingBox) {
      return;
    }
    const meshBox = geometry.boundingBox.clone();
    meshBox.applyMatrix4(mesh.matrixWorld);
    const meshSize = meshBox.getSize(new THREE.Vector3());
    const isLargeFlat =
      meshSize.y < maxDim * 0.02 &&
      (meshSize.x > maxDim * 1.5 || meshSize.z > maxDim * 1.5);
    if (isLargeFlat) {
      return;
    }
    const position = geometry.getAttribute("position");
    if (!position) {
      minY = Math.min(minY, meshBox.min.y);
      return;
    }
    const temp = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      temp.fromBufferAttribute(position, i);
      temp.applyMatrix4(mesh.matrixWorld);
      minY = Math.min(minY, temp.y);
    }
  });

  if (minY === Number.POSITIVE_INFINITY) {
    return overall.min.y;
  }
  return minY;
};

const applyModelAlignment = (root: THREE.Object3D, list: THREE.Mesh[]) => {
  root.position.set(0, 0, 0);
  if (modelAlignment) {
    root.position.sub(modelAlignment.centerOffset);
    modelPivot.position.copy(modelAlignment.pivotOffset);
    modelPivot.updateMatrixWorld(true);
    return;
  }

  // Compute and cache alignment once so proxy/high swaps do not shift the view.
  modelPivot.position.set(0, 0, 0);
  modelPivot.updateMatrixWorld(true);

  let bounds = computeBounds(list);
  bounds.getCenter(modelCenter);
  const centerOffset = modelCenter.clone();
  root.position.sub(centerOffset);
  root.updateMatrixWorld(true);

  bounds = computeBounds(list);
  const minY = getFilteredMinY(list, bounds);
  modelPivot.position.y = -minY;
  modelPivot.updateMatrixWorld(true);

  bounds = computeBounds(list);
  const correctedMinY = getFilteredMinY(list, bounds);
  if (Math.abs(correctedMinY) > 1e-4) {
    modelPivot.position.y -= correctedMinY;
    modelPivot.updateMatrixWorld(true);
  }

  modelAlignment = {
    centerOffset,
    pivotOffset: modelPivot.position.clone(),
  };
};

const rebuildModelState = (
  root: THREE.Object3D,
  list: THREE.Mesh[],
  stage: "proxy" | "high"
) => {
  modelRoot = modelPivot;
  meshes = list;
  totalTriangles = 0;

  meshes.forEach((mesh) => {
    mesh.castShadow = stage === "high";
    mesh.receiveShadow = stage === "high";
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => sanitizeMaterial(mat));
    } else if (mesh.material) {
      sanitizeMaterial(mesh.material);
    }

    const geometry = mesh.geometry;
    if (geometry) {
      if (FORCE_SMOOTH_NORMALS) {
        geometry.computeVertexNormals();
        geometry.normalizeNormals();
      }
      if (geometry.index) {
        totalTriangles += geometry.index.count / 3;
      } else {
        const position = geometry.getAttribute("position");
        if (position) {
          totalTriangles += position.count / 3;
        }
      }
    }
  });

  applyModelAlignment(root, meshes);
  modelPivot.updateMatrixWorld(true);

  modelBounds = computeBounds(meshes);
  modelBounds.getCenter(modelCenter);
  modelBounds.getSize(modelSize);

  updateLogoSize();

  const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  stageLightRigScale = Math.max(2.2, maxDim * 1.1);
  stageLightTarget.set(0, modelPivot.position.y + modelSize.y * 0.4, 0);
  modelReady = true;
  if (stageLightsReady) {
    aimStageLights(stageLightTarget, stageLightRigScale);
  }

  if (!initialView) {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.6;
    const viewDir = new THREE.Vector3(1, 0.6, 1).normalize();
    camera.position.copy(viewDir.multiplyScalar(distance));
    camera.near = Math.max(0.1, distance / 100);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    controls.target.set(0, modelSize.y * 0.2, 0);
    controls.update();

    initialView = {
      position: camera.position.clone(),
      target: controls.target.clone(),
    };
  }

  updateTransformTarget();

  layersTool.setMeshes(meshes);
  const state = layersTool.loadState();
  layersTool.applyVisibility();
  ui.setLayerState(state);

  clippingTool.setMeshes(meshes);
  updateClipRange("x");
  if (mode === "clip") {
    clippingTool.enable();
  }

  explodeTool.setModel(root, meshes, modelBounds);
  explodeTool.setAmount(explodeAmount);

  moveTool.setPickables(meshes);

  selectionTool.clear();
  ui.setSelection(null);
  ui.setIssues(issuesTool.getIssuesForUI());
  ui.setPerformance(0, totalTriangles);
};

const updateTransformTarget = () => {
  if (moveTool.isDragging()) {
    controls.enabled = false;
    return;
  }
  const target = activeStageLight
    ? activeStageLight.group
    : rotateEnabled && modelRoot
      ? modelRoot
      : null;
  if (target) {
    if (transformControls.object !== target) {
      transformControls.attach(target);
    }
    transformControls.enabled = true;
    transformHelper.visible = true;
    controls.enabled = false;
    return;
  }
  transformControls.detach();
  transformControls.enabled = false;
  transformHelper.visible = false;
  controls.enabled = true;
};

const selectStageLight = (light: StageLight) => {
  if (activeStageLight === light) {
    setStageLightOn(light, !light.isOn);
    return;
  }
  rotateEnabled = false;
  ui.setRotateActive(false);
  activeStageLight = light;
  setStageLightOn(light, true);
  updateTransformTarget();
  ui.setInstruction("Rotate light: drag the gizmo rings. Click empty space to exit.");
};

const clearStageLightSelection = () => {
  if (!activeStageLight) {
    return;
  }
  activeStageLight = null;
  updateTransformTarget();
  setMode(mode);
};

const getStageLightHit = (event: PointerEvent) => {
  if (stageLightPickables.length === 0) {
    return null;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(stageLightPickables, true);
  if (hits.length === 0) {
    return null;
  }
  const hit = hits[0].object as THREE.Object3D;
  return (hit.userData.stageLight as StageLight | undefined) ?? null;
};

const getIntersection = (event: PointerEvent) => {
  if (meshes.length === 0) {
    return null;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  return hits[0] ?? null;
};

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (transformControls.dragging) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  if (mode === "move") {
    const started = moveTool.onPointerDown(event);
    if (started) {
      controls.enabled = false;
    }
    return;
  }
  pointerDown = { x: event.clientX, y: event.clientY, time: Date.now() };
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (transformControls.dragging) {
    return;
  }
  if (mode === "move") {
    moveTool.onPointerMove(event);
  }
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (transformControls.dragging) {
    return;
  }
  if (mode === "move") {
    const ended = moveTool.onPointerUp();
    if (ended) {
      controls.enabled = true;
    }
    return;
  }
  if (!pointerDown) {
    return;
  }
  const distance = Math.hypot(
    event.clientX - pointerDown.x,
    event.clientY - pointerDown.y
  );
  const elapsed = Date.now() - pointerDown.time;
  pointerDown = null;
  if (distance > 6 || elapsed > 400) {
    return;
  }

  const lightHit = getStageLightHit(event);
  if (lightHit) {
    selectStageLight(lightHit);
    return;
  }
  clearStageLightSelection();

  const hit = getIntersection(event);

  if (mode === "select") {
    if (hit && hit.object instanceof THREE.Mesh) {
      const info = selectionTool.select(hit.object);
      ui.setSelection(info);
    } else {
      selectionTool.clear();
      ui.setSelection(null);
    }
    return;
  }

  if (mode === "issue") {
    if (!hit || pendingIssue) {
      return;
    }
    pendingIssue = {
      point: hit.point.clone(),
      meshName: hit.object.name || "Unnamed mesh",
    };
    issuesTool.setDraftPin(hit.point);
    ui.openIssueForm(
      (data) => {
        if (!pendingIssue) {
          return;
        }
        issuesTool.addIssue(data, pendingIssue.point, pendingIssue.meshName, {
          position: camera.position.clone(),
          target: controls.target.clone(),
        });
        pendingIssue = null;
        ui.setIssues(issuesTool.getIssuesForUI());
      },
      () => {
        pendingIssue = null;
        issuesTool.clearDraftPin();
      }
    );
    return;
  }

  if (mode === "measure") {
    if (hit) {
      measureTool.addPoint(hit.point);
    }
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  if (mode === "move") {
    moveTool.cancel();
    controls.enabled = true;
  }
});

const lightLoader = new GLTFLoader();
const modelUrl = "/models/seat_ibiza_2022.glb";
const proxyModelUrl = "/models/seat_ibiza_2022_proxy.glb";
const lightModelUrl = "/models/stage_light_zoom_spot.glb";
ui.setLoading("Loading preview...");
ui.setLodStatus("Loading preview...");

lightLoader.load(
  lightModelUrl,
  (gltf: GLTF) => {
    stageLightTemplate = gltf.scene;
    const box = new THREE.Box3().setFromObject(stageLightTemplate);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    stageLightTemplate.position.sub(center);
    if (size.y > 0) {
      const desiredHeight = 0.6;
      const scale = desiredHeight / size.y;
      stageLightTemplate.scale.setScalar(scale);
    }
    setupStageLights();
    if (modelReady) {
      aimStageLights(stageLightTarget, stageLightRigScale);
    }
  },
  undefined,
  () => {
    stageLightTemplate = null;
    setupStageLights();
  }
);

// Progressive LOD: proxy first, then high detail once the browser is idle.
const lodTool = new LodTool(
  {
    highUrl: modelUrl,
    proxyUrl: proxyModelUrl,
    modelPivot: modelContainer,
    hideInteriorOnProxy: true,
    fadeDurationMs: 800,
    idleDelayMs: 1400,
  },
  {
    onProxyShown: (root, list) => {
      rebuildModelState(root, list, "proxy");
      ui.setLoading("Low-detail preview loaded");
      ui.setLodStatus("Proxy loaded");
    },
    onHighShown: (root, list) => {
      rebuildModelState(root, list, "high");
      ui.setLoading("High-detail model loaded");
      ui.setLodStatus("High-detail loaded");
    },
    onStatus: (status) => {
      ui.setLoading(status);
    },
    onProgress: (value) => {
      if (value === null) {
        ui.setLoading("Loading high-detail model...");
        return;
      }
      ui.setLoading(`Loading high-detail model... ${value.toFixed(0)}%`);
    },
  }
);
lodTool.load();

const onResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
};

window.addEventListener("resize", onResize);

let fpsFrames = 0;
let fpsLast = performance.now();
let fpsAccum = 0;

const tick = () => {
  requestAnimationFrame(tick);
  updateTransformTarget();
  controls.update();
  enforceCameraGroundLock();
  if (modelReady) {
    if (!modelPivotLast.equals(modelPivot.position)) {
      stageLightRig.position.copy(modelPivot.position);
      modelPivotLast.copy(modelPivot.position);
    }
  }
  stageLights.forEach((light) => {
    light.spot.target.updateMatrixWorld();
  });
  renderer.render(scene, camera);

  const now = performance.now();
  const delta = now - fpsLast;
  fpsLast = now;
  fpsAccum += delta;
  fpsFrames += 1;

  if (fpsAccum >= 1000) {
    const fps = (fpsFrames * 1000) / fpsAccum;
    ui.setPerformance(fps, totalTriangles);
    fpsAccum = 0;
    fpsFrames = 0;
  }
};

setMode("navigate");
ui.setRotateActive(false);
ui.setSelection(null);
ui.setMeasureValue("-");
ui.setExplodeValue(0);
ui.setIssues(issuesTool.getIssuesForUI());

if (prefersReducedMotion) {
  ui.setInstruction("Reduced motion: orbiting is static, no damping.");
}

const storedTheme = localStorage.getItem(THEME_KEY);
applyTheme(storedTheme ? storedTheme === "light" : DEFAULT_THEME_LIGHT);

tick();
