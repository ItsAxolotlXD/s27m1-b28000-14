import { useSyncExternalStore } from "react";
import {
  readCustomFsEntries,
  writeCustomFsEntries,
  readHiddenSystemIds,
  hideSystemEntry,
  SEEDED_DESKTOP_ENTRIES,
  type SharedExplorerEntry,
  type SharedExplorerItemKind,
} from "../utils/deviceFileImport";
import { getStartAppIdForRoute } from "../components/StartAppIcons";
import { useInstalledWinUIApps } from "./installedWinUIAppsStore";
import type { SparkleDragPayload } from "../utils/sparkleDrag";

export const DESKTOP_SHORTCUTS_KEY = "sparkle_desktop_items_v1";
export const DESKTOP_ORDER_KEY = "sparkle_desktop_order_v1";

export type DesktopSortMode = "name" | "size" | "type" | "modified";

export type DesktopItemKind =
  | "app"
  | "folder"
  | "start-folder"
  | "note"
  | "html-file"
  | "gallery-item"
  | "channel"
  | "winui-project"
  | "setting"
  | "fs-entry";

export interface DesktopShortcutRecord {
  id: string;
  kind: Exclude<DesktopItemKind, "fs-entry">;
  name: string;
  modifiedAt: number;
  sizeBytes?: number | undefined;
  /** Target navigation route */
  route?: string | undefined;
  routeState?: unknown;
  externalUrl?: string | undefined;
  startAppId?: string | undefined;
  iconKey?: string | undefined;
  accentColor?: string | undefined;
  /** Directory or Explorer navigation */
  dirId?: string | undefined;
  pathLabel?: string | undefined;
  dirIconKind?: string | undefined;
  /** Entity links */
  noteId?: string | undefined;
  htmlFileId?: string | undefined;
  htmlContent?: string | undefined;
  galleryItemId?: string | undefined;
  galleryMediaType?: "image" | "video" | "audio" | "document" | undefined;
  thumbnailUrl?: string | undefined;
  mediaUrl?: string | undefined;
  channelId?: string | undefined;
  channelSlug?: string | undefined;
  channelLogo?: string | undefined;
  projectId?: string | undefined;
  startFolderAppIds?: string[] | undefined;
  settingCategory?: string | undefined;
  /** Deduplication key for non-file shortcuts */
  dedupeKey?: string | undefined;
}

export interface DesktopItem {
  id: string;
  name: string;
  kind: DesktopItemKind;
  source: "fs-custom" | "fs-seeded" | "shortcut";
  modifiedAt: number;
  sizeBytes: number;
  isShortcut: boolean;
  /** Explorer entry when backed by FS */
  fsEntry?: SharedExplorerEntry | undefined;
  /** Shortcut record when backed by shortcut store */
  shortcut?: DesktopShortcutRecord | undefined;
}

function readJsonArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function readDesktopShortcuts(): DesktopShortcutRecord[] {
  return readJsonArray<DesktopShortcutRecord>(DESKTOP_SHORTCUTS_KEY);
}

export function writeDesktopShortcuts(next: DesktopShortcutRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DESKTOP_SHORTCUTS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  notifyDesktopListeners();
}

export function readDesktopOrder(): string[] {
  return readJsonArray<string>(DESKTOP_ORDER_KEY).filter(
    (id): id is string => typeof id === "string",
  );
}

export function writeDesktopOrder(order: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DESKTOP_ORDER_KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
  notifyDesktopListeners();
}

function buildDedupeKey(payload: SparkleDragPayload): string | null {
  switch (payload.kind) {
    case "app":
      return `app:${payload.startAppId || payload.route || payload.externalUrl || payload.id}`;
    case "directory":
      return `dir:${payload.dirId}`;
    case "note":
      return `note:${payload.noteId}`;
    case "html-file":
      return `html:${payload.fileId}`;
    case "gallery-item":
      return `gal:${payload.itemId}`;
    case "channel":
      return `chan:${payload.channelId}`;
    case "winui-project":
      return `winui:${payload.projectId}`;
    case "setting":
      return `setting:${payload.route}:${payload.category || payload.id}`;
    case "start-folder":
      return `sfolder:${payload.folderId}`;
    case "explorer-entry":
      return `fs-ref:${payload.entry.id}`;
  }
}

export interface AddToDesktopResult {
  itemId: string;
  name: string;
  alreadyExisted: boolean;
}

