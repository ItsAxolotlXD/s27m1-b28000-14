import { useSyncExternalStore } from "react";

export const SPARKLE_DRAG_MIME = "application/x-sparkle-drag";

export type SparkleDragKind =
  | "app"
  | "explorer-entry"
  | "directory"
  | "note"
  | "html-file"
  | "gallery-item"
  | "channel"
  | "winui-project"
  | "setting"
  | "start-folder";

export interface SparkleDragAppPayload {
  kind: "app";
  id: string;
  label: string;
  route?: string | undefined;
  externalUrl?: string | undefined;
  startAppId?: string | undefined;
  iconKey?: string | undefined;
  accentColor?: string | undefined;
}

export interface ExplorerEntryDragSnapshot {
  id: string;
  parentId: string;
  name: string;
  explorerKind: string;
  sizeBytes?: number | undefined;
  modifiedAt: number;
  locationLabel: string;
  pathLabel: string;
  status?: "synced" | "cloud" | "local" | undefined;
  thumbnailUrl?: string | undefined;
  mediaUrl?: string | undefined;
  mimeType?: string | undefined;
  fileExtension?: string | undefined;
  isBinary?: boolean | undefined;
  dimensions?: { width: number; height: number } | undefined;
  textContent?: string | undefined;
  targetRoute?: string | undefined;
  targetRouteState?: unknown;
  linkedSource?: "custom" | "gallery" | "notes" | "html-writer" | "notepad" | "system" | undefined;
  linkedId?: string | undefined;
  driveLetter?: string | undefined;
  driveUsedGb?: number | undefined;
  driveTotalGb?: number | undefined;
  targetDirId?: string | undefined;
  isImportedFromDevice?: boolean | undefined;
}

export interface SparkleDragExplorerPayload {
  kind: "explorer-entry";
  entry: ExplorerEntryDragSnapshot;
}

export interface SparkleDragDirectoryPayload {
  kind: "directory";
  dirId: string;
  name: string;
  pathLabel?: string | undefined;
  iconKind?: string | undefined;
}

export interface SparkleDragNotePayload {
  kind: "note";
  noteId: string;
  title: string;
  updatedAt?: number | undefined;
}

export interface SparkleDragHtmlFilePayload {
  kind: "html-file";
  fileId: string;
  name: string;
  content: string;
  updatedAt?: number | undefined;
}

export interface SparkleDragGalleryPayload {
  kind: "gallery-item";
  itemId: string;
  title: string;
  mediaType: "image" | "video" | "audio" | "document";
  thumbnailUrl?: string | undefined;
  url?: string | undefined;
  size?: number | undefined;
  dateAdded?: string | undefined;
  mimeType?: string | undefined;
}

export interface SparkleDragChannelPayload {
  kind: "channel";
  channelId: string;
  name: string;
  slug: string;
  logo?: string | undefined;
  category?: string | undefined;
}

export interface SparkleDragWinUIProjectPayload {
  kind: "winui-project";
  projectId: string;
  name: string;
  description?: string | undefined;
}

export interface SparkleDragSettingPayload {
  kind: "setting";
  id: string;
  label: string;
  route: string;
  category?: string | undefined;
  subtitle?: string | undefined;
}

export interface SparkleDragStartFolderPayload {
  kind: "start-folder";
  folderId: string;
  name: string;
  appIds: string[];
}

export type SparkleDragPayload =
  | SparkleDragAppPayload
  | SparkleDragExplorerPayload
  | SparkleDragDirectoryPayload
  | SparkleDragNotePayload
  | SparkleDragHtmlFilePayload
  | SparkleDragGalleryPayload
  | SparkleDragChannelPayload
  | SparkleDragWinUIProjectPayload
  | SparkleDragSettingPayload
  | SparkleDragStartFolderPayload;

export interface ActiveDragState {
  payload: SparkleDragPayload | null;
  hasExternalFiles: boolean;
}

let activeState: ActiveDragState = { payload: null, hasExternalFiles: false };
let externalDragDepth = 0;
let globalListenersAttached = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function getSparkleDragLabel(payload: SparkleDragPayload): string {
  switch (payload.kind) {
    case "app":
      return payload.label;
    case "explorer-entry":
      return payload.entry.name;
    case "directory":
      return payload.name;
    case "note":
      return payload.title || "Untitled Note";
    case "html-file":
      return payload.name;
    case "gallery-item":
      return payload.title;
    case "channel":
      return payload.name;
    case "winui-project":
      return payload.name;
    case "setting":
      return payload.label;
    case "start-folder":
      return payload.name;
  }
}

