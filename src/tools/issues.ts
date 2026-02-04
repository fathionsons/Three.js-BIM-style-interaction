import * as THREE from "three";

export type Severity = "Low" | "Medium" | "High";

export type IssueRecord = {
  id: string;
  title: string;
  severity: Severity;
  notes: string;
  timestamp: number;
  position: { x: number; y: number; z: number };
  camera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };
  meshName: string;
  thumbnailId?: string;
};

export type IssueUI = IssueRecord & { thumbnail?: string };

const ISSUE_KEY = "seat-ibiza-issues";
const THUMB_KEY = "seat-ibiza-issue-thumbs";

const severityColor: Record<Severity, number> = {
  Low: 0x6fdc8c,
  Medium: 0xf2c879,
  High: 0xf06a6a,
};

export class IssuesTool {
  private issues: IssueRecord[] = [];
  private thumbnails: Record<string, string> = {};
  private pins = new Map<string, THREE.Mesh>();
  private draftPin: THREE.Mesh | null = null;

  constructor(
    private parent: THREE.Object3D,
    private renderer: THREE.WebGLRenderer
  ) {
    this.load();
  }

  getIssuesForUI(): IssueUI[] {
    return this.issues.map((issue) => ({
      ...issue,
      thumbnail: issue.thumbnailId ? this.thumbnails[issue.thumbnailId] : undefined,
    }));
  }

  setDraftPin(point: THREE.Vector3) {
    this.clearDraftPin();
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x1f6feb,
      emissiveIntensity: 0.6,
    });
    const geometry = new THREE.SphereGeometry(0.04, 16, 16);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(point);
    mesh.castShadow = true;
    this.parent.add(mesh);
    this.draftPin = mesh;
  }

  clearDraftPin() {
    if (this.draftPin) {
      this.parent.remove(this.draftPin);
      this.draftPin.geometry.dispose();
      (this.draftPin.material as THREE.Material).dispose();
      this.draftPin = null;
    }
  }

  addIssue(
    input: { title: string; severity: Severity; notes: string },
    point: THREE.Vector3,
    meshName: string,
    view: { position: THREE.Vector3; target: THREE.Vector3 }
  ) {
    const id = `${Date.now()}-${Math.round(Math.random() * 10000)}`;
    const thumbnail = this.captureThumbnail();
    const thumbnailId = thumbnail ? id : undefined;
    if (thumbnailId && thumbnail) {
      this.thumbnails[thumbnailId] = thumbnail;
    }

    const issue: IssueRecord = {
      id,
      title: input.title,
      severity: input.severity,
      notes: input.notes,
      timestamp: Date.now(),
      position: { x: point.x, y: point.y, z: point.z },
      camera: {
        position: { x: view.position.x, y: view.position.y, z: view.position.z },
        target: { x: view.target.x, y: view.target.y, z: view.target.z },
      },
      meshName,
      thumbnailId,
    };

    this.issues.unshift(issue);
    this.persist();
    this.clearDraftPin();
    this.createPin(issue);
  }

  focusIssue(issueId: string, setView: (view: { position: THREE.Vector3; target: THREE.Vector3 }) => void) {
    const issue = this.issues.find((item) => item.id === issueId);
    if (!issue) {
      return;
    }
    const position = new THREE.Vector3(
      issue.camera.position.x,
      issue.camera.position.y,
      issue.camera.position.z
    );
    const target = new THREE.Vector3(
      issue.camera.target.x,
      issue.camera.target.y,
      issue.camera.target.z
    );
    setView({ position, target });
    this.flashPin(issueId);
  }

  exportIssues(): IssueRecord[] {
    return this.issues;
  }

  clear() {
    this.issues = [];
    this.thumbnails = {};
    this.persist();
    this.pins.forEach((pin) => {
      this.parent.remove(pin);
      pin.geometry.dispose();
      (pin.material as THREE.Material).dispose();
    });
    this.pins.clear();
  }

  private createPin(issue: IssueRecord) {
    const geometry = new THREE.SphereGeometry(0.05, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: severityColor[issue.severity],
      emissive: severityColor[issue.severity],
      emissiveIntensity: 0.4,
    });
    const pin = new THREE.Mesh(geometry, material);
    pin.position.set(issue.position.x, issue.position.y, issue.position.z);
    pin.castShadow = true;
    this.parent.add(pin);
    this.pins.set(issue.id, pin);
  }

  private flashPin(issueId: string) {
    const pin = this.pins.get(issueId);
    if (!pin) {
      return;
    }
    const material = pin.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 1.2;
    setTimeout(() => {
      material.emissiveIntensity = 0.4;
    }, 300);
  }

  private captureThumbnail(): string | undefined {
    try {
      return this.renderer.domElement.toDataURL("image/png");
    } catch {
      return undefined;
    }
  }

  private persist() {
    localStorage.setItem(ISSUE_KEY, JSON.stringify(this.issues));
    localStorage.setItem(THUMB_KEY, JSON.stringify(this.thumbnails));
  }

  private load() {
    const raw = localStorage.getItem(ISSUE_KEY);
    if (raw) {
      try {
        this.issues = JSON.parse(raw) as IssueRecord[];
      } catch {
        this.issues = [];
      }
    }
    const thumbRaw = localStorage.getItem(THUMB_KEY);
    if (thumbRaw) {
      try {
        this.thumbnails = JSON.parse(thumbRaw) as Record<string, string>;
      } catch {
        this.thumbnails = {};
      }
    }

    this.issues.forEach((issue) => this.createPin(issue));
  }
}
