import type { Category, SelectionInfo } from "./tools/selection";
import type { Severity, IssueUI } from "./tools/issues";
import type { ClipAxis } from "./tools/clipping";

export type Mode = "navigate" | "select" | "issue" | "measure" | "clip";
export type ViewPreset = "front" | "side" | "rear" | "top" | "interior" | "reset";

export type IssueFormData = {
  title: string;
  severity: Severity;
  notes: string;
};

export class UI {
  private loadingEl: HTMLSpanElement;
  private instructionEl: HTMLDivElement;
  private modeButtons: HTMLButtonElement[];
  private viewButtons: HTMLButtonElement[];
  private layerInputs: HTMLInputElement[];
  private rotateButton: HTMLButtonElement;
  private themeToggle: HTMLButtonElement;
  private issueForm: HTMLDivElement;
  private issueTitle: HTMLInputElement;
  private issueSeverity: HTMLSelectElement;
  private issueNotes: HTMLTextAreaElement;
  private issueMessage: HTMLDivElement;
  private issuesList: HTMLDivElement;
  private clipSlider: HTMLInputElement;
  private clipAxisInputs: HTMLInputElement[];
  private measureHint: HTMLDivElement;
  private measureValue: HTMLSpanElement;
  private fpsValue: HTMLSpanElement;
  private trianglesValue: HTMLSpanElement;
  private lightStrengthInput: HTMLInputElement;
  private lightStrengthValue: HTMLSpanElement;

  onModeChange?: (mode: Mode) => void;
  onViewPreset?: (preset: ViewPreset) => void;
  onLayerToggle?: (category: Category, visible: boolean) => void;
  onIssueExport?: () => void;
  onIssueClear?: () => void;
  onIssueSelect?: (issueId: string) => void;
  onMeasureClear?: () => void;
  onClipAxisChange?: (axis: ClipAxis) => void;
  onClipValueChange?: (value: number) => void;
  onClipDisable?: () => void;
  onRotateToggle?: (enabled: boolean) => void;
  onThemeToggle?: (light: boolean) => void;
  onLightStrengthChange?: (value: number) => void;

  private issueFormCallbacks:
    | { onSave: (data: IssueFormData) => void; onCancel: () => void }
    | null = null;

