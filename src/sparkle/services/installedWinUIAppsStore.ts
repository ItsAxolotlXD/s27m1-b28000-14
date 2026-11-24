import { useSyncExternalStore } from "react";
import type { WinUIProject } from "../utils/winuiFrameworkEngine";

export type WinUIAppIconKey =
  | "layers"
  | "sparkles"
  | "check"
  | "sliders"
  | "monitor"
  | "palette"
  | "terminal"
  | "compass"
  | "clock"
  | "star"
  | "package"
  | "calculator";

export const WINUI_APP_ICON_KEYS: readonly WinUIAppIconKey[] = [
  "layers",
  "sparkles",
  "check",
  "sliders",
  "monitor",
  "palette",
  "terminal",
  "compass",
  "clock",
  "star",
  "package",
  "calculator",
];

export const WINUI_APP_ACCENT_COLORS: readonly string[] = [
  "#0067b8",
  "#0ea5e9",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
];

export type VisualElementType =
  | "TextBlock"
  | "Button"
  | "HyperlinkButton"
  | "ToggleSwitch"
  | "Slider"
  | "TextBox"
  | "NumberBox"
  | "CheckBox"
  | "ComboBox"
  | "InfoBar"
  | "ProgressBar"
  | "ProgressRing"
  | "Card"
  | "Expander"
  | "ListView"
  | "Badge"
  | "Divider"
  | "RatingControl"
  | "CalendarDatePicker"
  | "ImageCard";

export type VisualActionKind =
  "none" | "toast" | "set-text" | "increment" | "toggle-visibility" | "reset" | "handler";

export interface VisualAction {
  kind: VisualActionKind;
  message?: string;
  targetElementId?: string;
  value?: string;
  handlerName?: string;
}

export interface VisualElementProps {
  text?: string;
  header?: string;
  subtitle?: string;
  placeholder?: string;
  styleVariant?:
    "Standard" | "Accent" | "Subtle" | "Danger" | "Title" | "Subtitle" | "Body" | "Caption";
  severity?: "info" | "success" | "warning" | "error";
  min?: number;
  max?: number;
  value?: number;
  isOn?: boolean;
  isChecked?: boolean;
  isExpanded?: boolean;
  items?: string;
  selected?: string;
  accentColor?: string;
  bgTint?: string;
  opacity?: number;
  radius?: number;
  visible?: boolean;
}

export interface VisualElement {
  id: string;
  type: VisualElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  props: VisualElementProps;
  action?: VisualAction;
}

export interface VisualCanvasConfig {
  width: number;
  height: number;
  surface: "mica" | "light" | "dark" | "slate" | "ocean";
  snapGrid: boolean;
}

export interface InstalledWinUIApp {
  id: string;
  projectId: string;
  name: string;
  description: string;
  route: string;
  iconKey: WinUIAppIconKey;
  accentColor: string;
  mode: "visual" | "code";
  visualElements?: VisualElement[];
  visualCanvas?: VisualCanvasConfig;
  projectSnapshot: WinUIProject;
  installedAt: number;
  updatedAt: number;
}

const INSTALLED_APPS_KEY = "sparkle_installed_winui_apps_v1";

export function installedWinUIStartAppId(appId: string): string {
  return `winui-custom-${appId}`;
}

export function installedWinUIAppRoute(appId: string): string {
  return `/winui-app/${appId}`;
}

export function getInstalledAppIdFromRoute(route: string): string | null {
  const clean = (route || "").split(/[?#]/)[0] ?? "";
  if (!clean.startsWith("/winui-app/")) return null;
  const id = clean.slice("/winui-app/".length).split("/")[0]?.trim();
  return id || null;
}

function loadInstalledApps(): InstalledWinUIApp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INSTALLED_APPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InstalledWinUIApp[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.route === "string",
    );
  } catch {
    return [];
  }
}

let cachedApps: InstalledWinUIApp[] | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): InstalledWinUIApp[] {
  if (!cachedApps) {
    cachedApps = loadInstalledApps();
  }
  return cachedApps;
}

function commit(next: InstalledWinUIApp[]) {
  cachedApps = next;
  try {
    localStorage.setItem(INSTALLED_APPS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useInstalledWinUIApps(): InstalledWinUIApp[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getInstalledWinUIApps(): InstalledWinUIApp[] {
  return getSnapshot();
}

export function getInstalledWinUIAppById(id: string): InstalledWinUIApp | undefined {
  return getSnapshot().find((a) => a.id === id);
}

export function getInstalledWinUIAppByRoute(route: string): InstalledWinUIApp | undefined {
  const id = getInstalledAppIdFromRoute(route);
  if (!id) return undefined;
  return getInstalledWinUIAppById(id);
}

export function installOrUpdateWinUIApp(input: {
  id?: string;
  projectId: string;
  name: string;
  description: string;
  iconKey: WinUIAppIconKey;
  accentColor: string;
  mode: "visual" | "code";
  visualElements?: VisualElement[];
  visualCanvas?: VisualCanvasConfig;
  projectSnapshot: WinUIProject;
}): InstalledWinUIApp {
  const current = getSnapshot();
  const existing =
    (input.id ? current.find((a) => a.id === input.id) : undefined) ??
    current.find((a) => a.projectId === input.projectId);

  const now = Date.now();
  const slugBase =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app";
  const id = existing?.id ?? `${slugBase}-${now.toString(36)}`;
  const route = installedWinUIAppRoute(id);

  const record: InstalledWinUIApp = {
    id,
    projectId: input.projectId,
    name: input.name.trim() || "WinUI App",
    description: input.description.trim() || "Built with WinUI Framework",
    route,
    iconKey: input.iconKey,
    accentColor: input.accentColor,
    mode: input.mode,
    ...(input.visualElements
      ? { visualElements: JSON.parse(JSON.stringify(input.visualElements)) as VisualElement[] }
      : {}),
    ...(input.visualCanvas ? { visualCanvas: { ...input.visualCanvas } } : {}),
    projectSnapshot: JSON.parse(JSON.stringify(input.projectSnapshot)) as WinUIProject,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
  };

  const next = existing ? current.map((a) => (a.id === id ? record : a)) : [record, ...current];
  commit(next);
  return record;
}

export function uninstallWinUIApp(id: string): void {
  const current = getSnapshot();
  const next = current.filter((a) => a.id !== id);
  if (next.length !== current.length) {
    commit(next);
  }
}