export function addSparkleDragToDesktop(
  payload: SparkleDragPayload,
  insertIndex?: number,
): AddToDesktopResult {
  const shortcuts = readDesktopShortcuts();
  const order = readDesktopOrder();
  const dedupeKey = buildDedupeKey(payload);

  // If Explorer entry is dropped onto Desktop:
  if (payload.kind === "explorer-entry") {
    const entry = payload.entry;
    const isFolder = entry.explorerKind === "folder" || entry.explorerKind === "drive";

    if (isFolder) {
      const targetDirId = entry.targetDirId || entry.id;
      const folderDedupe = `dir:${targetDirId}`;
      const existingShortcut = shortcuts.find((s) => s.dedupeKey === folderDedupe);
      if (existingShortcut) {
        return { itemId: existingShortcut.id, name: existingShortcut.name, alreadyExisted: true };
      }
      const newId = `desk-sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const record: DesktopShortcutRecord = {
        id: newId,
        kind: "folder",
        name: entry.name,
        modifiedAt: Date.now(),
        sizeBytes: 0,
        route: "/file-explorer",
        dirId: targetDirId,
        pathLabel: entry.pathLabel,
        dedupeKey: folderDedupe,
      };
      writeDesktopShortcuts([...shortcuts, record]);
      placeInDesktopOrder(newId, insertIndex, order);
      return { itemId: newId, name: entry.name, alreadyExisted: false };
    }

    // Check if this entry already lives on Desktop FS
    const currentFs = readCustomFsEntries();
    if (
      entry.parentId === "dir-desktop" &&
      currentFs.some((e) => e.id === entry.id && e.parentId === "dir-desktop")
    ) {
      return { itemId: entry.id, name: entry.name, alreadyExisted: true };
    }

    // If linked to an app shortcut (.lnk) or system route
    if (entry.explorerKind === "app" && entry.targetRoute) {
      const appDedupe = `app:${entry.targetRoute}`;
      const existingApp = shortcuts.find((s) => s.dedupeKey === appDedupe);
      if (existingApp) {
        return { itemId: existingApp.id, name: existingApp.name, alreadyExisted: true };
      }
      const startAppId = getStartAppIdForRoute(entry.targetRoute);
      const newId = `desk-sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const record: DesktopShortcutRecord = {
        id: newId,
        kind: "app",
        name: entry.name.replace(/\.lnk$/i, ""),
        modifiedAt: Date.now(),
        sizeBytes: 4096,
        route: entry.targetRoute,
        startAppId,
        dedupeKey: appDedupe,
      };
      writeDesktopShortcuts([...shortcuts, record]);
      placeInDesktopOrder(newId, insertIndex, order);
      return { itemId: newId, name: record.name, alreadyExisted: false };
    }

    // If backed by custom FS file, copy it cleanly onto Desktop FS (`dir-desktop`)
    if (entry.linkedSource === "custom" || entry.linkedSource === "system") {
      const desktopNames = new Set(
        currentFs.filter((e) => e.parentId === "dir-desktop").map((e) => e.name.toLowerCase()),
      );
      if (desktopNames.has(entry.name.toLowerCase())) {
        const existingItem = currentFs.find(
          (e) => e.parentId === "dir-desktop" && e.name.toLowerCase() === entry.name.toLowerCase(),
        );
        if (existingItem) {
          return { itemId: existingItem.id, name: existingItem.name, alreadyExisted: true };
        }
      }
      const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const copied: SharedExplorerEntry = {
        id: newId,
        parentId: "dir-desktop",
        name: entry.name,
        kind: (entry.explorerKind as SharedExplorerItemKind) || "file",
        sizeBytes: entry.sizeBytes ?? 1024,
        modifiedAt: Date.now(),
        locationLabel: "Desktop",
        pathLabel: `C:\\Users\\Sparkle\\Desktop\\${entry.name}`,
        status: entry.status ?? "local",
        linkedSource: "custom",
      };
      if (entry.thumbnailUrl) copied.thumbnailUrl = entry.thumbnailUrl;
      if (entry.mediaUrl) copied.mediaUrl = entry.mediaUrl;
      if (entry.mimeType) copied.mimeType = entry.mimeType;
      if (entry.fileExtension) copied.fileExtension = entry.fileExtension;
      if (entry.isBinary !== undefined) copied.isBinary = entry.isBinary;
      if (entry.dimensions) copied.dimensions = entry.dimensions;
      if (entry.textContent !== undefined) copied.textContent = entry.textContent;
      if (entry.targetRoute) copied.targetRoute = entry.targetRoute;
      if (entry.targetRouteState !== undefined) copied.targetRouteState = entry.targetRouteState;
      if (entry.isImportedFromDevice) copied.isImportedFromDevice = entry.isImportedFromDevice;

      writeCustomFsEntries([copied, ...currentFs]);
      placeInDesktopOrder(newId, insertIndex, order);
      return { itemId: newId, name: copied.name, alreadyExisted: false };
    }

    // Linked Gallery / Note / HTML Writer entries become linked shortcuts
    if (entry.linkedSource === "notes" && entry.linkedId) {
      return addSparkleDragToDesktop(
        { kind: "note", noteId: entry.linkedId, title: entry.name.replace(/\.note$/i, "") },
        insertIndex,
      );
    }
    if (entry.linkedSource === "html-writer" && entry.linkedId) {
      return addSparkleDragToDesktop(
        {
          kind: "html-file",
          fileId: entry.linkedId,
          name: entry.name,
          content: entry.textContent || "",
          updatedAt: entry.modifiedAt,
        },
        insertIndex,
      );
    }
    if (entry.linkedSource === "gallery" && entry.linkedId) {
      const mType =
        entry.explorerKind === "video" ||
        entry.explorerKind === "audio" ||
        entry.explorerKind === "image"
          ? entry.explorerKind
          : "document";
      return addSparkleDragToDesktop(
        {
          kind: "gallery-item",
          itemId: entry.linkedId,
          title: entry.name,
          mediaType: mType,
          thumbnailUrl: entry.thumbnailUrl,
          url: entry.mediaUrl,
          size: entry.sizeBytes,
        },
        insertIndex,
      );
    }
  }

  // Deduplicate shortcuts (apps, folders, channels, notes, etc.)
  if (dedupeKey) {
    const existing = shortcuts.find((s) => s.dedupeKey === dedupeKey);
    if (existing) {
      return { itemId: existing.id, name: existing.name, alreadyExisted: true };
    }
  }

  const newId = `desk-sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let record: DesktopShortcutRecord;

  switch (payload.kind) {
    case "app": {
      const resolvedStartId =
        payload.startAppId || (payload.route ? getStartAppIdForRoute(payload.route) : payload.id);
      record = {
        id: newId,
        kind: "app",
        name: payload.label,
        modifiedAt: Date.now(),
        sizeBytes: 4096,
        startAppId: resolvedStartId,
        dedupeKey: dedupeKey ?? undefined,
      };
      if (payload.route) record.route = payload.route;
      if (payload.externalUrl) record.externalUrl = payload.externalUrl;
      if (payload.iconKey) record.iconKey = payload.iconKey;
      if (payload.accentColor) record.accentColor = payload.accentColor;
      break;
    }
    case "directory": {
      record = {
        id: newId,
        kind: "folder",
        name: payload.name,
        modifiedAt: Date.now(),
        sizeBytes: 0,
        route: "/file-explorer",
        dirId: payload.dirId,
        dedupeKey: dedupeKey ?? undefined,
      };
      if (payload.pathLabel) record.pathLabel = payload.pathLabel;
      if (payload.iconKind) record.dirIconKind = payload.iconKind;
      break;
    }
    case "note": {
      record = {
        id: newId,
        kind: "note",
        name: payload.title.trim() || "Untitled Note",
        modifiedAt: payload.updatedAt ?? Date.now(),
        sizeBytes: 1024,
        route: "/notes",
        noteId: payload.noteId,
        dedupeKey: dedupeKey ?? undefined,
      };
      break;
    }
    case "html-file": {
      record = {
        id: newId,
        kind: "html-file",
        name: payload.name.endsWith(".html") ? payload.name : `${payload.name}.html`,
        modifiedAt: payload.updatedAt ?? Date.now(),
        sizeBytes: Math.max(256, payload.content.length),
        route: "/html-writer",
        htmlFileId: payload.fileId,
        htmlContent: payload.content,
        dedupeKey: dedupeKey ?? undefined,
      };
      break;
    }
    case "gallery-item": {
      record = {
        id: newId,
        kind: "gallery-item",
        name: payload.title,
        modifiedAt: payload.dateAdded
          ? new Date(payload.dateAdded).getTime() || Date.now()
          : Date.now(),
        sizeBytes: payload.size ?? 120000,
        route: `/gallery?preview=${encodeURIComponent(payload.itemId)}`,
        galleryItemId: payload.itemId,
        galleryMediaType: payload.mediaType,
        dedupeKey: dedupeKey ?? undefined,
      };
      if (payload.thumbnailUrl) record.thumbnailUrl = payload.thumbnailUrl;
      if (payload.url) record.mediaUrl = payload.url;
      break;
    }
    case "channel": {
      record = {
        id: newId,
        kind: "channel",
        name: payload.name,
        modifiedAt: Date.now(),
        sizeBytes: 2048,
        route: `/live-tv?channel=${encodeURIComponent(payload.slug)}`,
        channelId: payload.channelId,
        channelSlug: payload.slug,
        dedupeKey: dedupeKey ?? undefined,
      };
      if (payload.logo) record.channelLogo = payload.logo;
      break;
    }
    case "winui-project": {
      record = {
        id: newId,
        kind: "winui-project",
        name: payload.name,
        modifiedAt: Date.now(),
        sizeBytes: 2048,
        route: "/winui-framework",
        projectId: payload.projectId,
        dedupeKey: dedupeKey ?? undefined,
      };
      break;
    }
    case "setting": {
      record = {
        id: newId,
        kind: "setting",
        name: payload.label,
        modifiedAt: Date.now(),
        sizeBytes: 2048,
        route: payload.route,
        dedupeKey: dedupeKey ?? undefined,
      };
      if (payload.category) record.settingCategory = payload.category;
      break;
    }
    case "start-folder": {
      record = {
        id: newId,
        kind: "start-folder",
        name: payload.name,
        modifiedAt: Date.now(),
        sizeBytes: 0,
        startFolderAppIds: payload.appIds,
        dedupeKey: dedupeKey ?? undefined,
      };
      break;
    }
    default: {
      record = {
        id: newId,
        kind: "app",
        name: "Shortcut",
        modifiedAt: Date.now(),
        sizeBytes: 1024,
      };
    }
  }

  writeDesktopShortcuts([...shortcuts, record]);
  placeInDesktopOrder(newId, insertIndex, order);
  return { itemId: newId, name: record.name, alreadyExisted: false };
}

function placeInDesktopOrder(
  itemId: string,
  insertIndex: number | undefined,
  currentOrder: string[],
) {
  const cleaned = currentOrder.filter((id) => id !== itemId);
  if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= cleaned.length) {
    cleaned.splice(insertIndex, 0, itemId);
  } else {
    cleaned.push(itemId);
  }
  writeDesktopOrder(cleaned);
}

export function reorderDesktopItem(sourceId: string, targetId: string, currentIds: string[]): void {
  if (sourceId === targetId) return;
  const orderSet = new Set(currentIds);
  const saved = readDesktopOrder().filter((id) => orderSet.has(id));
  for (const id of currentIds) {
    if (!saved.includes(id)) saved.push(id);
  }
  const fromIdx = saved.indexOf(sourceId);
  const toIdx = saved.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = saved.splice(fromIdx, 1);
  if (!moved) return;
  saved.splice(toIdx, 0, moved);
  writeDesktopOrder(saved);
}

export function removeDesktopItem(item: DesktopItem): void {
  if (item.source === "shortcut") {
    writeDesktopShortcuts(readDesktopShortcuts().filter((s) => s.id !== item.id));
  } else if (item.source === "fs-custom") {
    writeCustomFsEntries(readCustomFsEntries().filter((e) => e.id !== item.id));
  } else if (item.source === "fs-seeded") {
    hideSystemEntry(item.id);
  }
  const nextOrder = readDesktopOrder().filter((id) => id !== item.id);
  writeDesktopOrder(nextOrder);
}

export function renameDesktopItem(item: DesktopItem, nextName: string): void {
  const trimmed = nextName.trim();
  if (!trimmed) return;
  if (item.source === "shortcut") {
    writeDesktopShortcuts(
      readDesktopShortcuts().map((s) =>
        s.id === item.id ? { ...s, name: trimmed, modifiedAt: Date.now() } : s,
      ),
    );
    return;
  }
  if (item.source === "fs-custom") {
    writeCustomFsEntries(
      readCustomFsEntries().map((e) =>
        e.id === item.id
          ? {
              ...e,
              name: trimmed,
              pathLabel: e.pathLabel.replace(/[^\\]+$/, trimmed),
              modifiedAt: Date.now(),
            }
          : e,
      ),
    );
    return;
  }
  if (item.source === "fs-seeded" && item.fsEntry) {
    const forked: SharedExplorerEntry = {
      ...item.fsEntry,
      id: `custom-${Date.now()}`,
      name: trimmed,
      pathLabel: item.fsEntry.pathLabel.replace(/[^\\]+$/, trimmed),
      modifiedAt: Date.now(),
      linkedSource: "custom",
    };
    writeCustomFsEntries([forked, ...readCustomFsEntries()]);
    hideSystemEntry(item.id);
  }
}

export function buildDesktopItems(sortBy: DesktopSortMode, useCustomOrder = true): DesktopItem[] {
  const hiddenSet = new Set(readHiddenSystemIds());
  const customFs = readCustomFsEntries().filter((e) => e.parentId === "dir-desktop");
  const seededFs = SEEDED_DESKTOP_ENTRIES.filter((e) => !hiddenSet.has(e.id));
  const shortcuts = readDesktopShortcuts();

  const items: DesktopItem[] = [];

  for (const entry of seededFs) {
    items.push({
      id: entry.id,
      name: entry.name,
      kind: "fs-entry",
      source: "fs-seeded",
      modifiedAt: entry.modifiedAt,
      sizeBytes: entry.sizeBytes ?? 0,
      isShortcut: entry.kind === "app" || entry.name.endsWith(".lnk"),
      fsEntry: entry,
    });
  }

  for (const entry of customFs) {
    items.push({
      id: entry.id,
      name: entry.name,
      kind: "fs-entry",
      source: "fs-custom",
      modifiedAt: entry.modifiedAt,
      sizeBytes: entry.sizeBytes ?? 0,
      isShortcut: entry.kind === "app" || entry.name.endsWith(".lnk"),
      fsEntry: entry,
    });
  }

  for (const sc of shortcuts) {
    items.push({
      id: sc.id,
      name: sc.name,
      kind: sc.kind,
      source: "shortcut",
      modifiedAt: sc.modifiedAt,
      sizeBytes: sc.sizeBytes ?? 1024,
      isShortcut:
        sc.kind === "app" ||
        sc.kind === "folder" ||
        sc.kind === "channel" ||
        sc.kind === "setting" ||
        sc.kind === "winui-project",
      shortcut: sc,
    });
  }

  const sortComparator = (a: DesktopItem, b: DesktopItem) => {
    switch (sortBy) {
      case "size":
        return b.sizeBytes - a.sizeBytes || a.name.localeCompare(b.name);
      case "type": {
        const typeA = a.fsEntry?.kind ?? a.kind;
        const typeB = b.fsEntry?.kind ?? b.kind;
        return typeA.localeCompare(typeB) || a.name.localeCompare(b.name);
      }
      case "modified":
        return b.modifiedAt - a.modifiedAt || a.name.localeCompare(b.name);
      case "name":
      default:
        return a.name.localeCompare(b.name);
    }
  };

  if (!useCustomOrder) {
    return [...items].sort(sortComparator);
  }

  const order = readDesktopOrder();
  if (order.length === 0) {
    return [...items].sort(sortComparator);
  }

  const orderIndex = new Map<string, number>();
  order.forEach((id, idx) => orderIndex.set(id, idx));

  return [...items].sort((a, b) => {
    const idxA = orderIndex.get(a.id);
    const idxB = orderIndex.get(b.id);
    if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;
    return sortComparator(a, b);
  });
}

let desktopVersion = 0;
let listenersAttached = false;
const desktopListeners = new Set<() => void>();

export function notifyDesktopListeners() {
  desktopVersion += 1;
  desktopListeners.forEach((fn) => fn());
}

function ensureDesktopListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;

  const bump = () => notifyDesktopListeners();
  window.addEventListener("sparkle:file-explorer-fs-updated", bump);
  window.addEventListener("sparkle:desktop-updated", bump);
  window.addEventListener("sparkle:desktop-refresh", bump);
  window.addEventListener("storage", (e) => {
    if (
      e.key === DESKTOP_SHORTCUTS_KEY ||
      e.key === DESKTOP_ORDER_KEY ||
      e.key === "sparkle_file_explorer_v1" ||
      e.key === "sparkle_file_explorer_hidden_v1"
    ) {
      bump();
    }
  });
}

export function useDesktopItems(sortBy: DesktopSortMode): DesktopItem[] {
  // Keep reactive sync with custom installed WinUI apps (in case an app is uninstalled/updated)
  useInstalledWinUIApps();

  const version = useSyncExternalStore(
    (cb) => {
      ensureDesktopListeners();
      desktopListeners.add(cb);
      return () => {
        desktopListeners.delete(cb);
      };
    },
    () => desktopVersion,
    () => desktopVersion,
  );

  void version;
  return buildDesktopItems(sortBy, true);
}