  constructor() {
    this.loadingEl = this.getEl("#loading");
    this.instructionEl = this.getEl("#instruction");
    this.modeButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[data-mode]")
    );
    this.viewButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[data-view]")
    );
    this.rotateButton = this.getEl("#model-rotate");
    this.themeToggle = this.getEl("#theme-toggle");
    this.layerInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[data-layer]")
    );
    this.issueForm = this.getEl("#issue-form");
    this.issueTitle = this.getEl("#issue-title");
    this.issueSeverity = this.getEl("#issue-severity");
    this.issueNotes = this.getEl("#issue-notes");
    this.issueMessage = this.getEl("#issue-message");
    this.issuesList = this.getEl("#issues-list");
    this.clipSlider = this.getEl("#clip-slider");
    this.clipAxisInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[name='clip-axis']")
    );
    this.measureHint = this.getEl("#measure-hint");
    this.measureValue = this.getEl("#measure-value");
    this.fpsValue = this.getEl("#fps");
    this.trianglesValue = this.getEl("#triangles");
    this.lightStrengthInput = this.getEl("#light-strength");
    this.lightStrengthValue = this.getEl("#light-strength-value");

    this.bindUI();
  }

  setLoading(text: string) {
    this.loadingEl.textContent = text;
  }

  setInstruction(text: string) {
    this.instructionEl.textContent = text;
  }

  setMode(mode: Mode) {
    this.modeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === mode);
    });
  }

  setRotateActive(active: boolean) {
    this.rotateButton.classList.toggle("is-active", active);
  }

  setTheme(isLight: boolean) {
    this.themeToggle.setAttribute("aria-pressed", String(isLight));
    this.themeToggle.textContent = isLight ? "Dark Mode" : "Light Mode";
    const indicator = document.createElement("span");
    indicator.className = "theme-indicator";
    this.themeToggle.appendChild(indicator);
  }

  setSelection(info: SelectionInfo | null) {
    const nameEl = this.getEl("#sel-name");
    const categoryEl = this.getEl("#sel-category");
    const statusEl = this.getEl("#sel-status");
    const materialEl = this.getEl("#sel-material");
    const trianglesEl = this.getEl("#sel-triangles");
    const notesEl = this.getEl("#sel-notes") as HTMLTextAreaElement;

    if (!info) {
      nameEl.textContent = "None";
      categoryEl.textContent = "-";
      statusEl.textContent = "-";
      materialEl.textContent = "-";
      trianglesEl.textContent = "-";
      notesEl.value = "";
      return;
    }

    nameEl.textContent = info.name;
    categoryEl.textContent = info.category;
    statusEl.textContent = info.status;
    materialEl.textContent = info.material ?? "-";
    trianglesEl.textContent = info.triangles ? `${info.triangles}` : "-";
    notesEl.value = info.notes ?? "";
  }

  setLayerState(state: Record<Category, boolean>) {
    this.layerInputs.forEach((input) => {
      const category = input.dataset.layer as Category | undefined;
      if (!category) {
        return;
      }
      input.checked = Boolean(state[category]);
    });
  }

  setIssues(issues: IssueUI[]) {
    this.issuesList.innerHTML = "";
    if (issues.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No issues yet.";
      this.issuesList.appendChild(empty);
      return;
    }

    issues.forEach((issue) => {
      const card = document.createElement("div");
      card.className = "issue-card";
      card.dataset.issueId = issue.id;

      const img = document.createElement("img");
      img.src =
        issue.thumbnail ??
        "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";
      img.alt = issue.title;

      const body = document.createElement("div");
      const title = document.createElement("div");
      title.className = "issue-card__title";
      title.textContent = issue.title;

      const meta = document.createElement("div");
      meta.className = "issue-card__meta";
      meta.textContent = new Date(issue.timestamp).toLocaleString();

      const badge = document.createElement("div");
      badge.className = `severity-badge severity-${issue.severity.toLowerCase()}`;
      badge.textContent = issue.severity;

      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(badge);

      card.appendChild(img);
      card.appendChild(body);

      card.addEventListener("click", () => {
        this.onIssueSelect?.(issue.id);
      });

      this.issuesList.appendChild(card);
    });
  }

  openIssueForm(onSave: (data: IssueFormData) => void, onCancel: () => void) {
    this.issueFormCallbacks = { onSave, onCancel };
    this.issueForm.classList.remove("is-hidden");
    this.issueMessage.textContent = "";
    this.issueTitle.value = "";
    this.issueNotes.value = "";
    this.issueSeverity.value = "Medium";
    this.issueTitle.focus();
  }

  closeIssueForm() {
    this.issueFormCallbacks = null;
    this.issueForm.classList.add("is-hidden");
    this.issueMessage.textContent = "";
  }

  setMeasureHint(text: string) {
    this.measureHint.textContent = text;
  }

  setMeasureValue(text: string) {
    this.measureValue.textContent = text;
  }

  setPerformance(fps: number, triangles: number) {
    this.fpsValue.textContent = fps.toFixed(1);
    this.trianglesValue.textContent = triangles.toLocaleString();
  }

  setClipRange(min: number, max: number, value: number) {
    this.clipSlider.min = min.toString();
    this.clipSlider.max = max.toString();
    this.clipSlider.value = value.toString();
  }

  setClipAxis(axis: ClipAxis) {
    this.clipAxisInputs.forEach((input) => {
      input.checked = input.value === axis;
    });
  }

  setLightStrength(value: number) {
    this.lightStrengthInput.value = value.toFixed(2);
    this.lightStrengthValue.textContent = `${value.toFixed(2)}x`;
  }

  private bindUI() {
    this.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode as Mode | undefined;
        if (mode) {
          this.onModeChange?.(mode);
        }
      });
    });

    this.viewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const preset = button.dataset.view as ViewPreset | undefined;
        if (preset) {
          this.onViewPreset?.(preset);
        }
      });
    });

    this.rotateButton.addEventListener("click", () => {
      const nextState = !this.rotateButton.classList.contains("is-active");
      this.onRotateToggle?.(nextState);
    });

    this.themeToggle.addEventListener("click", () => {
      const isLight = this.themeToggle.getAttribute("aria-pressed") === "true";
      this.onThemeToggle?.(!isLight);
    });

    this.layerInputs.forEach((input) => {
      input.addEventListener("change", () => {
        const category = input.dataset.layer as Category | undefined;
        if (category) {
          this.onLayerToggle?.(category, input.checked);
        }
      });
    });

    this.getEl("#issues-export").addEventListener("click", () => {
      this.onIssueExport?.();
    });

    this.getEl("#issues-clear").addEventListener("click", () => {
      this.onIssueClear?.();
    });

    this.getEl("#measure-clear").addEventListener("click", () => {
      this.onMeasureClear?.();
    });

    this.getEl("#clip-disable").addEventListener("click", () => {
      this.onClipDisable?.();
    });

    this.clipAxisInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) {
          this.onClipAxisChange?.(input.value as ClipAxis);
        }
      });
    });

    this.clipSlider.addEventListener("input", () => {
      this.onClipValueChange?.(Number(this.clipSlider.value));
    });

    this.lightStrengthInput.addEventListener("input", () => {
      const value = Number(this.lightStrengthInput.value);
      this.lightStrengthValue.textContent = `${value.toFixed(2)}x`;
      this.onLightStrengthChange?.(value);
    });

    this.getEl("#issue-save").addEventListener("click", () => {
      if (!this.issueFormCallbacks) {
        return;
      }
      const title = this.issueTitle.value.trim();
      if (!title) {
        this.issueMessage.textContent = "Title is required.";
        return;
      }
      this.issueMessage.textContent = "";
      this.issueFormCallbacks.onSave({
        title,
        severity: this.issueSeverity.value as Severity,
        notes: this.issueNotes.value.trim(),
      });
      this.closeIssueForm();
    });

    this.getEl("#issue-cancel").addEventListener("click", () => {
      if (this.issueFormCallbacks) {
        this.issueFormCallbacks.onCancel();
      }
      this.closeIssueForm();
    });
  }

  private getEl<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) {
      throw new Error(`Missing element: ${selector}`);
    }
    return el;
  }
}
