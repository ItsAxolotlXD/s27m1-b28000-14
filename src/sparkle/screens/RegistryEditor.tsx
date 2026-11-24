import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Pencil,
  Trash2,
  Search,
  Star,
  Download,
  Upload,
  RotateCcw,
  Copy,
  PanelRight,
  Monitor,
  Binary,
  Type,
  Hash,
  FileCode,
  Info,
  X,
  Check,
  ChevronsUpDown,
  RefreshCw,
  Menu,
  HardDrive,
  Cpu,
  Layers,
  User,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import { Fluent3DRegistryEditorIcon } from "../components/Fluent3DIcons";
import { FluentSettingsIcon } from "../components/FluentIcons";
import {
  flyoutPanelClassName,
  flyoutPanelStyle,
  contextMenuMotionProps,
} from "../components/FlyoutDropdown";
import { showAppToast } from "../utils/toast";
import { useSettings, type SystemSettings } from "../hooks/useSettings";

const dialogBackdropMotion = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] as const },
  },
};

const dialogPanelMotion = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.16, ease: [0.4, 0, 0.2, 1] as const },
  },
};
import {
  type RegKeyNode,
  type RegValue,
  type RegValueType,
  type RegSearchResult,
  ROOT_HIVES,
  cloneRegistryTree,
  createInitialRegistryTree,
  loadRegistryTreeFromStorage,
  saveRegistryTreeToStorage,
  loadRegistryFavorites,
  saveRegistryFavorites,
  normalizeRegistryPath,
  getPathSegments,
  getParentPath,
  isProtectedKeyPath,
  getNodeByPath,
  resolveActualPath,
  getSortedChildNames,
  ensureDefaultValue,
  formatValuePreview,
  normalizeBinaryHex,
  binaryHexToAscii,
  serializeRegFile,
  importRegFileIntoTree,
  searchRegistryTree,
} from "../utils/registryStore";

interface RegistryEditorProps {
  navigate?: (route: string) => void;
}

type SortCol = "name" | "type" | "data";
type SortDir = "asc" | "desc";
type MenuKey = "file" | "edit" | "view" | "favorites" | "help" | "new-value";

interface ContextMenuState {
  x: number;
  y: number;
  target:
    | { kind: "tree"; path: string }
    | { kind: "value"; path: string; valueName: string }
    | { kind: "empty"; path: string };
}

type EditModalState =
  | { kind: "string"; path: string; value: RegValue }
  | { kind: "number"; path: string; value: RegValue; bits: 32 | 64 }
  | { kind: "multi"; path: string; value: RegValue }
  | { kind: "binary"; path: string; value: RegValue }
  | null;

type PromptModalState =
  | { kind: "new-key"; parentPath: string; value: string }
  | { kind: "rename-key"; path: string; value: string }
  | { kind: "new-value"; path: string; regType: RegValueType; value: string }
  | { kind: "rename-value"; path: string; oldName: string; value: string }
  | null;

type ConfirmModalState =
  | { kind: "delete-key"; path: string }
  | { kind: "delete-value"; path: string; valueName: string }
  | { kind: "reset-registry" }
  | null;

const LIVE_PERSONALIZE_PATH =
  "Computer\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
const LIVE_EXPLORER_ADV_PATH =
  "Computer\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";
const LIVE_SPARKLE_DESKTOP_PATH =
  "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion\\Desktop";
const LIVE_SPARKLE_TASKBAR_PATH =
  "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion\\Taskbar";

const LIVE_BRIDGE_PATHS = new Set([
  LIVE_PERSONALIZE_PATH.toLowerCase(),
  LIVE_EXPLORER_ADV_PATH.toLowerCase(),
  LIVE_SPARKLE_DESKTOP_PATH.toLowerCase(),
  LIVE_SPARKLE_TASKBAR_PATH.toLowerCase(),
]);

function getLiveOverlaidValues(
  path: string,
  baseValues: RegValue[],
  settings: SystemSettings,
): RegValue[] {
  const lower = normalizeRegistryPath(path).toLowerCase();
  const map = new Map<string, RegValue>();
  for (const v of baseValues) {
    map.set(v.name, v);
  }
  const setVal = (name: string, type: RegValueType, data: string) => {
    map.set(name, { name, type, data });
  };

  if (lower === LIVE_PERSONALIZE_PATH.toLowerCase()) {
    const isLight = settings.theme === "light" ? "1" : "0";
    setVal("AppsUseLightTheme", "REG_DWORD", isLight);
    setVal("SystemUsesLightTheme", "REG_DWORD", isLight);
    setVal("EnableTransparency", "REG_DWORD", settings.spatialGlass ? "1" : "0");
  } else if (lower === LIVE_EXPLORER_ADV_PATH.toLowerCase()) {
    setVal("TaskbarAl", "REG_DWORD", settings.taskbarAlignment === "left" ? "0" : "1");
    setVal(
      "TaskbarSi",
      "REG_DWORD",
      settings.taskbarScale === "small" ? "0" : settings.taskbarScale === "large" ? "2" : "1",
    );
  } else if (lower === LIVE_SPARKLE_DESKTOP_PATH.toLowerCase()) {
    setVal("WindowsMode", "REG_DWORD", settings.windowsMode ? "1" : "0");
    setVal("Wallpaper", "REG_SZ", settings.windowsWallpaper || "waves-ocean-light");
    setVal("SpotlightInterval", "REG_SZ", settings.spotlightInterval || "1m");
    setVal("SpatialGlass", "REG_DWORD", settings.spatialGlass ? "1" : "0");
    setVal("SpatialGlassOpacity", "REG_DWORD", String(settings.spatialGlassOpacity ?? 20));
    setVal("SpatialGlassBlur", "REG_DWORD", String(settings.spatialGlassBlur ?? 10));
    setVal("UiScale", "REG_SZ", settings.windowsUiScale || "default");
  } else if (lower === LIVE_SPARKLE_TASKBAR_PATH.toLowerCase()) {
    setVal("TaskbarLocation", "REG_SZ", settings.taskbarLocation || "bottom");
    setVal("TaskbarAlignment", "REG_SZ", settings.taskbarAlignment || "center");
    setVal("TaskbarScale", "REG_SZ", settings.taskbarScale || "default");
    setVal("SearchStyle", "REG_SZ", settings.taskbarSearchStyle || "box");
  }

  return ensureDefaultValue(Array.from(map.values()));
}

function getAncestors(path: string): string[] {
  const segs = getPathSegments(path);
  const out: string[] = [];
  for (let i = 1; i <= segs.length; i++) {
    out.push(segs.slice(0, i).join("\\"));
  }
  return out;
}

const ValueTypeBadgeIcon: React.FC<{ type: RegValueType }> = ({ type }) => {
  if (type === "REG_SZ" || type === "REG_EXPAND_SZ" || type === "REG_MULTI_SZ") {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-rose-500/12 text-rose-600 dark:text-rose-400 shrink-0">
        <Type className="w-3 h-3" />
      </span>
    );
  }
  if (type === "REG_DWORD" || type === "REG_QWORD") {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-[#0067b8]/12 dark:bg-[#4cc2ff]/15 text-[#0067b8] dark:text-[#4cc2ff] shrink-0">
        <Hash className="w-3 h-3" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
      <Binary className="w-3 h-3" />
    </span>
  );
};