export function setActiveSparkleDrag(payload: SparkleDragPayload | null) {
  activeState = { ...activeState, payload };
  notifyListeners();
}

export function getActiveSparkleDrag(): SparkleDragPayload | null {
  return activeState.payload;
}

export function clearSparkleDrag() {
  externalDragDepth = 0;
  if (activeState.payload !== null || activeState.hasExternalFiles) {
    activeState = { payload: null, hasExternalFiles: false };
    notifyListeners();
  }
}

export function hasExternalDeviceFiles(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false;
  if (activeState.payload !== null) return false;
  if (dt.types && Array.from(dt.types).includes(SPARKLE_DRAG_MIME)) return false;
  if (dt.types && Array.from(dt.types).includes("Files")) return true;
  return Boolean(dt.files && dt.files.length > 0);
}

export function hasSparkleOrExternalDrag(dt: DataTransfer | null | undefined): boolean {
  if (activeState.payload !== null) return true;
  if (!dt) return false;
  const types = dt.types ? Array.from(dt.types) : [];
  return types.includes(SPARKLE_DRAG_MIME) || types.includes("Files");
}

export function ensureGlobalDragTracking() {
  if (globalListenersAttached || typeof window === "undefined") return;
  globalListenersAttached = true;

  const isPureExternalFileEvent = (e: DragEvent) => {
    const dt = e.dataTransfer;
    if (!dt) return false;
    const types = Array.from(dt.types || []);
    return types.includes("Files") && !types.includes(SPARKLE_DRAG_MIME) && !activeState.payload;
  };

  window.addEventListener("dragenter", (e) => {
    if (isPureExternalFileEvent(e)) {
      externalDragDepth += 1;
      if (!activeState.hasExternalFiles) {
        activeState = { ...activeState, hasExternalFiles: true };
        notifyListeners();
      }
    }
  });

  window.addEventListener("dragleave", (e) => {
    if (activeState.hasExternalFiles) {
      externalDragDepth = Math.max(0, externalDragDepth - 1);
      if (externalDragDepth === 0 || (e.clientX === 0 && e.clientY === 0)) {
        externalDragDepth = 0;
        activeState = { ...activeState, hasExternalFiles: false };
        notifyListeners();
      }
    }
  });

  window.addEventListener("dragend", () => {
    clearSparkleDrag();
  });

  window.addEventListener("drop", () => {
    // Allow local drop handlers on capture/bubble phase to read activeState before clearing
    window.setTimeout(() => {
      clearSparkleDrag();
    }, 0);
  });
}

export interface BeginSparkleDragOptions {
  /** Keep Start Menu / internal text/plain payload untouched instead of overwriting with label */
  preserveTextPlain?: boolean;
  /** Override effectAllowed (defaults to copyMove) */
  effectAllowed?: DataTransfer["effectAllowed"];
}

export function beginSparkleDrag(
  e: React.DragEvent<HTMLElement>,
  payload: SparkleDragPayload,
  opts?: BeginSparkleDragOptions,
) {
  ensureGlobalDragTracking();
  setActiveSparkleDrag(payload);
  try {
    e.dataTransfer.effectAllowed = opts?.effectAllowed ?? "copyMove";
    e.dataTransfer.setData(SPARKLE_DRAG_MIME, JSON.stringify(payload));
    if (!opts?.preserveTextPlain) {
      e.dataTransfer.setData("text/plain", getSparkleDragLabel(payload));
    }
  } catch {
    // Some browsers disallow writing custom MIME types in restricted contexts; module singleton covers it
  }
}

export function parseSparkleDrag(dt: DataTransfer | null | undefined): SparkleDragPayload | null {
  if (dt) {
    try {
      const raw = dt.getData(SPARKLE_DRAG_MIME);
      if (raw) {
        const parsed = JSON.parse(raw) as SparkleDragPayload;
        if (parsed && typeof parsed === "object" && "kind" in parsed) {
          return parsed;
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return activeState.payload;
}

export function notifyDesktopDropCompleted() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sparkle:desktop-drop-complete"));
  }
}

export function useSparkleDragState(): ActiveDragState {
  return useSyncExternalStore(
    (cb) => {
      ensureGlobalDragTracking();
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => activeState,
    () => activeState,
  );
}