export const RegistryEditor: React.FC<RegistryEditorProps> = ({ navigate }) => {
  const { settings, updateSetting } = useSettings();

  const [tree, setTree] = useState<RegKeyNode>(() => loadRegistryTreeFromStorage());
  const [favorites, setFavorites] = useState<string[]>(() => loadRegistryFavorites());
  const [selectedPath, setSelectedPath] = useState<string>(
    "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion\\Desktop",
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () =>
      new Set([
        "Computer",
        "Computer\\HKEY_CURRENT_USER",
        "Computer\\HKEY_CURRENT_USER\\Software",
        "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS",
        "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion",
        "Computer\\HKEY_LOCAL_MACHINE",
      ]),
  );

  const [history, setHistory] = useState<string[]>([
    "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion\\Desktop",
  ]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const [selectedValueName, setSelectedValueName] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Hamburger NavigationView Sidebar & Settings view
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [isCompactContainer, setIsCompactContainer] = useState(false);
  const [isSettingsView, setIsSettingsView] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [defaultNumBase, setDefaultNumBase] = useState<"hex" | "dec">("hex");
  const [navTooltip, setNavTooltip] = useState<{ label: string; top: number; left: number } | null>(
    null,
  );

  // Layout & View toggles
  const [treeWidth, setTreeWidth] = useState(290);
  const [isResizingTree, setIsResizingTree] = useState(false);
  const [showAddressBar, setShowAddressBar] = useState(true);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [showFavoritesSection, setShowFavoritesSection] = useState(true);

  // Address bar & inline search
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState(selectedPath);
  const [quickFilter, setQuickFilter] = useState("");
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Modals
  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [promptModal, setPromptModal] = useState<PromptModalState>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Find dialog state
  const [findQuery, setFindQuery] = useState("");
  const [findInKeys, setFindInKeys] = useState(true);
  const [findInValues, setFindInValues] = useState(true);
  const [findInData, setFindInData] = useState(true);
  const [findMatchWhole, setFindMatchWhole] = useState(false);
  const [findStartScope, setFindStartScope] = useState<"all" | "current">("all");

  // Edit modal inputs
  const [modalStrVal, setModalStrVal] = useState("");
  const [modalNumVal, setModalNumVal] = useState("0");
  const [modalNumBase, setModalNumBase] = useState<"hex" | "dec">("hex");
  const [modalBinVal, setModalBinVal] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const newValueWrapRef = useRef<HTMLDivElement>(null);
  const [newValueMenuPos, setNewValueMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );

  // Persist tree & favorites
  useEffect(() => {
    saveRegistryTreeToStorage(tree);
  }, [tree]);

  useEffect(() => {
    saveRegistryFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    setAddressInput(selectedPath);
  }, [selectedPath]);

  // Responsive check on container width so narrow Windows Mode frames also get the Hamburger drawer
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      setIsCompactContainer(el.clientWidth < 720);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-regedit-menubar]")) return;
      setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMenu]);

  // Drag-resize left tree pane
  useEffect(() => {
    if (!isResizingTree) return;
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = Math.max(190, Math.min(520, e.clientX - rect.left));
      setTreeWidth(next);
    };
    const onUp = () => setIsResizingTree(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingTree]);

  const navigateToPath = useCallback(
    (rawPath: string, pushHistory = true, selectValName: string | null = null) => {
      const resolved = resolveActualPath(tree, rawPath);
      if (!resolved) {
        showAppToast(`Cannot find key "${rawPath}"`, { appName: "Registry Editor" });
        return false;
      }
      setSelectedPath(resolved);
      setSelectedValueName(selectValName);
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        for (const anc of getAncestors(resolved)) {
          next.add(anc);
        }
        return next;
      });
      if (pushHistory) {
        setHistory((prev) => {
          const sliced = prev.slice(0, historyIdx + 1);
          if (sliced[sliced.length - 1] === resolved) return sliced;
          const nextHist = [...sliced, resolved];
          setHistoryIdx(nextHist.length - 1);
          return nextHist;
        });
      }
      return true;
    },
    [tree, historyIdx],
  );

  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx < history.length - 1;
  const parentPath = getParentPath(selectedPath);

  const handleBack = useCallback(() => {
    if (!canGoBack) return;
    const targetIdx = historyIdx - 1;
    const target = history[targetIdx];
    if (target) {
      setHistoryIdx(targetIdx);
      navigateToPath(target, false);
    }
  }, [canGoBack, history, historyIdx, navigateToPath]);

  const handleForward = useCallback(() => {
    if (!canGoForward) return;
    const targetIdx = historyIdx + 1;
    const target = history[targetIdx];
    if (target) {
      setHistoryIdx(targetIdx);
      navigateToPath(target, false);
    }
  }, [canGoForward, history, historyIdx, navigateToPath]);

  const handleUp = useCallback(() => {
    if (parentPath) {
      navigateToPath(parentPath, true);
    }
  }, [parentPath, navigateToPath]);

  const currentNode = useMemo(() => getNodeByPath(tree, selectedPath), [tree, selectedPath]);
  const isLiveBridgeKey = LIVE_BRIDGE_PATHS.has(selectedPath.toLowerCase());

  const currentValues = useMemo(() => {
    if (!currentNode) return [];
    const base = ensureDefaultValue(currentNode.values);
    const overlaid = isLiveBridgeKey ? getLiveOverlaidValues(selectedPath, base, settings) : base;
    const q = quickFilter.trim().toLowerCase();
    const filtered = q
      ? overlaid.filter((v) => {
          const nameLabel = v.name === "" ? "(default)" : v.name.toLowerCase();
          return (
            nameLabel.includes(q) ||
            v.type.toLowerCase().includes(q) ||
            formatValuePreview(v).toLowerCase().includes(q)
          );
        })
      : overlaid;

    const defaultRow = filtered.find((v) => v.name === "");
    const others = filtered.filter((v) => v.name !== "");

    others.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "name") cmp = a.name.localeCompare(b.name);
      else if (sortCol === "type") cmp = a.type.localeCompare(b.type);
      else cmp = formatValuePreview(a).localeCompare(formatValuePreview(b));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return defaultRow ? [defaultRow, ...others] : others;
  }, [currentNode, isLiveBridgeKey, selectedPath, settings, quickFilter, sortCol, sortDir]);

  const selectedValue = useMemo(
    () =>
      selectedValueName !== null
        ? (currentValues.find((v) => v.name === selectedValueName) ?? null)
        : null,
    [currentValues, selectedValueName],
  );

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Apply live SparkleOS setting when editing live bridge registry keys
  const syncLiveSettingChange = useCallback(
    (path: string, valueName: string, newData: string) => {
      const lowerPath = normalizeRegistryPath(path).toLowerCase();
      const numVal = Number(newData);
      const boolVal = newData === "1" || newData.toLowerCase() === "true";

      if (lowerPath === LIVE_PERSONALIZE_PATH.toLowerCase()) {
        if (valueName === "AppsUseLightTheme" || valueName === "SystemUsesLightTheme") {
          updateSetting("theme", boolVal ? "light" : "dark");
          showAppToast(`Registry applied: Theme set to ${boolVal ? "Light" : "Dark"}`, {
            source: "settings",
          });
        } else if (valueName === "EnableTransparency") {
          updateSetting("spatialGlass", boolVal);
          showAppToast(`Registry applied: Spatial Glass ${boolVal ? "enabled" : "disabled"}`, {
            source: "settings",
          });
        }
      } else if (lowerPath === LIVE_EXPLORER_ADV_PATH.toLowerCase()) {
        if (valueName === "TaskbarAl") {
          updateSetting("taskbarAlignment", numVal === 0 ? "left" : "center");
          showAppToast(
            `Registry applied: Taskbar alignment (${numVal === 0 ? "Left" : "Center"})`,
            {
              source: "settings",
            },
          );
        } else if (valueName === "TaskbarSi") {
          const scale = numVal === 0 ? "small" : numVal === 2 ? "large" : "default";
          updateSetting("taskbarScale", scale);
          showAppToast(`Registry applied: Taskbar size (${scale})`, { source: "settings" });
        }
      } else if (lowerPath === LIVE_SPARKLE_DESKTOP_PATH.toLowerCase()) {
        if (valueName === "WindowsMode") {
          updateSetting("windowsMode", boolVal);
        } else if (valueName === "Wallpaper") {
          updateSetting("windowsWallpaper", newData);
        } else if (
          valueName === "SpotlightInterval" &&
          (newData === "1m" ||
            newData === "5m" ||
            newData === "10m" ||
            newData === "30m" ||
            newData === "1h" ||
            newData === "1d")
        ) {
          updateSetting("spotlightInterval", newData);
        } else if (valueName === "SpatialGlass") {
          updateSetting("spatialGlass", boolVal);
        } else if (valueName === "SpatialGlassOpacity" && Number.isFinite(numVal)) {
          updateSetting("spatialGlassOpacity", Math.max(0, Math.min(100, numVal)));
        } else if (valueName === "SpatialGlassBlur" && Number.isFinite(numVal)) {
          updateSetting("spatialGlassBlur", Math.max(0, Math.min(100, numVal)));
        } else if (
          valueName === "UiScale" &&
          (newData === "small" || newData === "default" || newData === "large")
        ) {
          updateSetting("windowsUiScale", newData);
        }
      } else if (lowerPath === LIVE_SPARKLE_TASKBAR_PATH.toLowerCase()) {
        if (
          valueName === "TaskbarLocation" &&
          (newData === "bottom" || newData === "top" || newData === "left" || newData === "right")
        ) {
          updateSetting("taskbarLocation", newData);
        } else if (
          valueName === "TaskbarAlignment" &&
          (newData === "center" || newData === "left")
        ) {
          updateSetting("taskbarAlignment", newData);
        } else if (
          valueName === "TaskbarScale" &&
          (newData === "small" || newData === "default" || newData === "large")
        ) {
          updateSetting("taskbarScale", newData);
        } else if (valueName === "SearchStyle" && (newData === "box" || newData === "button")) {
          updateSetting("taskbarSearchStyle", newData);
        }
      }
    },
    [updateSetting],
  );

  // Tree Mutations
  const createSubKey = useCallback(
    (parent: string, rawName: string) => {
      const cleanName = rawName.trim().replace(/[\\]/g, "");
      if (!cleanName) {
        showAppToast("Key name cannot be empty", { appName: "Registry Editor" });
        return;
      }
      if (parent === "Computer") {
        showAppToast("Cannot create keys directly under Computer root", {
          appName: "Registry Editor",
        });
        return;
      }
      const next = cloneRegistryTree(tree);
      const parentNode = getNodeByPath(next, parent);
      if (!parentNode) return;
      const duplicate = Object.keys(parentNode.children).some(
        (k) => k.toLowerCase() === cleanName.toLowerCase(),
      );
      if (duplicate) {
        showAppToast(`Key "${cleanName}" already exists`, { appName: "Registry Editor" });
        return;
      }
      parentNode.children[cleanName] = {
        name: cleanName,
        values: [{ name: "", type: "REG_SZ", data: "" }],
        children: {},
      };
      setTree(next);
      const createdPath = `${parent}\\${cleanName}`;
      setExpandedPaths((prev) => new Set([...prev, parent, createdPath]));
      setSelectedPath(createdPath);
      setSelectedValueName(null);
      showAppToast(`Created key ${cleanName}`, { appName: "Registry Editor" });
    },
    [tree],
  );

  const renameKey = useCallback(
    (path: string, rawNewName: string) => {
      if (isProtectedKeyPath(path)) {
        showAppToast("System root hives cannot be renamed", { appName: "Registry Editor" });
        return;
      }
      const cleanName = rawNewName.trim().replace(/[\\]/g, "");
      if (!cleanName) return;
      const pPath = getParentPath(path);
      if (!pPath) return;
      const next = cloneRegistryTree(tree);
      const parentNode = getNodeByPath(next, pPath);
      const targetNode = getNodeByPath(next, path);
      if (!parentNode || !targetNode) return;
      const oldName = targetNode.name;
      if (oldName === cleanName) return;
      const duplicate = Object.keys(parentNode.children).some(
        (k) => k.toLowerCase() === cleanName.toLowerCase() && k !== oldName,
      );
      if (duplicate) {
        showAppToast(`Key "${cleanName}" already exists`, { appName: "Registry Editor" });
        return;
      }
      delete parentNode.children[oldName];
      targetNode.name = cleanName;
      parentNode.children[cleanName] = targetNode;
      setTree(next);
      const newPath = `${pPath}\\${cleanName}`;
      if (selectedPath === path || selectedPath.startsWith(`${path}\\`)) {
        setSelectedPath(newPath + selectedPath.slice(path.length));
      }
      showAppToast(`Renamed key to ${cleanName}`, { appName: "Registry Editor" });
    },
    [tree, selectedPath],
  );

  const deleteKey = useCallback(
    (path: string) => {
      if (isProtectedKeyPath(path)) {
        showAppToast("System root hives cannot be deleted", { appName: "Registry Editor" });
        return;
      }
      const pPath = getParentPath(path);
      if (!pPath) return;
      const next = cloneRegistryTree(tree);
      const parentNode = getNodeByPath(next, pPath);
      const targetNode = getNodeByPath(next, path);
      if (!parentNode || !targetNode) return;
      delete parentNode.children[targetNode.name];
      setTree(next);
      if (selectedPath === path || selectedPath.startsWith(`${path}\\`)) {
        setSelectedPath(pPath);
        setSelectedValueName(null);
      }
      showAppToast(`Deleted key ${targetNode.name}`, { appName: "Registry Editor" });
    },
    [tree, selectedPath],
  );

  const createValue = useCallback(
    (path: string, regType: RegValueType, rawName: string) => {
      if (path === "Computer") {
        showAppToast("Select a hive or key first", { appName: "Registry Editor" });
        return;
      }
      const cleanName = rawName.trim();
      if (!cleanName) {
        showAppToast("Value name cannot be empty", { appName: "Registry Editor" });
        return;
      }
      const next = cloneRegistryTree(tree);
      const node = getNodeByPath(next, path);
      if (!node) return;
      const duplicate = node.values.some((v) => v.name.toLowerCase() === cleanName.toLowerCase());
      if (duplicate) {
        showAppToast(`Value "${cleanName}" already exists`, { appName: "Registry Editor" });
        return;
      }
      const defaultData =
        regType === "REG_DWORD" || regType === "REG_QWORD"
          ? "0"
          : regType === "REG_BINARY"
            ? ""
            : "";
      node.values = ensureDefaultValue([
        ...node.values,
        { name: cleanName, type: regType, data: defaultData },
      ]);
      setTree(next);
      setSelectedValueName(cleanName);
      showAppToast(`Created ${regType} value "${cleanName}"`, { appName: "Registry Editor" });
    },
    [tree],
  );

  const updateValueData = useCallback(
    (path: string, valueName: string, newData: string) => {
      const next = cloneRegistryTree(tree);
      const node = getNodeByPath(next, path);
      if (!node) return;
      const idx = node.values.findIndex((v) => v.name === valueName);
      if (idx >= 0 && node.values[idx]) {
        node.values[idx]!.data = newData;
      } else {
        // Might be an overlaid live value not yet stored explicitly
        const liveVal = currentValues.find((v) => v.name === valueName);
        if (liveVal) {
          node.values = ensureDefaultValue([
            ...node.values,
            { name: valueName, type: liveVal.type, data: newData },
          ]);
        }
      }
      setTree(next);
      if (LIVE_BRIDGE_PATHS.has(normalizeRegistryPath(path).toLowerCase())) {
        syncLiveSettingChange(path, valueName, newData);
      }
    },
    [tree, currentValues, syncLiveSettingChange],
  );

  const renameValue = useCallback(
    (path: string, oldName: string, rawNewName: string) => {
      if (oldName === "") {
        showAppToast("Cannot rename the (Default) value", { appName: "Registry Editor" });
        return;
      }
      const cleanName = rawNewName.trim();
      if (!cleanName || cleanName === oldName) return;
      const next = cloneRegistryTree(tree);
      const node = getNodeByPath(next, path);
      if (!node) return;
      const duplicate = node.values.some(
        (v) => v.name.toLowerCase() === cleanName.toLowerCase() && v.name !== oldName,
      );
      if (duplicate) {
        showAppToast(`Value "${cleanName}" already exists`, { appName: "Registry Editor" });
        return;
      }
      const target = node.values.find((v) => v.name === oldName);
      if (!target) return;
      target.name = cleanName;
      node.values = ensureDefaultValue(node.values);
      setTree(next);
      setSelectedValueName(cleanName);
    },
    [tree],
  );

  const deleteValue = useCallback(
    (path: string, valueName: string) => {
      if (valueName === "") {
        // Deleting (Default) clears it
        updateValueData(path, "", "");
        return;
      }
      const next = cloneRegistryTree(tree);
      const node = getNodeByPath(next, path);
      if (!node) return;
      node.values = ensureDefaultValue(node.values.filter((v) => v.name !== valueName));
      setTree(next);
      if (selectedValueName === valueName) setSelectedValueName(null);
      showAppToast(`Deleted value "${valueName}"`, { appName: "Registry Editor" });
    },
    [tree, selectedValueName, updateValueData],
  );

  // Open Edit Modal for a value
  const openEditValueModal = useCallback(
    (path: string, val: RegValue, forceBinary = false) => {
      if (forceBinary || val.type === "REG_BINARY") {
        setModalBinVal(normalizeBinaryHex(val.data));
        setEditModal({ kind: "binary", path, value: val });
        return;
      }
      if (val.type === "REG_DWORD" || val.type === "REG_QWORD") {
        const bits = val.type === "REG_DWORD" ? 32 : 64;
        setModalNumBase(defaultNumBase);
        try {
          const big = BigInt(val.data || "0");
          setModalNumVal(defaultNumBase === "hex" ? big.toString(16) : big.toString(10));
        } catch {
          setModalNumVal("0");
        }
        setEditModal({ kind: "number", path, value: val, bits });
        return;
      }
      if (val.type === "REG_MULTI_SZ") {
        setModalStrVal(val.data);
        setEditModal({ kind: "multi", path, value: val });
        return;
      }
      setModalStrVal(val.data);
      setEditModal({ kind: "string", path, value: val });
    },
    [defaultNumBase],
  );

  const handleSaveEditModal = () => {
    if (!editModal) return;
    if (editModal.kind === "string" || editModal.kind === "multi") {
      updateValueData(editModal.path, editModal.value.name, modalStrVal);
    } else if (editModal.kind === "binary") {
      updateValueData(editModal.path, editModal.value.name, normalizeBinaryHex(modalBinVal));
    } else if (editModal.kind === "number") {
      try {
        const clean = modalNumVal.trim() || "0";
        const parsed =
          modalNumBase === "hex" ? BigInt(`0x${clean.replace(/^0x/i, "")}`) : BigInt(clean);
        const mask = editModal.bits === 32 ? 0xffffffffn : 0xffffffffffffffffn;
        const clamped = (parsed < 0n ? 0n : parsed) & mask;
        updateValueData(editModal.path, editModal.value.name, clamped.toString(10));
      } catch {
        showAppToast("Invalid numeric value", { appName: "Registry Editor" });
        return;
      }
    }
    setEditModal(null);
  };

  const handleSwitchNumberBase = (nextBase: "hex" | "dec") => {
    if (nextBase === modalNumBase) return;
    try {
      const clean = modalNumVal.trim() || "0";
      const parsed =
        modalNumBase === "hex" ? BigInt(`0x${clean.replace(/^0x/i, "")}`) : BigInt(clean);
      setModalNumVal(nextBase === "hex" ? parsed.toString(16) : parsed.toString(10));
    } catch {
      setModalNumVal("0");
    }
    setModalNumBase(nextBase);
  };

  // Export & Import .reg
  const handleExportReg = useCallback(
    (targetPath = selectedPath) => {
      const content = serializeRegFile(tree, targetPath);
      if (!content) {
        showAppToast("Select a hive or key to export", { appName: "Registry Editor" });
        return;
      }
      const keySegs = getPathSegments(targetPath);
      const baseName = (keySegs[keySegs.length - 1] || "registry").replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.reg`;
      a.click();
      URL.revokeObjectURL(url);
      showAppToast(`Exported ${baseName}.reg`, { appName: "Registry Editor" });
    },
    [tree, selectedPath],
  );

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const { tree: nextTree, importedKeys, firstKeyPath } = importRegFileIntoTree(tree, text);
      if (importedKeys === 0) {
        showAppToast("No valid registry entries found in file", { appName: "Registry Editor" });
        return;
      }
      setTree(nextTree);
      if (firstKeyPath) {
        setSelectedPath(firstKeyPath);
        setExpandedPaths((prev) => new Set([...prev, ...getAncestors(firstKeyPath)]));
      }
      showAppToast(`Imported ${importedKeys} key(s) from ${file.name}`, {
        appName: "Registry Editor",
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyKeyName = useCallback((path: string) => {
    const clean = path.replace(/^Computer\\/, "");
    void navigator.clipboard?.writeText(clean);
    showAppToast(`Copied "${clean}"`, { appName: "Registry Editor" });
  }, []);

  const isFavorite = favorites.includes(selectedPath);
  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }, []);

  // Global keyboard shortcuts inside Registry Editor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      const activeEl = document.activeElement;
      const inInput =
        activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsFindOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 40);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setIsEditingAddress(true);
        setTimeout(() => addressInputRef.current?.select(), 30);
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        setTree((prev) => cloneRegistryTree(prev));
        showAppToast("Registry refreshed", { appName: "Registry Editor" });
        return;
      }
      if (inInput || editModal || promptModal || confirmModal || isFindOpen || isAboutOpen) {
        return;
      }
      if (e.key === "Delete") {
        if (selectedValueName !== null && selectedValueName !== "") {
          setConfirmModal({
            kind: "delete-value",
            path: selectedPath,
            valueName: selectedValueName,
          });
        } else if (!isProtectedKeyPath(selectedPath)) {
          setConfirmModal({ kind: "delete-key", path: selectedPath });
        }
      } else if (e.key === "F2") {
        if (selectedValueName !== null && selectedValueName !== "") {
          setPromptModal({
            kind: "rename-value",
            path: selectedPath,
            oldName: selectedValueName,
            value: selectedValueName,
          });
        } else if (!isProtectedKeyPath(selectedPath)) {
          const segs = getPathSegments(selectedPath);
          setPromptModal({
            kind: "rename-key",
            path: selectedPath,
            value: segs[segs.length - 1] ?? "",
          });
        }
      } else if (e.key === "Enter" && selectedValue) {
        e.preventDefault();
        openEditValueModal(selectedPath, selectedValue);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    editModal,
    promptModal,
    confirmModal,
    isFindOpen,
    isAboutOpen,
    selectedValueName,
    selectedPath,
    selectedValue,
    openEditValueModal,
  ]);

  const findResults = useMemo<RegSearchResult[]>(() => {
    if (!isFindOpen || !findQuery.trim()) return [];
    return searchRegistryTree(tree, findQuery, {
      searchKeys: findInKeys,
      searchValues: findInValues,
      searchData: findInData,
      matchWhole: findMatchWhole,
      startPath: findStartScope === "current" ? selectedPath : undefined,
      limit: 100,
    });
  }, [
    isFindOpen,
    findQuery,
    tree,
    findInKeys,
    findInValues,
    findInData,
    findMatchWhole,
    findStartScope,
    selectedPath,
  ]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: RegKeyNode, fullPath: string, depth: number) => {
    const childNames = getSortedChildNames(node);
    const hasChildren = childNames.length > 0;
    const isExpanded = expandedPaths.has(fullPath);
    const isSelected = selectedPath === fullPath;
    const isRoot = fullPath === "Computer";
    const isHive = depth === 1;

    return (
      <div key={fullPath}>
        <div
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={hasChildren ? isExpanded : undefined}
          onClick={() => {
            navigateToPath(fullPath, true);
          }}
          onDoubleClick={() => {
            if (hasChildren) toggleExpand(fullPath);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateToPath(fullPath, true);
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              target: { kind: "tree", path: fullPath },
            });
          }}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          className={`group relative flex items-center gap-1.5 h-[28px] pr-2 mx-1 rounded-[5px] text-[12.5px] cursor-pointer select-none transition-colors ${
            isSelected
              ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#111827] dark:text-white font-medium"
              : "text-[#27272a] dark:text-[#d4d4d8] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
          }`}
        >
          {/* WinUI 3 active vertical indicator pill */}
          {isSelected && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-[5px] bottom-[5px] w-[3px] rounded-full bg-[#0067b8] dark:bg-[#4cc2ff]"
            />
          )}

          <button
            type="button"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(fullPath);
            }}
            className={`w-4 h-4 flex items-center justify-center rounded-[3px] shrink-0 transition-colors ${
              hasChildren
                ? "text-black/50 dark:text-white/55 hover:bg-black/10 dark:hover:bg-white/10"
                : "opacity-0 pointer-events-none"
            }`}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {isRoot ? (
            <Monitor className="w-4 h-4 shrink-0 text-[#0067b8] dark:text-[#4cc2ff]" />
          ) : isExpanded ? (
            <FolderOpen
              className={`w-4 h-4 shrink-0 ${
                isHive ? "text-[#d97706] dark:text-[#fbbf24]" : "text-[#eab308] dark:text-[#facc15]"
              }`}
            />
          ) : (
            <Folder
              className={`w-4 h-4 shrink-0 ${
                isHive ? "text-[#d97706] dark:text-[#fbbf24]" : "text-[#eab308] dark:text-[#facc15]"
              }`}
            />
          )}

          <span className="truncate">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {childNames.map((childName) => {
              const childNode = node.children[childName];
              if (!childNode) return null;
              return renderTreeNode(childNode, `${fullPath}\\${childName}`, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  const pathSegments = useMemo(() => getPathSegments(selectedPath), [selectedPath]);
  const childKeyCount = currentNode ? Object.keys(currentNode.children).length : 0;

  const hiveItems = useMemo(
    () => [
      {
        id: "hive-hkcr",
        label: "HKEY_CLASSES_ROOT",
        shortLabel: "HKCR",
        path: "Computer\\HKEY_CLASSES_ROOT",
        Icon: FileCode,
      },
      {
        id: "hive-hkcu",
        label: "HKEY_CURRENT_USER",
        shortLabel: "HKCU",
        path: "Computer\\HKEY_CURRENT_USER",
        Icon: User,
      },
      {
        id: "hive-hklm",
        label: "HKEY_LOCAL_MACHINE",
        shortLabel: "HKLM",
        path: "Computer\\HKEY_LOCAL_MACHINE",
        Icon: HardDrive,
      },
      {
        id: "hive-hku",
        label: "HKEY_USERS",
        shortLabel: "HKU",
        path: "Computer\\HKEY_USERS",
        Icon: Layers,
      },
      {
        id: "hive-hkcc",
        label: "HKEY_CURRENT_CONFIG",
        shortLabel: "HKCC",
        path: "Computer\\HKEY_CURRENT_CONFIG",
        Icon: Cpu,
      },
    ],
    [],
  );

  const showSidebarTooltip = (label: string, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setNavTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    });
  };

  const renderHamburgerNavBody = (collapsed: boolean) => {
    const isComputerActive = !isSettingsView && selectedPath === "Computer";
    return (
      <>
        <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-2 space-y-0.5">
          {/* Computer root */}
          <button
            type="button"
            onClick={() => {
              setIsSettingsView(false);
              navigateToPath("Computer", true);
              setIsNavDrawerOpen(false);
            }}
            onMouseEnter={collapsed ? (e) => showSidebarTooltip("Computer", e) : undefined}
            onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
            aria-label="Computer"
            className={`relative w-full h-[32px] flex items-center ${
              collapsed ? "justify-center px-0" : "gap-2.5 px-3"
            } rounded-[6px] text-[12.5px] text-left transition-colors cursor-pointer border-none ${
              isComputerActive
                ? "bg-black/[0.07] dark:bg-white/[0.1] text-[#111827] dark:text-white font-semibold"
                : "text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            {isComputerActive && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[14px] bg-[#0067b8] dark:bg-[#4cc2ff] rounded-full pointer-events-none"
              />
            )}
            <Monitor className="w-4 h-4 shrink-0 text-[#0067b8] dark:text-[#4cc2ff]" />
            {!collapsed && <span className="truncate">Computer</span>}
          </button>

          <div role="separator" className="my-1.5 mx-1.5 h-[1px] bg-black/10 dark:bg-white/10" />

          {!collapsed && (
            <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
              Registry Hives
            </div>
          )}

          {hiveItems.map(({ id, label, path, Icon }) => {
            const active =
              !isSettingsView && (selectedPath === path || selectedPath.startsWith(`${path}\\`));
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setIsSettingsView(false);
                  navigateToPath(path, true);
                  setIsNavDrawerOpen(false);
                }}
                onMouseEnter={collapsed ? (e) => showSidebarTooltip(label, e) : undefined}
                onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
                aria-label={label}
                className={`relative w-full h-[32px] flex items-center ${
                  collapsed ? "justify-center px-0" : "gap-2.5 px-3"
                } rounded-[6px] text-[12.5px] text-left transition-colors cursor-pointer border-none ${
                  active
                    ? "bg-black/[0.07] dark:bg-white/[0.1] text-[#111827] dark:text-white font-semibold"
                    : "text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[14px] bg-[#0067b8] dark:bg-[#4cc2ff] rounded-full pointer-events-none"
                  />
                )}
                <Icon className="w-4 h-4 shrink-0 text-[#d97706] dark:text-[#fbbf24]" />
                {!collapsed && <span className="truncate">{label}</span>}
              </button>
            );
          })}

          {favorites.length > 0 && (
            <>
              <div
                role="separator"
                className="my-1.5 mx-1.5 h-[1px] bg-black/10 dark:bg-white/10"
              />
              {!collapsed && (
                <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                  Favorites
                </div>
              )}
              {favorites.slice(0, 6).map((fav) => {
                const segs = getPathSegments(fav);
                const shortName = segs[segs.length - 1] || fav;
                const active = !isSettingsView && selectedPath === fav;
                return (
                  <button
                    key={fav}
                    type="button"
                    onClick={() => {
                      setIsSettingsView(false);
                      navigateToPath(fav, true);
                      setIsNavDrawerOpen(false);
                    }}
                    onMouseEnter={collapsed ? (e) => showSidebarTooltip(shortName, e) : undefined}
                    onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
                    aria-label={shortName}
                    className={`relative w-full h-[32px] flex items-center ${
                      collapsed ? "justify-center px-0" : "gap-2.5 px-3"
                    } rounded-[6px] text-[12.5px] text-left transition-colors cursor-pointer border-none ${
                      active
                        ? "bg-black/[0.07] dark:bg-white/[0.1] text-[#111827] dark:text-white font-semibold"
                        : "text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[14px] bg-[#0067b8] dark:bg-[#4cc2ff] rounded-full pointer-events-none"
                      />
                    )}
                    <Star className="w-3.5 h-3.5 shrink-0 fill-amber-400 text-amber-500" />
                    {!collapsed && <span className="truncate">{shortName}</span>}
                  </button>
                );
              })}
            </>
          )}

          <div role="separator" className="my-1.5 mx-1.5 h-[1px] bg-black/10 dark:bg-white/10" />

          <button
            type="button"
            onClick={() => {
              setIsSettingsView(false);
              setIsNavDrawerOpen(false);
              setIsFindOpen(true);
              setTimeout(() => findInputRef.current?.focus(), 40);
            }}
            onMouseEnter={collapsed ? (e) => showSidebarTooltip("Find in Registry", e) : undefined}
            onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
            aria-label="Find in Registry"
            className={`w-full h-[32px] flex items-center ${
              collapsed ? "justify-center px-0" : "gap-2.5 px-3"
            } rounded-[6px] text-[12.5px] text-left text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer border-none`}
          >
            <Search className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Find in Registry</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsNavDrawerOpen(false);
              fileInputRef.current?.click();
            }}
            onMouseEnter={collapsed ? (e) => showSidebarTooltip("Import (.reg)", e) : undefined}
            onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
            aria-label="Import (.reg)"
            className={`w-full h-[32px] flex items-center ${
              collapsed ? "justify-center px-0" : "gap-2.5 px-3"
            } rounded-[6px] text-[12.5px] text-left text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer border-none`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Import (.reg)</span>}
          </button>

          <button
            type="button"
            disabled={selectedPath === "Computer"}
            onClick={() => {
              setIsNavDrawerOpen(false);
              handleExportReg(selectedPath);
            }}
            onMouseEnter={collapsed ? (e) => showSidebarTooltip("Export (.reg)", e) : undefined}
            onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
            aria-label="Export (.reg)"
            className={`w-full h-[32px] flex items-center ${
              collapsed ? "justify-center px-0" : "gap-2.5 px-3"
            } rounded-[6px] text-[12.5px] text-left text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer border-none`}
          >
            <Download className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Export (.reg)</span>}
          </button>
        </div>

        {/* Settings anchored at bottom of Hamburger Menu */}
        <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsSettingsView((v) => !v);
              setIsNavDrawerOpen(false);
            }}
            onMouseEnter={collapsed ? (e) => showSidebarTooltip("Settings", e) : undefined}
            onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
            aria-label="Settings"
            aria-current={isSettingsView ? "page" : undefined}
            className={`relative w-full h-[34px] flex items-center ${
              collapsed ? "justify-center px-0" : "gap-2.5 px-3"
            } rounded-[6px] text-[13px] text-left transition-colors cursor-pointer border-none ${
              isSettingsView
                ? "bg-black/[0.07] dark:bg-white/[0.1] text-[#111827] dark:text-white font-semibold"
                : "text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            {isSettingsView && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[15px] bg-[#0067b8] dark:bg-[#4cc2ff] rounded-full pointer-events-none"
              />
            )}
            <FluentSettingsIcon className="w-[18px] h-[18px] shrink-0 settings-spin-icon text-black dark:text-white" />
            {!collapsed && <span className="truncate">Settings</span>}
          </button>
        </div>
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      id="winui-registry-editor"
      onClick={() => setContextMenu(null)}
      className="relative w-full h-full flex flex-row overflow-hidden bg-[#f3f3f3] dark:bg-[#1e2126] text-[#18181b] dark:text-[#f4f4f5] select-none"
    >
      {/* Hidden .reg file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".reg,.txt"
        className="hidden"
        onChange={handleImportFileChange}
      />

      {/* Desktop WinUI 3 Hamburger NavigationView Sidebar */}
      {!isCompactContainer && (
        <aside
          aria-label="Registry Editor navigation"
          className={`hidden md:flex relative z-20 h-full flex-col bg-[#eeeeee]/90 dark:bg-[#1b1e23]/95 border-r border-black/[0.07] dark:border-white/[0.08] shrink-0 transition-[width] duration-150 ${
            isNavCollapsed ? "w-[52px]" : "w-[232px]"
          }`}
        >
          <div
            className={`pt-2 pb-1.5 flex items-center ${
              isNavCollapsed ? "justify-center px-1" : "gap-1.5 px-2.5"
            } shrink-0`}
          >
            <button
              type="button"
              id="btn-regedit-hamburger"
              onClick={() => setIsNavCollapsed((v) => !v)}
              aria-label={isNavCollapsed ? "Expand navigation" : "Collapse navigation"}
              className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer border-none bg-transparent shrink-0"
            >
              <Menu className="w-4 h-4 stroke-[1.75]" />
            </button>
            {!isNavCollapsed && (
              <div className="flex items-center gap-2 min-w-0 px-1">
                <Fluent3DRegistryEditorIcon className="w-4 h-4 shrink-0" />
                <span className="text-[13px] font-semibold truncate">Registry Editor</span>
              </div>
            )}
          </div>
          {renderHamburgerNavBody(isNavCollapsed)}
        </aside>
      )}

      {/* Mobile / Compact Slide-in Hamburger Drawer */}
      <AnimatePresence>
        {isNavDrawerOpen && (
          <div className="absolute inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setIsNavDrawerOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.aside
              aria-label="Registry Editor navigation"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 w-[248px] max-w-[85%] h-full flex flex-col bg-[#f5f5f5]/95 dark:bg-[#202329]/95 backdrop-blur-2xl border-r border-black/10 dark:border-white/10 shadow-2xl"
            >
              <div className="px-2.5 pt-2.5 pb-2 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 px-1">
                  <Fluent3DRegistryEditorIcon className="w-4 h-4 shrink-0" />
                  <span className="text-[13px] font-semibold truncate">Registry Editor</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNavDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer border-none bg-transparent shrink-0"
                >
                  <X className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>
              {renderHamburgerNavBody(false)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Collapsed Hamburger Tooltip */}
      {isNavCollapsed && navTooltip && !isCompactContainer && (
        <div
          style={{ top: navTooltip.top, left: navTooltip.left }}
          className="fixed -translate-y-1/2 z-[9999] pointer-events-none px-2.5 py-1 rounded-[5px] bg-[#2c3037] text-white text-[11.5px] font-medium shadow-md border border-white/10 whitespace-nowrap"
        >
          {navTooltip.label}
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        {isSettingsView ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 py-5">
            <div className="max-w-[740px] mx-auto space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsNavDrawerOpen(true)}
                    aria-label="Open navigation"
                    className={`${isCompactContainer ? "flex" : "md:hidden flex"} w-8 h-8 rounded-[6px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] items-center justify-center cursor-pointer border border-black/10 dark:border-white/10`}
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                  <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsView(false)}
                  className="h-8 px-3 rounded-[6px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.07] hover:bg-black/5 dark:hover:bg-white/10 text-[12.5px] font-medium cursor-pointer"
                >
                  Back to Editor
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Hash className="w-4 h-4 text-[#0067b8] dark:text-[#4cc2ff] shrink-0" />
                    <div>
                      <div className="text-[13.5px] font-medium">Default numeric base</div>
                      <div className="text-[11.5px] text-black/55 dark:text-white/55">
                        Initial base when opening DWORD (32-bit) or QWORD (64-bit) values
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        ["hex", "Hexadecimal"],
                        ["dec", "Decimal"],
                      ] as const
                    ).map(([baseKey, baseLabel]) => (
                      <button
                        key={baseKey}
                        type="button"
                        onClick={() => setDefaultNumBase(baseKey)}
                        className={`h-8 px-3 rounded-[6px] border text-[12px] font-medium cursor-pointer transition-colors ${
                          defaultNumBase === baseKey
                            ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent font-semibold"
                            : "bg-white dark:bg-white/[0.08] border-black/15 dark:border-white/15 hover:bg-black/[0.04]"
                        }`}
                      >
                        {baseLabel}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <SlidersHorizontal className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="text-[13.5px] font-medium">Workspace panes</div>
                      <div className="text-[11.5px] text-black/55 dark:text-white/55">
                        Toggle Address Bar, Inspector Pane, and Status Bar visibility
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAddressBar((v) => !v)}
                      className={`h-7 px-2.5 rounded-[5px] border text-[11.5px] font-medium cursor-pointer ${
                        showAddressBar
                          ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent"
                          : "border-black/15 dark:border-white/15"
                      }`}
                    >
                      Address Bar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInspector((v) => !v)}
                      className={`h-7 px-2.5 rounded-[5px] border text-[11.5px] font-medium cursor-pointer ${
                        showInspector
                          ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent"
                          : "border-black/15 dark:border-white/15"
                      }`}
                    >
                      Inspector
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStatusBar((v) => !v)}
                      className={`h-7 px-2.5 rounded-[5px] border text-[11.5px] font-medium cursor-pointer ${
                        showStatusBar
                          ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent"
                          : "border-black/15 dark:border-white/15"
                      }`}
                    >
                      Status Bar
                    </button>
                  </div>
                </div>

                <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-4 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13.5px] font-medium">Reset registry hives</div>
                    <div className="text-[11.5px] text-black/55 dark:text-white/55">
                      Restore all custom keys and values to SparkleOS Build 28000.14 defaults
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ kind: "reset-registry" })}
                    className="h-8 px-3.5 rounded-[6px] border border-rose-500/35 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-[12px] font-medium cursor-pointer"
                  >
                    Reset to Defaults
                  </button>
                </div>

                <div className="pt-2 space-y-2">
                  <h3 className="text-[13px] font-semibold">About</h3>
                  <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.07]">
                    <button
                      type="button"
                      onClick={() => setAboutExpanded((v) => !v)}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer border-none bg-transparent text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Info className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="text-[13.5px] font-medium">Registry Editor</div>
                          <div className="text-[11.5px] tabular-nums text-black/60 dark:text-white/60">
                            Version: 22631.28000.14 · Build 28000.14
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform shrink-0 ${
                          aboutExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {aboutExpanded && navigate && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate("/pc-settings")}
                          className="w-full px-11 py-2.5 flex items-center justify-between text-[12.5px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer border-none bg-transparent text-left"
                        >
                          <span>Open PC Settings</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/settings")}
                          className="w-full px-11 py-2.5 flex items-center justify-between text-[12.5px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer border-none bg-transparent text-left"
                        >
                          <span>Open Sparkle Settings</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 1. WinUI 3 MenuBar + CommandBar */}
            <header className="shrink-0 border-b border-black/[0.07] dark:border-white/[0.08] bg-[#f8f9fa]/90 dark:bg-[#24282e]/90 backdrop-blur-xl">
              {/* Menu Bar row */}
              <div
                data-regedit-menubar="true"
                className="flex items-center justify-between px-3 h-[34px] border-b border-black/[0.05] dark:border-white/[0.05]"
              >
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setIsNavDrawerOpen(true)}
                    aria-label="Open navigation"
                    className={`${isCompactContainer ? "flex" : "md:hidden flex"} w-7 h-7 mr-1 rounded-[5px] items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer border-none bg-transparent shrink-0`}
                  >
                    <Menu className="w-4 h-4 stroke-[1.75]" />
                  </button>
                  <div className="flex items-center gap-2 pr-3 mr-1 border-r border-black/10 dark:border-white/10">
                    <Fluent3DRegistryEditorIcon className="w-4 h-4" />
                    <span className="text-[12.5px] font-semibold tracking-tight whitespace-nowrap">
                      Registry Editor
                    </span>
                  </div>

                  {(
                    [
                      { id: "file", label: "File" },
                      { id: "edit", label: "Edit" },
                      { id: "view", label: "View" },
                      { id: "favorites", label: "Favorites" },
                      { id: "help", label: "Help" },
                    ] as const
                  ).map((m) => (
                    <div key={m.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenu((prev) => (prev === m.id ? null : m.id))}
                        className={`px-2.5 py-1 rounded-[5px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          openMenu === m.id
                            ? "bg-black/[0.08] dark:bg-white/[0.1]"
                            : "hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                        }`}
                      >
                        {m.label}
                      </button>

                      {openMenu === m.id && (
                        <div
                          className={`${flyoutPanelClassName} absolute left-0 top-full mt-1 min-w-[220px] p-1 z-50`}
                          style={flyoutPanelStyle}
                        >
                          {m.id === "file" && (
                            <>
                              <MenuRow
                                icon={<Upload className="w-3.5 h-3.5" />}
                                label="Import (.reg)..."
                                onClick={() => {
                                  setOpenMenu(null);
                                  fileInputRef.current?.click();
                                }}
                              />
                              <MenuRow
                                icon={<Download className="w-3.5 h-3.5" />}
                                label="Export selected key (.reg)..."
                                disabled={selectedPath === "Computer"}
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleExportReg(selectedPath);
                                }}
                              />
                              <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                              <MenuRow
                                icon={<RotateCcw className="w-3.5 h-3.5" />}
                                label="Reset Registry to Defaults"
                                onClick={() => {
                                  setOpenMenu(null);
                                  setConfirmModal({ kind: "reset-registry" });
                                }}
                              />
                              {navigate && (
                                <>
                                  <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                                  <MenuRow
                                    icon={<X className="w-3.5 h-3.5" />}
                                    label="Exit"
                                    onClick={() => {
                                      setOpenMenu(null);
                                      navigate("/");
                                    }}
                                  />
                                </>
                              )}
                            </>
                          )}

                          {m.id === "edit" && (
                            <>
                              <MenuRow
                                icon={<FolderPlus className="w-3.5 h-3.5" />}
                                label="New Key"
                                disabled={selectedPath === "Computer"}
                                onClick={() => {
                                  setOpenMenu(null);
                                  setPromptModal({
                                    kind: "new-key",
                                    parentPath: selectedPath,
                                    value: "New Key #1",
                                  });
                                }}
                              />
                              <MenuRow
                                icon={<Type className="w-3.5 h-3.5" />}
                                label="New String Value"
                                disabled={selectedPath === "Computer"}
                                onClick={() => {
                                  setOpenMenu(null);
                                  setPromptModal({
                                    kind: "new-value",
                                    path: selectedPath,
                                    regType: "REG_SZ",
                                    value: "New Value #1",
                                  });
                                }}
                              />
                              <MenuRow
                                icon={<Hash className="w-3.5 h-3.5" />}
                                label="New DWORD (32-bit) Value"
                                disabled={selectedPath === "Computer"}
                                onClick={() => {
                                  setOpenMenu(null);
                                  setPromptModal({
                                    kind: "new-value",
                                    path: selectedPath,
                                    regType: "REG_DWORD",
                                    value: "New Value #1",
                                  });
                                }}
                              />
                              <MenuRow
                                icon={<Hash className="w-3.5 h-3.5" />}
                                label="New QWORD (64-bit) Value"
                                disabled={selectedPath === "Computer"}
                                onClick={() => {
                                  setOpenMenu(null);
                                  setPromptModal({
                                    kind: "new-value",
                                    path: selectedPath,
                                    regType: "REG_QWORD",
                                    value: "New Value #1",
                                  });
                                }}
                              />
                              <MenuRow
                                icon={<Binary className="w-3.5 h-3.5" />}
                                label="New Binary Value"
                                disabled={selectedPath === "Computer"}
                                onClick={() => {
                                  setOpenMenu(null);
                                  setPromptModal({
                                    kind: "new-value",
                                    path: selectedPath,
                                    regType: "REG_BINARY",
                                    value: "New Value #1",
                                  });
                                }}
                              />
                              <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                              <MenuRow
                                icon={<Pencil className="w-3.5 h-3.5" />}
                                label="Modify..."
                                disabled={!selectedValue}
                                onClick={() => {
                                  setOpenMenu(null);
                                  if (selectedValue)
                                    openEditValueModal(selectedPath, selectedValue);
                                }}
                              />
                              <MenuRow
                                icon={<Copy className="w-3.5 h-3.5" />}
                                label="Copy Key Name"
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleCopyKeyName(selectedPath);
                                }}
                              />
                              <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                              <MenuRow
                                icon={<Search className="w-3.5 h-3.5" />}
                                label="Find..."
                                shortcut="Ctrl+F"
                                onClick={() => {
                                  setOpenMenu(null);
                                  setIsFindOpen(true);
                                  setTimeout(() => findInputRef.current?.focus(), 40);
                                }}
                              />
                            </>
                          )}

                          {m.id === "view" && (
                            <>
                              <MenuRow
                                icon={
                                  showAddressBar ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <span className="w-3.5" />
                                  )
                                }
                                label="Address Bar"
                                onClick={() => {
                                  setShowAddressBar((v) => !v);
                                  setOpenMenu(null);
                                }}
                              />
                              <MenuRow
                                icon={
                                  showInspector ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <span className="w-3.5" />
                                  )
                                }
                                label="Details Inspector Pane"
                                onClick={() => {
                                  setShowInspector((v) => !v);
                                  setOpenMenu(null);
                                }}
                              />
                              <MenuRow
                                icon={
                                  showStatusBar ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <span className="w-3.5" />
                                  )
                                }
                                label="Status Bar"
                                onClick={() => {
                                  setShowStatusBar((v) => !v);
                                  setOpenMenu(null);
                                }}
                              />
                              <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                              <MenuRow
                                icon={<RefreshCw className="w-3.5 h-3.5" />}
                                label="Refresh"
                                shortcut="F5"
                                onClick={() => {
                                  setTree((prev) => cloneRegistryTree(prev));
                                  setOpenMenu(null);
                                  showAppToast("Registry refreshed", {
                                    appName: "Registry Editor",
                                  });
                                }}
                              />
                              <MenuRow
                                icon={<ChevronsUpDown className="w-3.5 h-3.5" />}
                                label="Collapse All Keys"
                                onClick={() => {
                                  setExpandedPaths(new Set(["Computer"]));
                                  setOpenMenu(null);
                                }}
                              />
                            </>
                          )}

                          {m.id === "favorites" && (
                            <>
                              <MenuRow
                                icon={<Star className="w-3.5 h-3.5" />}
                                label={
                                  isFavorite
                                    ? "Remove Current Key from Favorites"
                                    : "Add Current Key to Favorites"
                                }
                                onClick={() => {
                                  toggleFavorite(selectedPath);
                                  setOpenMenu(null);
                                }}
                              />
                              {favorites.length > 0 && (
                                <>
                                  <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                                  {favorites.map((fav) => {
                                    const label = fav.replace(/^Computer\\/, "");
                                    return (
                                      <MenuRow
                                        key={fav}
                                        icon={<Folder className="w-3.5 h-3.5 text-amber-500" />}
                                        label={label}
                                        onClick={() => {
                                          navigateToPath(fav, true);
                                          setOpenMenu(null);
                                        }}
                                      />
                                    );
                                  })}
                                </>
                              )}
                            </>
                          )}

                          {m.id === "help" && (
                            <MenuRow
                              icon={<Info className="w-3.5 h-3.5" />}
                              label="About Registry Editor"
                              onClick={() => {
                                setOpenMenu(null);
                                setIsAboutOpen(true);
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {isLiveBridgeKey && (
                  <div className="hidden sm:flex items-center gap-1.5 text-[11.5px] font-medium text-[#0067b8] dark:text-[#4cc2ff] whitespace-nowrap">
                    <span>Live SparkleOS Sync Active</span>
                  </div>
                )}
              </div>

              {/* Command Bar */}
              <div
                data-regedit-menubar="true"
                className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto no-scrollbar"
              >
                <ToolbarButton
                  icon={<FolderPlus className="w-3.5 h-3.5 text-[#0067b8] dark:text-[#4cc2ff]" />}
                  label="New Key"
                  disabled={selectedPath === "Computer"}
                  onClick={() =>
                    setPromptModal({
                      kind: "new-key",
                      parentPath: selectedPath,
                      value: "New Key #1",
                    })
                  }
                />

                <div ref={newValueWrapRef} className="relative">
                  <ToolbarButton
                    icon={<Plus className="w-3.5 h-3.5" />}
                    label="New Value"
                    disabled={selectedPath === "Computer"}
                    onClick={() => {
                      if (openMenu === "new-value") {
                        setOpenMenu(null);
                        return;
                      }
                      const rect = newValueWrapRef.current?.getBoundingClientRect();
                      if (rect) {
                        setNewValueMenuPos({
                          left: Math.max(8, Math.min(rect.left, window.innerWidth - 220)),
                          top: rect.bottom + 4,
                        });
                      }
                      setOpenMenu("new-value");
                    }}
                  />
                  {openMenu === "new-value" &&
                    newValueMenuPos &&
                    createPortal(
                      <div
                        data-regedit-menubar="true"
                        className={`${flyoutPanelClassName} fixed min-w-[215px] p-1 z-[2147483645]`}
                        style={{
                          ...flyoutPanelStyle,
                          left: newValueMenuPos.left,
                          top: newValueMenuPos.top,
                        }}
                      >
                        {(
                          [
                            { type: "REG_SZ", label: "String Value (REG_SZ)" },
                            { type: "REG_BINARY", label: "Binary Value (REG_BINARY)" },
                            { type: "REG_DWORD", label: "DWORD (32-bit) Value" },
                            { type: "REG_QWORD", label: "QWORD (64-bit) Value" },
                            { type: "REG_MULTI_SZ", label: "Multi-String Value" },
                            { type: "REG_EXPAND_SZ", label: "Expandable String Value" },
                          ] as const
                        ).map((item) => (
                          <MenuRow
                            key={item.type}
                            icon={<ValueTypeBadgeIcon type={item.type} />}
                            label={item.label}
                            onClick={() => {
                              setOpenMenu(null);
                              setPromptModal({
                                kind: "new-value",
                                path: selectedPath,
                                regType: item.type,
                                value: "New Value #1",
                              });
                            }}
                          />
                        ))}
                      </div>,
                      document.body,
                    )}
                </div>

                <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1 shrink-0" />

                <ToolbarButton
                  icon={<Pencil className="w-3.5 h-3.5" />}
                  label="Modify"
                  disabled={!selectedValue}
                  onClick={() => selectedValue && openEditValueModal(selectedPath, selectedValue)}
                />
                <ToolbarButton
                  icon={<Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                  label="Delete"
                  disabled={
                    (!selectedValueName || selectedValueName === "") &&
                    isProtectedKeyPath(selectedPath)
                  }
                  onClick={() => {
                    if (selectedValueName !== null && selectedValueName !== "") {
                      setConfirmModal({
                        kind: "delete-value",
                        path: selectedPath,
                        valueName: selectedValueName,
                      });
                    } else if (!isProtectedKeyPath(selectedPath)) {
                      setConfirmModal({ kind: "delete-key", path: selectedPath });
                    }
                  }}
                />

                <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1 shrink-0" />

                <ToolbarButton
                  icon={<Upload className="w-3.5 h-3.5" />}
                  label="Import"
                  onClick={() => fileInputRef.current?.click()}
                />
                <ToolbarButton
                  icon={<Download className="w-3.5 h-3.5" />}
                  label="Export"
                  disabled={selectedPath === "Computer"}
                  onClick={() => handleExportReg(selectedPath)}
                />

                <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1 shrink-0" />

                <ToolbarButton
                  icon={<Search className="w-3.5 h-3.5" />}
                  label="Find"
                  onClick={() => {
                    setIsFindOpen(true);
                    setTimeout(() => findInputRef.current?.focus(), 40);
                  }}
                />
                <ToolbarButton
                  icon={
                    <Star
                      className={`w-3.5 h-3.5 ${isFavorite ? "fill-amber-400 text-amber-500" : ""}`}
                    />
                  }
                  label={isFavorite ? "Favorited" : "Favorite"}
                  onClick={() => toggleFavorite(selectedPath)}
                />
                <ToolbarButton
                  icon={<PanelRight className="w-3.5 h-3.5" />}
                  label="Inspector"
                  active={showInspector}
                  onClick={() => setShowInspector((v) => !v)}
                />
              </div>

              {/* 2. Address Bar & Filter Row */}
              {showAddressBar && (
                <div className="flex items-center gap-2 px-3 pb-2">
                  {/* Back / Forward / Up */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      aria-label="Back"
                      disabled={!canGoBack}
                      onClick={handleBack}
                      className="w-7 h-7 flex items-center justify-center rounded-[5px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Forward"
                      disabled={!canGoForward}
                      onClick={handleForward}
                      className="w-7 h-7 flex items-center justify-center rounded-[5px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Up one level"
                      disabled={!parentPath}
                      onClick={handleUp}
                      className="w-7 h-7 flex items-center justify-center rounded-[5px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Interactive Breadcrumb / Path Input */}
                  <div
                    onClick={() => {
                      if (!isEditingAddress) {
                        setIsEditingAddress(true);
                        setTimeout(() => addressInputRef.current?.select(), 15);
                      }
                    }}
                    className="flex-1 min-w-0 h-8 rounded-[6px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-[#2c3138]/90 px-2.5 flex items-center text-[12.5px] focus-within:border-b-2 focus-within:border-b-[#0067b8] dark:focus-within:border-b-[#4cc2ff] cursor-text"
                  >
                    {isEditingAddress ? (
                      <form
                        className="w-full"
                        onSubmit={(e) => {
                          e.preventDefault();
                          navigateToPath(addressInput, true);
                          setIsEditingAddress(false);
                        }}
                      >
                        <input
                          ref={addressInputRef}
                          value={addressInput}
                          onChange={(e) => setAddressInput(e.target.value)}
                          onBlur={() => setIsEditingAddress(false)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setAddressInput(selectedPath);
                              setIsEditingAddress(false);
                            }
                          }}
                          placeholder="Computer\HKEY_CURRENT_USER\..."
                          className="w-full bg-transparent outline-none font-mono text-[12px] text-[#18181b] dark:text-white"
                        />
                      </form>
                    ) : (
                      <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar w-full">
                        {pathSegments.map((seg, idx) => {
                          const segPath = pathSegments.slice(0, idx + 1).join("\\");
                          const isLast = idx === pathSegments.length - 1;
                          return (
                            <React.Fragment key={segPath}>
                              {idx > 0 && (
                                <ChevronRight className="w-3 h-3 text-black/40 dark:text-white/40 shrink-0" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToPath(segPath, true);
                                }}
                                className={`px-1.5 py-0.5 rounded-[4px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                  isLast
                                    ? "font-medium text-[#111827] dark:text-white"
                                    : "text-black/65 dark:text-white/65 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                                }`}
                              >
                                {seg}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick Value Filter */}
                  <div className="relative w-44 sm:w-56 shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-black/45 dark:text-white/45 pointer-events-none" />
                    <input
                      value={quickFilter}
                      onChange={(e) => setQuickFilter(e.target.value)}
                      placeholder="Filter values in key"
                      className="w-full h-8 rounded-[6px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-[#2c3138]/90 pl-8 pr-7 text-[12px] outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                    />
                    {quickFilter && (
                      <button
                        type="button"
                        aria-label="Clear filter"
                        onClick={() => setQuickFilter("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-black/45 dark:text-white/45 hover:text-black dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </header>

            {/* 3. Main Split Workspace */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left Navigation TreeView */}
              <aside
                style={{ width: `${treeWidth}px` }}
                className="shrink-0 h-full flex flex-col border-r border-black/[0.07] dark:border-white/[0.08] bg-[#f6f6f7]/80 dark:bg-[#202329]/85 overflow-hidden"
              >
                {/* Favorites quick list */}
                {favorites.length > 0 && (
                  <div className="border-b border-black/[0.06] dark:border-white/[0.06] py-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowFavoritesSection((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-semibold text-black/55 dark:text-white/55 hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      <span>Favorites</span>
                      {showFavoritesSection ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {showFavoritesSection && (
                      <div className="mt-0.5 space-y-0.5 max-h-32 overflow-y-auto px-1">
                        {favorites.map((fav) => {
                          const segs = getPathSegments(fav);
                          const shortName = segs[segs.length - 1] || fav;
                          const hiveAbbr =
                            Object.entries({
                              HKEY_CURRENT_USER: "HKCU",
                              HKEY_LOCAL_MACHINE: "HKLM",
                              HKEY_CLASSES_ROOT: "HKCR",
                              HKEY_USERS: "HKU",
                              HKEY_CURRENT_CONFIG: "HKCC",
                            }).find(([k]) => segs[1] === k)?.[1] ??
                            segs[1] ??
                            "";
                          const active = selectedPath === fav;
                          return (
                            <button
                              key={fav}
                              type="button"
                              onClick={() => navigateToPath(fav, true)}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 h-7 rounded-[5px] text-[12px] text-left cursor-pointer transition-colors ${
                                active
                                  ? "bg-black/[0.06] dark:bg-white/[0.08] font-medium text-[#111827] dark:text-white"
                                  : "text-black/75 dark:text-white/75 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0 truncate">
                                <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-500" />
                                <span className="truncate">{shortName}</span>
                              </span>
                              <span className="text-[10.5px] font-mono text-black/40 dark:text-white/40 shrink-0">
                                {hiveAbbr}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Key Tree */}
                <div
                  role="tree"
                  aria-label="Registry Key Tree"
                  className="flex-1 overflow-y-auto py-2"
                >
                  {renderTreeNode(tree, "Computer", 0)}
                </div>
              </aside>

              {/* Draggable Split Handle */}
              <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={() => setIsResizingTree(true)}
                className={`w-1 shrink-0 cursor-col-resize transition-colors ${
                  isResizingTree
                    ? "bg-[#0067b8] dark:bg-[#4cc2ff]"
                    : "bg-transparent hover:bg-[#0067b8]/40 dark:hover:bg-[#4cc2ff]/40"
                }`}
              />

              {/* Center Value ListView (DataGrid) */}
              <main
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    target: { kind: "empty", path: selectedPath },
                  });
                }}
                className="flex-1 min-w-0 h-full flex flex-col bg-white/90 dark:bg-[#272b31]/90 overflow-hidden"
              >
                {/* DataGrid Header */}
                <div className="shrink-0 grid grid-cols-[minmax(160px,1.2fr)_140px_minmax(180px,2fr)] border-b border-black/[0.07] dark:border-white/[0.08] bg-[#fafafa] dark:bg-[#23272d] text-[12px] font-medium text-black/65 dark:text-white/65">
                  <button
                    type="button"
                    onClick={() => handleSort("name")}
                    className="flex items-center justify-between px-3 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border-r border-black/[0.05] dark:border-white/[0.05] cursor-pointer"
                  >
                    <span>Name</span>
                    {sortCol === "name" && (
                      <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort("type")}
                    className="flex items-center justify-between px-3 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border-r border-black/[0.05] dark:border-white/[0.05] cursor-pointer"
                  >
                    <span>Type</span>
                    {sortCol === "type" && (
                      <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSort("data")}
                    className="flex items-center justify-between px-3 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer"
                  >
                    <span>Data</span>
                    {sortCol === "data" && (
                      <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </button>
                </div>

                {/* DataGrid Rows */}
                <div className="flex-1 overflow-y-auto">
                  {selectedPath === "Computer" ? (
                    <div className="p-6 max-w-2xl">
                      <h2 className="text-[15px] font-semibold mb-1">Computer Root Hives</h2>
                      <p className="text-[12.5px] text-black/60 dark:text-white/60 mb-4">
                        Select a Windows Registry hive from the tree or below to inspect and modify
                        keys. Keys under <span className="font-mono">HKCU\Software\SparkleOS</span>{" "}
                        and <span className="font-mono">Themes\Personalize</span> apply live to
                        SparkleOS.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {ROOT_HIVES.map((hive) => (
                          <button
                            key={hive}
                            type="button"
                            onClick={() => navigateToPath(`Computer\\${hive}`, true)}
                            className="flex items-center gap-3 p-3 rounded-[8px] border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#2d3239] hover:border-[#0067b8]/50 dark:hover:border-[#4cc2ff]/50 text-left transition-colors cursor-pointer"
                          >
                            <Folder className="w-5 h-5 text-[#d97706] dark:text-[#fbbf24] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium truncate">{hive}</div>
                              <div className="text-[11px] text-black/50 dark:text-white/50 tabular-nums">
                                {Object.keys(tree.children[hive]?.children ?? {}).length} top-level
                                keys
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : currentValues.length === 0 ? (
                    <div className="p-8 text-center text-[13px] text-black/55 dark:text-white/55">
                      {quickFilter
                        ? `No values matching "${quickFilter}" in this key.`
                        : "No values in this key."}
                    </div>
                  ) : (
                    <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {currentValues.map((val) => {
                        const isRowSelected = selectedValueName === val.name;
                        const displayName = val.name === "" ? "(Default)" : val.name;
                        const preview = formatValuePreview(val);
                        const isMonoData =
                          val.type === "REG_DWORD" ||
                          val.type === "REG_QWORD" ||
                          val.type === "REG_BINARY";
                        return (
                          <div
                            key={val.name || "__default__"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedValueName(val.name);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              openEditValueModal(selectedPath, val);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedValueName(val.name);
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                target: { kind: "value", path: selectedPath, valueName: val.name },
                              });
                            }}
                            className={`grid grid-cols-[minmax(160px,1.2fr)_140px_minmax(180px,2fr)] items-center h-[34px] text-[12.5px] cursor-pointer transition-colors ${
                              isRowSelected
                                ? "bg-[#0067b8]/12 dark:bg-[#4cc2ff]/16 text-[#111827] dark:text-white"
                                : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-2 px-3 min-w-0">
                              <ValueTypeBadgeIcon type={val.type} />
                              <span
                                className={`truncate ${val.name === "" ? "italic text-black/65 dark:text-white/65" : "font-medium"}`}
                              >
                                {displayName}
                              </span>
                            </div>
                            <div className="px-3 font-mono text-[11.5px] text-black/60 dark:text-white/60 truncate">
                              {val.type}
                            </div>
                            <div
                              className={`px-3 truncate ${
                                isMonoData ? "font-mono tabular-nums text-[12px]" : ""
                              } ${
                                val.name === "" && val.data === ""
                                  ? "italic text-black/45 dark:text-white/45"
                                  : ""
                              }`}
                            >
                              {preview}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </main>

              {/* Right WinUI 3 Details / Inspector Pane */}
              {showInspector && (
                <aside className="hidden lg:flex w-72 shrink-0 h-full flex-col border-l border-black/[0.07] dark:border-white/[0.08] bg-[#f6f6f7]/85 dark:bg-[#202329]/85 overflow-y-auto p-4 gap-4">
                  <div>
                    <div className="text-[11px] font-semibold text-black/50 dark:text-white/50 mb-1">
                      Selected Key
                    </div>
                    <div className="text-[13px] font-semibold break-words">
                      {pathSegments[pathSegments.length - 1] ?? "Computer"}
                    </div>
                    <div className="mt-1 text-[11.5px] font-mono text-black/60 dark:text-white/60 break-all">
                      {selectedPath}
                    </div>
                  </div>

                  <div className="h-px bg-black/[0.07] dark:bg-white/[0.08]" />

                  {selectedValue ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold text-black/50 dark:text-white/50 mb-1">
                          Selected Value
                        </div>
                        <div className="flex items-center gap-2">
                          <ValueTypeBadgeIcon type={selectedValue.type} />
                          <span className="text-[13px] font-semibold break-all">
                            {selectedValue.name === "" ? "(Default)" : selectedValue.name}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[12px]">
                        <div>
                          <div className="text-[11px] text-black/50 dark:text-white/50">Type</div>
                          <div className="font-mono font-medium">{selectedValue.type}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-black/50 dark:text-white/50">Size</div>
                          <div className="font-mono tabular-nums">
                            {selectedValue.type === "REG_DWORD"
                              ? "4 bytes"
                              : selectedValue.type === "REG_QWORD"
                                ? "8 bytes"
                                : `${selectedValue.data.length} chars`}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-black/50 dark:text-white/50 mb-1">
                          Formatted Data
                        </div>
                        <div className="p-2.5 rounded-[6px] border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[#2a2e35] font-mono text-[11.5px] break-all whitespace-pre-wrap max-h-40 overflow-y-auto tabular-nums">
                          {formatValuePreview(selectedValue)}
                        </div>
                      </div>

                      {selectedValue.type === "REG_BINARY" && selectedValue.data && (
                        <div>
                          <div className="text-[11px] text-black/50 dark:text-white/50 mb-1">
                            ASCII Preview
                          </div>
                          <div className="p-2 rounded-[6px] border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[#2a2e35] font-mono text-[11.5px] break-all">
                            {binaryHexToAscii(selectedValue.data)}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openEditValueModal(selectedPath, selectedValue)}
                          className="flex-1 h-8 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          Modify Value
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditValueModal(selectedPath, selectedValue, true)}
                          className="px-2.5 h-8 rounded-[6px] border border-black/12 dark:border-white/12 bg-white/70 dark:bg-white/[0.06] text-[12px] font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          Hex
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-[12px] text-black/65 dark:text-white/65">
                      <div className="flex justify-between tabular-nums">
                        <span>Subkeys</span>
                        <span className="font-mono font-medium text-[#111827] dark:text-white">
                          {childKeyCount}
                        </span>
                      </div>
                      <div className="flex justify-between tabular-nums">
                        <span>Values</span>
                        <span className="font-mono font-medium text-[#111827] dark:text-white">
                          {currentValues.length}
                        </span>
                      </div>
                      <p className="pt-2 text-[11.5px] text-black/50 dark:text-white/50 leading-relaxed">
                        Double-click any value in the grid to modify its data, or right-click to
                        create keys and values.
                      </p>
                    </div>
                  )}

                  {isLiveBridgeKey && (
                    <div className="mt-auto p-3 rounded-[8px] border border-[#0067b8]/25 dark:border-[#4cc2ff]/25 bg-[#0067b8]/8 dark:bg-[#4cc2ff]/10 text-[11.5px] leading-relaxed">
                      <div className="font-semibold text-[#0067b8] dark:text-[#4cc2ff] mb-1">
                        Live SparkleOS Binding
                      </div>
                      <p className="text-black/70 dark:text-white/75">
                        Editing values in this key updates SparkleOS settings immediately (theme,
                        glass, taskbar alignment, scale, and wallpaper).
                      </p>
                    </div>
                  )}
                </aside>
              )}
            </div>

            {/* 4. Status Bar */}
            {showStatusBar && (
              <footer className="shrink-0 h-7 px-3 border-t border-black/[0.07] dark:border-white/[0.08] bg-[#f8f9fa]/95 dark:bg-[#22252b]/95 flex items-center justify-between gap-4 text-[11.5px] text-black/65 dark:text-white/65">
                <span className="font-mono truncate">{selectedPath}</span>
                <span className="shrink-0 tabular-nums whitespace-nowrap">
                  {childKeyCount} subkeys · {currentValues.length} values
                </span>
              </footer>
            )}
          </>
        )}
      </div>

      {/* Context Menu Portal */}
      {contextMenu && (
        <RegistryContextMenu
          menu={contextMenu}
          isFavorite={favorites.includes(contextMenu.target.path)}
          onClose={() => setContextMenu(null)}
          onAction={(action, extra) => {
            const target = contextMenu.target;
            setContextMenu(null);
            if (action === "new-key") {
              setPromptModal({ kind: "new-key", parentPath: target.path, value: "New Key #1" });
            } else if (action === "new-value" && extra) {
              setPromptModal({
                kind: "new-value",
                path: target.path,
                regType: extra as RegValueType,
                value: "New Value #1",
              });
            } else if (action === "rename-key") {
              const segs = getPathSegments(target.path);
              setPromptModal({
                kind: "rename-key",
                path: target.path,
                value: segs[segs.length - 1] ?? "",
              });
            } else if (action === "delete-key") {
              setConfirmModal({ kind: "delete-key", path: target.path });
            } else if (action === "export") {
              handleExportReg(target.path);
            } else if (action === "copy-path") {
              handleCopyKeyName(target.path);
            } else if (action === "toggle-fav") {
              toggleFavorite(target.path);
            } else if (action === "find-here") {
              setFindStartScope("current");
              setIsFindOpen(true);
              setTimeout(() => findInputRef.current?.focus(), 40);
            } else if (action === "modify" && target.kind === "value") {
              const found = currentValues.find((v) => v.name === target.valueName);
              if (found) openEditValueModal(target.path, found, false);
            } else if (action === "modify-binary" && target.kind === "value") {
              const found = currentValues.find((v) => v.name === target.valueName);
              if (found) openEditValueModal(target.path, found, true);
            } else if (action === "rename-value" && target.kind === "value") {
              setPromptModal({
                kind: "rename-value",
                path: target.path,
                oldName: target.valueName,
                value: target.valueName,
              });
            } else if (action === "delete-value" && target.kind === "value") {
              setConfirmModal({
                kind: "delete-value",
                path: target.path,
                valueName: target.valueName,
              });
            }
          }}
        />
      )}

      {/* Edit Value Modal */}
      <AnimatePresence>
        {editModal && (
          <WinUIDialog
            title={
              editModal.kind === "string"
                ? editModal.value.type === "REG_EXPAND_SZ"
                  ? "Edit Expandable String"
                  : "Edit String"
                : editModal.kind === "multi"
                  ? "Edit Multi-String"
                  : editModal.kind === "binary"
                    ? "Edit Binary Value"
                    : editModal.bits === 32
                      ? "Edit DWORD (32-bit) Value"
                      : "Edit QWORD (64-bit) Value"
            }
            onClose={() => setEditModal(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditModal();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[12px] font-medium text-black/65 dark:text-white/65 mb-1">
                  Value name:
                </label>
                <input
                  readOnly
                  value={editModal.value.name === "" ? "(Default)" : editModal.value.name}
                  className="w-full h-8.5 rounded-[6px] border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.05] px-3 text-[12.5px] opacity-80 outline-none"
                />
              </div>

              {(editModal.kind === "string" || editModal.kind === "multi") && (
                <div>
                  <label className="block text-[12px] font-medium text-black/65 dark:text-white/65 mb-1">
                    Value data:
                  </label>
                  {editModal.kind === "multi" ? (
                    <textarea
                      autoFocus
                      rows={6}
                      value={modalStrVal}
                      onChange={(e) => setModalStrVal(e.target.value)}
                      className="w-full rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] p-2.5 text-[12.5px] font-mono outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                    />
                  ) : (
                    <input
                      autoFocus
                      value={modalStrVal}
                      onChange={(e) => setModalStrVal(e.target.value)}
                      className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-3 text-[12.5px] outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                    />
                  )}
                </div>
              )}

              {editModal.kind === "number" && (
                <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                  <div>
                    <label className="block text-[12px] font-medium text-black/65 dark:text-white/65 mb-1">
                      Value data:
                    </label>
                    <input
                      autoFocus
                      value={modalNumVal}
                      onChange={(e) => setModalNumVal(e.target.value)}
                      className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-3 font-mono tabular-nums text-[12.5px] outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                    />
                  </div>
                  <fieldset className="rounded-[6px] border border-black/10 dark:border-white/10 p-2.5 space-y-1.5">
                    <legend className="px-1 text-[11px] font-medium text-black/60 dark:text-white/60">
                      Base
                    </legend>
                    <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input
                        type="radio"
                        checked={modalNumBase === "hex"}
                        onChange={() => handleSwitchNumberBase("hex")}
                      />
                      Hexadecimal
                    </label>
                    <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input
                        type="radio"
                        checked={modalNumBase === "dec"}
                        onChange={() => handleSwitchNumberBase("dec")}
                      />
                      Decimal
                    </label>
                  </fieldset>
                </div>
              )}

              {editModal.kind === "binary" && (
                <div className="space-y-2">
                  <label className="block text-[12px] font-medium text-black/65 dark:text-white/65">
                    Hex bytes (space-separated):
                  </label>
                  <textarea
                    autoFocus
                    rows={4}
                    value={modalBinVal}
                    onChange={(e) => setModalBinVal(e.target.value)}
                    placeholder="00 1A FF 20 ..."
                    className="w-full rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] p-2.5 text-[12px] font-mono tabular-nums outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                  />
                  <div className="rounded-[6px] border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] px-2.5 py-2 font-mono text-[11.5px] text-black/70 dark:text-white/70">
                    ASCII: {binaryHexToAscii(modalBinVal) || "(empty)"}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-5 h-8 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12.5px] font-semibold hover:opacity-90 cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="px-4 h-8 rounded-[6px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.07] text-[12.5px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </WinUIDialog>
        )}
      </AnimatePresence>

      {/* Prompt Modal (New Key / Rename / New Value) */}
      <AnimatePresence>
        {promptModal && (
          <WinUIDialog
            title={
              promptModal.kind === "new-key"
                ? "New Registry Key"
                : promptModal.kind === "rename-key"
                  ? "Rename Key"
                  : promptModal.kind === "new-value"
                    ? `New ${promptModal.regType}`
                    : "Rename Value"
            }
            onClose={() => setPromptModal(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (promptModal.kind === "new-key") {
                  createSubKey(promptModal.parentPath, promptModal.value);
                } else if (promptModal.kind === "rename-key") {
                  renameKey(promptModal.path, promptModal.value);
                } else if (promptModal.kind === "new-value") {
                  createValue(promptModal.path, promptModal.regType, promptModal.value);
                } else if (promptModal.kind === "rename-value") {
                  renameValue(promptModal.path, promptModal.oldName, promptModal.value);
                }
                setPromptModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[12px] font-medium text-black/65 dark:text-white/65 mb-1">
                  Name:
                </label>
                <input
                  autoFocus
                  value={promptModal.value}
                  onChange={(e) => setPromptModal({ ...promptModal, value: e.target.value })}
                  className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-3 text-[12.5px] outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-5 h-8 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12.5px] font-semibold hover:opacity-90 cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setPromptModal(null)}
                  className="px-4 h-8 rounded-[6px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.07] text-[12.5px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </WinUIDialog>
        )}
      </AnimatePresence>

      {/* Confirm Delete / Reset Modal */}
      <AnimatePresence>
        {confirmModal && (
          <WinUIDialog
            title={
              confirmModal.kind === "delete-key"
                ? "Confirm Key Delete"
                : confirmModal.kind === "delete-value"
                  ? "Confirm Value Delete"
                  : "Reset Registry"
            }
            onClose={() => setConfirmModal(null)}
          >
            <div className="space-y-4">
              <p className="text-[13px] text-black/75 dark:text-white/80 leading-relaxed">
                {confirmModal.kind === "delete-key"
                  ? `Are you sure you want to permanently delete this key and all of its subkeys?\n${confirmModal.path}`
                  : confirmModal.kind === "delete-value"
                    ? `Deleting certain registry values could cause system instability. Are you sure you want to permanently delete "${confirmModal.valueName}"?`
                    : "Restore all registry hives and custom keys back to SparkleOS default configuration?"}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmModal.kind === "delete-key") {
                      deleteKey(confirmModal.path);
                    } else if (confirmModal.kind === "delete-value") {
                      deleteValue(confirmModal.path, confirmModal.valueName);
                    } else {
                      const fresh = createInitialRegistryTree();
                      setTree(fresh);
                      setSelectedPath(
                        "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion\\Desktop",
                      );
                      setSelectedValueName(null);
                      showAppToast("Registry reset to defaults", { appName: "Registry Editor" });
                    }
                    setConfirmModal(null);
                  }}
                  className="px-5 h-8 rounded-[6px] bg-rose-600 text-white text-[12.5px] font-semibold hover:bg-rose-700 cursor-pointer"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-4 h-8 rounded-[6px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.07] text-[12.5px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  No
                </button>
              </div>
            </div>
          </WinUIDialog>
        )}
      </AnimatePresence>

      {/* Find Dialog */}
      <AnimatePresence>
        {isFindOpen && (
          <WinUIDialog
            title="Find in Registry"
            widthClass="max-w-lg"
            onClose={() => setIsFindOpen(false)}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-black/65 dark:text-white/65 mb-1">
                  Find what:
                </label>
                <div className="flex gap-2">
                  <input
                    ref={findInputRef}
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                    placeholder="Key name, value name, or data..."
                    className="flex-1 h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-3 text-[12.5px] outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                  />
                  <div className="flex rounded-[6px] border border-black/10 dark:border-white/10 p-0.5 bg-black/[0.03] dark:bg-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => setFindStartScope("all")}
                      className={`px-2.5 text-[11.5px] rounded-[4px] cursor-pointer ${
                        findStartScope === "all"
                          ? "bg-white dark:bg-[#32363e] font-medium shadow-xs"
                          : "opacity-65"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFindStartScope("current")}
                      className={`px-2.5 text-[11.5px] rounded-[4px] cursor-pointer ${
                        findStartScope === "current"
                          ? "bg-white dark:bg-[#32363e] font-medium shadow-xs"
                          : "opacity-65"
                      }`}
                    >
                      Branch
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={findInKeys}
                    onChange={(e) => setFindInKeys(e.target.checked)}
                  />
                  Keys
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={findInValues}
                    onChange={(e) => setFindInValues(e.target.checked)}
                  />
                  Values
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={findInData}
                    onChange={(e) => setFindInData(e.target.checked)}
                  />
                  Data
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={findMatchWhole}
                    onChange={(e) => setFindMatchWhole(e.target.checked)}
                  />
                  Match whole string only
                </label>
              </div>

              <div className="border border-black/10 dark:border-white/10 rounded-[6px] bg-white/80 dark:bg-[#1f2328] h-56 overflow-y-auto divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {!findQuery.trim() ? (
                  <div className="h-full flex items-center justify-center text-[12px] text-black/45 dark:text-white/45">
                    Type a search term to scan registry keys and values
                  </div>
                ) : findResults.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[12px] text-black/45 dark:text-white/45">
                    Finished searching through the registry. No matches found.
                  </div>
                ) : (
                  findResults.map((res, idx) => (
                    <button
                      key={`${res.path}-${res.valueName ?? ""}-${idx}`}
                      type="button"
                      onClick={() => {
                        navigateToPath(res.path, true, res.valueName ?? null);
                        setIsFindOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-[#0067b8]/10 dark:hover:bg-[#4cc2ff]/12 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="font-mono text-[#0067b8] dark:text-[#4cc2ff] truncate">
                          {res.path.replace(/^Computer\\/, "")}
                        </span>
                        <span className="text-[10.5px] uppercase opacity-55 shrink-0">
                          {res.matchKind}
                        </span>
                      </div>
                      <div className="text-[12px] truncate mt-0.5 text-black/75 dark:text-white/80">
                        {res.preview}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between text-[11.5px] text-black/55 dark:text-white/55">
                <span className="tabular-nums">{findResults.length} match(es)</span>
                <button
                  type="button"
                  onClick={() => setIsFindOpen(false)}
                  className="px-4 h-8 rounded-[6px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.07] text-[12.5px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </WinUIDialog>
        )}
      </AnimatePresence>

      {/* About Dialog */}
      <AnimatePresence>
        {isAboutOpen && (
          <WinUIDialog title="About Registry Editor" onClose={() => setIsAboutOpen(false)}>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center gap-3">
                <Fluent3DRegistryEditorIcon className="w-10 h-10" />
                <div>
                  <div className="font-semibold text-[15px]">Windows Registry Editor</div>
                  <div className="text-[12px] text-black/55 dark:text-white/55">
                    SparkleOS WinUI 3 Edition · Version 26H1 (Build 28000.14)
                  </div>
                </div>
              </div>
              <p className="text-[12.5px] text-black/70 dark:text-white/75 leading-relaxed">
                Inspect and edit hierarchical registry keys and values, import or export Windows{" "}
                <span className="font-mono">.reg</span> files, and tune live SparkleOS
                Personalization and Taskbar keys directly.
              </p>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAboutOpen(false)}
                  className="px-5 h-8 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12.5px] font-semibold hover:opacity-90 cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          </WinUIDialog>
        )}
      </AnimatePresence>
    </div>
  );
};

// Reusable Sub-components

const ToolbarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}> = ({ icon, label, onClick, disabled, active }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`h-7 px-2.5 rounded-[5px] flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
      active
        ? "bg-[#0067b8]/14 dark:bg-[#4cc2ff]/18 text-[#0067b8] dark:text-[#4cc2ff]"
        : "hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const MenuRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon, label, shortcut, disabled, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="w-full h-7.5 px-2.5 rounded-[5px] flex items-center justify-between gap-4 text-left text-[12.5px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
  >
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-4 flex items-center justify-center shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
    {shortcut && (
      <span className="text-[11px] text-black/45 dark:text-white/45 font-mono shrink-0">
        {shortcut}
      </span>
    )}
  </button>
);

const WinUIDialog: React.FC<{
  title: string;
  widthClass?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, widthClass = "max-w-md", onClose, children }) =>
  createPortal(
    <motion.div
      {...dialogBackdropMotion}
      onMouseDown={onClose}
      className="fixed inset-0 z-[2147483640] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <motion.div
        {...dialogPanelMotion}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${widthClass} rounded-[10px] border border-black/12 dark:border-white/12 bg-[#f9f9f9] dark:bg-[#272b30] text-[#18181b] dark:text-[#f4f4f5] shadow-2xl overflow-hidden`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07] dark:border-white/[0.08]">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-7 h-7 rounded-[5px] flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.09] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );

const RegistryContextMenu: React.FC<{
  menu: ContextMenuState;
  isFavorite: boolean;
  onClose: () => void;
  onAction: (action: string, extra?: string) => void;
}> = ({ menu, isFavorite, onClose, onAction }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - el.offsetWidth - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - el.offsetHeight - 8)),
    });
  }, [menu.x, menu.y]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handleOutside);
    }, 30);
    document.addEventListener("keydown", handleEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const isRoot = menu.target.path === "Computer";
  const isProtected = isProtectedKeyPath(menu.target.path);

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 2147483647 }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.div {...contextMenuMotionProps}>
        <div
          role="menu"
          className={`${flyoutPanelClassName} min-w-[220px] p-1`}
          style={flyoutPanelStyle}
        >
          {menu.target.kind === "value" ? (
            <>
              <MenuRow
                icon={<Pencil className="w-3.5 h-3.5" />}
                label="Modify..."
                onClick={() => onAction("modify")}
              />
              <MenuRow
                icon={<FileCode className="w-3.5 h-3.5" />}
                label="Modify Binary Data..."
                onClick={() => onAction("modify-binary")}
              />
              <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
              <MenuRow
                icon={<Pencil className="w-3.5 h-3.5" />}
                label="Rename"
                disabled={menu.target.valueName === ""}
                onClick={() => onAction("rename-value")}
              />
              <MenuRow
                icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                label="Delete"
                disabled={menu.target.valueName === ""}
                onClick={() => onAction("delete-value")}
              />
            </>
          ) : (
            <>
              <MenuRow
                icon={<FolderPlus className="w-3.5 h-3.5" />}
                label="New Key"
                disabled={isRoot}
                onClick={() => onAction("new-key")}
              />
              <MenuRow
                icon={<Type className="w-3.5 h-3.5" />}
                label="New String Value"
                disabled={isRoot}
                onClick={() => onAction("new-value", "REG_SZ")}
              />
              <MenuRow
                icon={<Hash className="w-3.5 h-3.5" />}
                label="New DWORD (32-bit) Value"
                disabled={isRoot}
                onClick={() => onAction("new-value", "REG_DWORD")}
              />
              <MenuRow
                icon={<Binary className="w-3.5 h-3.5" />}
                label="New Binary Value"
                disabled={isRoot}
                onClick={() => onAction("new-value", "REG_BINARY")}
              />
              {menu.target.kind === "tree" && (
                <>
                  <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                  <MenuRow
                    icon={<Search className="w-3.5 h-3.5" />}
                    label="Find in this key..."
                    onClick={() => onAction("find-here")}
                  />
                  <MenuRow
                    icon={<Download className="w-3.5 h-3.5" />}
                    label="Export (.reg)..."
                    disabled={isRoot}
                    onClick={() => onAction("export")}
                  />
                  <MenuRow
                    icon={<Copy className="w-3.5 h-3.5" />}
                    label="Copy Key Name"
                    onClick={() => onAction("copy-path")}
                  />
                  <MenuRow
                    icon={<Star className="w-3.5 h-3.5" />}
                    label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    onClick={() => onAction("toggle-fav")}
                  />
                  <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                  <MenuRow
                    icon={<Pencil className="w-3.5 h-3.5" />}
                    label="Rename"
                    disabled={isProtected}
                    onClick={() => onAction("rename-key")}
                  />
                  <MenuRow
                    icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                    label="Delete"
                    disabled={isProtected}
                    onClick={() => onAction("delete-key")}
                  />
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};
