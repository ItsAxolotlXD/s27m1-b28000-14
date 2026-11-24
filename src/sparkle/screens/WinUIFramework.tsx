import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  AlertTriangle,
  Blocks,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Columns2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  FolderPlus,
  Hammer,
  Home,
  Info,
  Layers,
  LayoutTemplate,
  Maximize2,
  Menu,
  Monitor,
  Package,
  Palette,
  Pin,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Search,
  Smartphone,
  Tablet,
  Terminal,
  Trash2,
  Upload,
  WrapText,
  X,
} from "lucide-react";
import { Fluent3DWinUIFrameworkIcon } from "../components/Fluent3DIcons";
import { FluentSettingsIcon } from "../components/FluentIcons";
import { InstalledWinUIAppBadge } from "../components/InstalledWinUIAppBadge";
import { getWindowMainContentSurfaceStyle } from "../components/WindowAppSidebar";
import { WindowTitleBarPortalContext } from "../components/WindowFrame";
import { WinUIRuntimePreview } from "../components/WinUIRuntimePreview";
import { WinUIVisualEditor } from "../components/WinUIVisualEditor";
import { WinUIVisualRuntime } from "../components/WinUIVisualRuntime";
import { useSettings } from "../hooks/useSettings";
import {
  WINUI_APP_ACCENT_COLORS,
  WINUI_APP_ICON_KEYS,
  installOrUpdateWinUIApp,
  installedWinUIStartAppId,
  uninstallWinUIApp,
  useInstalledWinUIApps,
  type VisualCanvasConfig,
  type VisualElement,
  type WinUIAppIconKey,
} from "../services/installedWinUIAppsStore";
import { pinActions } from "../services/pinStore";
import { showAppToast } from "../utils/toast";
import {
  DEFAULT_VISUAL_CANVAS,
  WINUI_CONTROL_DOCS,
  WINUI_TEMPLATES,
  astToVisualElements,
  buildWinUIProject,
  createProjectFromTemplate,
  generateStandaloneVisualHtml,
  parseWinUIMarkup,
  visualElementsToWinUIMarkup,
  type BuildResult,
  type WinUIFileKind,
  type WinUIProject,
} from "../utils/winuiFrameworkEngine";

type NavPage = "home" | "studio" | "templates" | "controls" | "build" | "settings";
type EditorViewMode = "visual" | "split" | "code" | "preview";
type ViewportSize = "full" | "desktop" | "tablet" | "mobile";
type ConsoleTab = "problems" | "output" | "runtime";

interface BuildHistoryEntry {
  id: string;
  buildNumber: number;
  projectName: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  controlCount: number;
  bundleSizeBytes: number;
  errorCount: number;
  warningCount: number;
}

interface WinUIFrameworkProps {
  navigate?: (route: string, state?: unknown) => void;
  routeState?: unknown;
}

const PROJECTS_STORAGE_KEY = "sparkle_winui_framework_projects_v1";
const ACTIVE_PROJECT_KEY = "sparkle_winui_framework_active_project_v1";
const PREFS_STORAGE_KEY = "sparkle_winui_framework_prefs_v1";

interface StudioPrefs {
  autoBuild: boolean;
  fontSize: number;
  wordWrap: boolean;
  previewTheme: "inherit" | "light" | "dark";
}

const DEFAULT_PREFS: StudioPrefs = {
  autoBuild: true,
  fontSize: 13,
  wordWrap: false,
  previewTheme: "inherit",
};

function loadInitialProjects(): WinUIProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WinUIProject[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return [
    createProjectFromTemplate("task-hub", "Fluent Task Hub"),
    createProjectFromTemplate("control-playground", "WinUI 3 Control Lab"),
  ];
}

function loadPrefs(): StudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<StudioPrefs>) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PREFS;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export const WinUIFramework: React.FC<WinUIFrameworkProps> = ({ navigate, routeState }) => {
  const { settings, updateSetting } = useSettings();
  const { titleBarSlotEl, isInsideWindowFrame } = useContext(WindowTitleBarPortalContext);
  const installedApps = useInstalledWinUIApps();
  const containerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // NavigationView Hamburger Menu Sidebar state
  const [activePage, setActivePage] = useState<NavPage>("studio");
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [isCompactContainer, setIsCompactContainer] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [navTooltip, setNavTooltip] = useState<{ label: string; top: number; left: number } | null>(
    null,
  );

  // Projects & active file state
  const [projects, setProjects] = useState<WinUIProject[]>(loadInitialProjects);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return "";
  });
  const [activeFileKind, setActiveFileKind] = useState<WinUIFileKind>("ui");
  const [prefs, setPrefs] = useState<StudioPrefs>(loadPrefs);

  // IDE Workspace state
  const [viewMode, setViewMode] = useState<EditorViewMode>("visual");
  const [viewport, setViewport] = useState<ViewportSize>("full");
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("problems");
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isRunningWindowOpen, setIsRunningWindowOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTemplate, setNewProjectTemplate] = useState("task-hub");
  const [aboutExpanded, setAboutExpanded] = useState(false);

  // Build & Install to Start Menu modal state
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [installName, setInstallName] = useState("");
  const [installDesc, setInstallDesc] = useState("");
  const [installIconKey, setInstallIconKey] = useState<WinUIAppIconKey>("layers");
  const [installAccentColor, setInstallAccentColor] = useState<string>(
    WINUI_APP_ACCENT_COLORS[0] ?? "#0067b8",
  );
  const [installPinStart, setInstallPinStart] = useState(true);
  const [installPinTaskbar, setInstallPinTaskbar] = useState(false);
  const [lastInstalledRoute, setLastInstalledRoute] = useState<string | null>(null);

  // Controls Catalog state
  const [controlCategory, setControlCategory] = useState<string>("All");
  const [controlSearch, setControlSearch] = useState("");
  const [copiedSnippetTag, setCopiedSnippetTag] = useState<string | null>(null);

  // Build & Runtime state
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0]!,
    [projects, activeProjectId],
  );
  const activeFile = useMemo(
    () => activeProject.files.find((f) => f.kind === activeFileKind) ?? activeProject.files[0]!,
    [activeProject, activeFileKind],
  );

  // Respect routeState when launched via "Edit in WinUI Framework" from Start Menu
  useEffect(() => {
    const rs = routeState as
      { editProjectId?: string; viewMode?: EditorViewMode } | null | undefined;
    if (rs?.editProjectId && projects.some((p) => p.id === rs.editProjectId)) {
      setActiveProjectId(rs.editProjectId);
      setActivePage("studio");
      if (rs.viewMode) setViewMode(rs.viewMode);
    }
  }, [routeState, projects]);

  // Resolved visual canvas + elements for active project (seeded lazily from AST if missing)
  const resolvedVisualDesign = useMemo(() => {
    if (activeProject.visualDesign) {
      return activeProject.visualDesign;
    }
    const uiFile = activeProject.files.find((f) => f.kind === "ui");
    const parsed = parseWinUIMarkup(uiFile?.content ?? "");
    return {
      canvas: { ...DEFAULT_VISUAL_CANVAS },
      elements: astToVisualElements(parsed.nodes),
    };
  }, [activeProject]);

  const handleVisualChange = useCallback(
    (nextCanvas: VisualCanvasConfig, nextElements: VisualElement[]) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== activeProject.id) return p;
          const generatedMarkup = visualElementsToWinUIMarkup(nextElements, nextCanvas, p.name);
          return {
            ...p,
            updatedAt: Date.now(),
            visualDesign: {
              canvas: nextCanvas,
              elements: nextElements,
            },
            files: p.files.map((f) => (f.kind === "ui" ? { ...f, content: generatedMarkup } : f)),
          };
        }),
      );
    },
    [activeProject.id],
  );

  const handleSyncVisualFromCode = useCallback(() => {
    const uiFile = activeProject.files.find((f) => f.kind === "ui");
    const parsed = parseWinUIMarkup(uiFile?.content ?? "");
    const nextElements = astToVisualElements(parsed.nodes);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? {
              ...p,
              updatedAt: Date.now(),
              visualDesign: {
                canvas: resolvedVisualDesign.canvas,
                elements: nextElements,
              },
            }
          : p,
      ),
    );
    showAppToast(`Imported ${nextElements.length} elements from App.winui`, {
      appName: "WinUI Framework",
    });
  }, [activeProject, resolvedVisualDesign.canvas]);

  const openInstallModal = useCallback(() => {
    const existingInstalled = installedApps.find((a) => a.projectId === activeProject.id);
    setInstallName(existingInstalled?.name ?? activeProject.name);
    setInstallDesc(existingInstalled?.description ?? activeProject.description);
    setInstallIconKey(existingInstalled?.iconKey ?? "layers");
    setInstallAccentColor(
      existingInstalled?.accentColor ?? WINUI_APP_ACCENT_COLORS[0] ?? "#0067b8",
    );
    setInstallPinStart(true);
    setInstallPinTaskbar(false);
    setLastInstalledRoute(existingInstalled?.route ?? null);
    setInstallModalOpen(true);
  }, [activeProject, installedApps]);

  const [lastBuild, setLastBuild] = useState<BuildResult>(() => buildWinUIProject(activeProject));
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown>>(() => ({
    ...lastBuild.initialState,
  }));
  const [runtimeLogs, setRuntimeLogs] = useState<Array<{ id: string; time: string; text: string }>>(
    [],
  );
  const [buildHistory, setBuildHistory] = useState<BuildHistoryEntry[]>(() => [
    {
      id: "init-build",
      buildNumber: 1,
      projectName: activeProject.name,
      timestamp: lastBuild.timestamp,
      durationMs: lastBuild.durationMs,
      success: lastBuild.success,
      controlCount: lastBuild.controlCount,
      bundleSizeBytes: lastBuild.bundleSizeBytes,
      errorCount: lastBuild.diagnostics.filter((d) => d.severity === "error").length,
      warningCount: lastBuild.diagnostics.filter((d) => d.severity === "warning").length,
    },
  ]);

  // Persist projects & prefs
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, activeProject.id);
    } catch {
      // ignore
    }
  }, [activeProject.id]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  // Responsive container observer for compact Hamburger drawer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setIsCompactContainer(el.clientWidth < 740);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const appendRuntimeLog = useCallback((text: string) => {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setRuntimeLogs((prev) => [
      { id: `${Date.now()}-${Math.random()}`, time, text },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const runBuild = useCallback((projectToBuild: WinUIProject, announceToast = false) => {
    const result = buildWinUIProject(projectToBuild);
    setLastBuild(result);
    if (result.success) {
      setRuntimeState({ ...result.initialState });
    }
    const errCount = result.diagnostics.filter((d) => d.severity === "error").length;
    const warnCount = result.diagnostics.filter((d) => d.severity === "warning").length;

    setBuildHistory((prev) => [
      {
        id: `b-${Date.now()}`,
        buildNumber: prev.length + 1,
        projectName: projectToBuild.name,
        timestamp: result.timestamp,
        durationMs: result.durationMs,
        success: result.success,
        controlCount: result.controlCount,
        bundleSizeBytes: result.bundleSizeBytes,
        errorCount: errCount,
        warningCount: warnCount,
      },
      ...prev.slice(0, 19),
    ]);

    if (announceToast) {
      showAppToast(
        result.success
          ? `Build succeeded (${result.controlCount} controls · ${result.durationMs} ms)`
          : `Build failed with ${errCount} error(s)`,
        { appName: "WinUI Framework" },
      );
    }
    return result;
  }, []);

  // Re-build when switching active project
  const prevProjIdRef = useRef(activeProject.id);
  useEffect(() => {
    if (prevProjIdRef.current !== activeProject.id) {
      prevProjIdRef.current = activeProject.id;
      runBuild(activeProject, false);
      setRuntimeLogs([]);
    }
  }, [activeProject, runBuild]);

  // Debounced auto-build when code changes
  useEffect(() => {
    if (!prefs.autoBuild) return;
    const timer = window.setTimeout(() => {
      const res = buildWinUIProject(activeProject);
      setLastBuild(res);
      if (res.success) {
        setRuntimeState((prev) => ({ ...res.initialState, ...prev }));
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [activeProject, prefs.autoBuild]);

  const updateActiveFileContent = useCallback(
    (nextContent: string) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== activeProject.id) return p;
          return {
            ...p,
            updatedAt: Date.now(),
            files: p.files.map((f) =>
              f.kind === activeFileKind ? { ...f, content: nextContent } : f,
            ),
          };
        }),
      );
    },
    [activeProject.id, activeFileKind],
  );

  const handleInsertSnippet = useCallback(
    (snippet: string, label: string) => {
      const uiFile = activeProject.files.find((f) => f.kind === "ui");
      if (!uiFile) return;
      const content = uiFile.content;
      const insertTarget = content.lastIndexOf("</StackPanel>");
      const indented = snippet
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n");
      const updated =
        insertTarget !== -1
          ? `${content.slice(0, insertTarget)}${indented}\n    ${content.slice(insertTarget)}`
          : `${content}\n${indented}`;

      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id
            ? {
                ...p,
                updatedAt: Date.now(),
                files: p.files.map((f) => (f.kind === "ui" ? { ...f, content: updated } : f)),
              }
            : p,
        ),
      );
      setActiveFileKind("ui");
      setActivePage("studio");
      showAppToast(`Inserted <${label}> into App.winui`, { appName: "WinUI Framework" });
    },
    [activeProject],
  );

  const handleCreateProject = (templateId: string, name?: string) => {
    const created = createProjectFromTemplate(templateId, name);
    setProjects((prev) => [created, ...prev]);
    setActiveProjectId(created.id);
    setActiveFileKind("ui");
    setActivePage("studio");
    setNewProjectModalOpen(false);
    setNewProjectName("");
    showAppToast(`Created project "${created.name}"`, { appName: "WinUI Framework" });
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) {
      showAppToast("At least one project must remain in the workspace.", {
        appName: "WinUI Framework",
      });
      return;
    }
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    if (activeProject.id === id && remaining[0]) {
      setActiveProjectId(remaining[0].id);
    }
    showAppToast("Deleted project", { appName: "WinUI Framework" });
  };

  const handleExportHtml = () => {
    if (viewMode === "visual") {
      const html = generateStandaloneVisualHtml(
        activeProject.name,
        resolvedVisualDesign.canvas,
        resolvedVisualDesign.elements,
      );
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const slug = activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "winui-app";
      a.href = url;
      a.download = `${slug}.winui.html`;
      a.click();
      URL.revokeObjectURL(url);
      showAppToast(`Exported ${slug}.winui.html`, { appName: "WinUI Framework" });
      return;
    }
    const res = runBuild(activeProject, false);
    if (!res.success || !res.exportedHtml) {
      showAppToast("Fix build errors before exporting standalone HTML app.", {
        appName: "WinUI Framework",
      });
      setIsConsoleOpen(true);
      setConsoleTab("problems");
      return;
    }
    const blob = new Blob([res.exportedHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "winui-app";
    a.href = url;
    a.download = `${slug}.winui.html`;
    a.click();
    URL.revokeObjectURL(url);
    showAppToast(`Exported ${slug}.winui.html`, { appName: "WinUI Framework" });
  };

  const handleInstallToStartMenu = (e: React.FormEvent) => {
    e.preventDefault();
    runBuild(activeProject, false);
    const isVisualMode = viewMode === "visual" || Boolean(activeProject.visualDesign);
    const snapshot: WinUIProject = {
      ...activeProject,
      name: installName.trim() || activeProject.name,
      description: installDesc.trim() || activeProject.description,
      visualDesign: resolvedVisualDesign,
    };
    const record = installOrUpdateWinUIApp({
      projectId: activeProject.id,
      name: snapshot.name,
      description: snapshot.description,
      iconKey: installIconKey,
      accentColor: installAccentColor,
      mode: isVisualMode ? "visual" : "code",
      visualElements: resolvedVisualDesign.elements,
      visualCanvas: resolvedVisualDesign.canvas,
      projectSnapshot: snapshot,
    });
    if (installPinStart) {
      pinActions.pinToStart(installedWinUIStartAppId(record.id));
    }
    if (installPinTaskbar) {
      pinActions.pinToTaskbar(record.route, record.name);
    }
    setLastInstalledRoute(record.route);
    showAppToast(`Built "${record.name}" and added it to Start Menu`, {
      appName: "WinUI Framework",
    });
  };

  const handleExportProjectJson = () => {
    const blob = new Blob([JSON.stringify(activeProject, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "winui-project";
    a.href = url;
    a.download = `${slug}.winui.json`;
    a.click();
    URL.revokeObjectURL(url);
    showAppToast(`Exported ${slug}.winui.json`, { appName: "WinUI Framework" });
  };

  const handleImportProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as WinUIProject;
        if (!parsed.name || !Array.isArray(parsed.files)) {
          throw new Error("Invalid .winui.json structure");
        }
        const imported: WinUIProject = {
          ...parsed,
          id: `proj-${Date.now()}`,
          updatedAt: Date.now(),
        };
        setProjects((prev) => [imported, ...prev]);
        setActiveProjectId(imported.id);
        setActivePage("studio");
        showAppToast(`Imported "${imported.name}"`, { appName: "WinUI Framework" });
      } catch {
        showAppToast("Could not import project JSON file.", { appName: "WinUI Framework" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to build
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        runBuild(activeProject, true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeProject, runBuild]);

  const errorCount = lastBuild.diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = lastBuild.diagnostics.filter((d) => d.severity === "warning").length;

  const navItems: Array<{
    id: NavPage;
    label: string;
    keywords: string;
    icon: React.ReactNode;
  }> = useMemo(
    () => [
      {
        id: "home",
        label: "Home",
        keywords: "home overview start projects trang chu",
        icon: <Home className="w-4 h-4 shrink-0" />,
      },
      {
        id: "studio",
        label: "Studio IDE",
        keywords: "studio code write editor build preview",
        icon: <Code2 className="w-4 h-4 shrink-0" />,
      },
      {
        id: "templates",
        label: "Templates",
        keywords: "templates starter blueprints mau ung dung",
        icon: <Layers className="w-4 h-4 shrink-0" />,
      },
      {
        id: "controls",
        label: "Controls & API",
        keywords: "controls gallery components button slider togglebox navigationview",
        icon: <Blocks className="w-4 h-4 shrink-0" />,
      },
      {
        id: "build",
        label: "Build & Package",
        keywords: "build compile package export html bundle",
        icon: <Package className="w-4 h-4 shrink-0" />,
      },
    ],
    [],
  );

  const filteredNavItems = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords.includes(q),
    );
  }, [navItems, sidebarSearch]);

  const filteredControls = useMemo(() => {
    const q = controlSearch.trim().toLowerCase();
    return WINUI_CONTROL_DOCS.filter((c) => {
      const catMatch = controlCategory === "All" || c.category === controlCategory;
      const textMatch =
        !q ||
        c.tag.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.props.some((p) => p.toLowerCase().includes(q));
      return catMatch && textMatch;
    });
  }, [controlCategory, controlSearch]);

  const showSidebarTooltip = (label: string, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setNavTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
  };

  const renderHamburgerSidebarBody = (collapsed: boolean) => (
    <>
      {!collapsed && (
        <div className="px-2.5 pb-1.5 shrink-0">
          <div className="h-8 px-2.5 rounded-[6px] bg-white/80 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 border-b-black/25 dark:border-b-white/20 flex items-center gap-2 focus-within:border-b-2 focus-within:border-b-[#0067b8] dark:focus-within:border-b-[#4cc2ff]">
            <Search className="w-3.5 h-3.5 opacity-55 shrink-0" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Find a page or control"
              className="w-full bg-transparent text-[12px] outline-none placeholder:text-black/45 dark:placeholder:text-white/45"
            />
            {sidebarSearch && (
              <button
                type="button"
                onClick={() => setSidebarSearch("")}
                aria-label="Clear filter"
                className="opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-2 space-y-0.5">
        {filteredNavItems.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActivePage(item.id);
                setIsNavDrawerOpen(false);
              }}
              onMouseEnter={collapsed ? (e) => showSidebarTooltip(item.label, e) : undefined}
              onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`relative w-full h-[34px] flex items-center ${
                collapsed ? "justify-center px-0" : "gap-2.5 px-3"
              } rounded-[6px] text-[13px] text-left transition-colors cursor-pointer ${
                active
                  ? "bg-black/[0.07] dark:bg-white/[0.1] text-[#111827] dark:text-white font-semibold"
                  : "text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[15px] bg-[#0067b8] dark:bg-[#4cc2ff] rounded-full pointer-events-none"
                />
              )}
              {item.icon}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        <div role="separator" className="my-2 mx-1.5 h-px bg-black/10 dark:bg-white/10" />

        {!collapsed && (
          <div className="px-2.5 py-1 flex items-center justify-between text-[11px] font-semibold text-black/50 dark:text-white/50">
            <span>Workspace Projects</span>
            <button
              type="button"
              onClick={() => setNewProjectModalOpen(true)}
              aria-label="New project"
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {projects.map((proj) => {
          const isCurrent = proj.id === activeProject.id;
          return (
            <button
              key={proj.id}
              type="button"
              onClick={() => {
                setActiveProjectId(proj.id);
                setActivePage("studio");
                setIsNavDrawerOpen(false);
              }}
              onMouseEnter={collapsed ? (e) => showSidebarTooltip(proj.name, e) : undefined}
              onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
              aria-label={proj.name}
              className={`relative w-full h-[32px] flex items-center ${
                collapsed ? "justify-center px-0" : "gap-2.5 px-3"
              } rounded-[6px] text-[12.5px] text-left transition-colors cursor-pointer ${
                isCurrent
                  ? "bg-[#0067b8]/10 dark:bg-[#4cc2ff]/12 text-[#0067b8] dark:text-[#4cc2ff] font-medium"
                  : "text-black/75 dark:text-white/75 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span className="truncate">{proj.name}</span>}
            </button>
          );
        })}
      </div>

      {/* Settings anchored at bottom of Hamburger Menu */}
      <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
        <button
          type="button"
          onClick={() => {
            setActivePage("settings");
            setIsNavDrawerOpen(false);
          }}
          onMouseEnter={collapsed ? (e) => showSidebarTooltip("Settings", e) : undefined}
          onMouseLeave={collapsed ? () => setNavTooltip(null) : undefined}
          aria-label="Settings"
          aria-current={activePage === "settings" ? "page" : undefined}
          className={`relative w-full h-[34px] flex items-center ${
            collapsed ? "justify-center px-0" : "gap-2.5 px-3"
          } rounded-[6px] text-[13px] text-left transition-colors cursor-pointer ${
            activePage === "settings"
              ? "bg-black/[0.07] dark:bg-white/[0.1] text-[#111827] dark:text-white font-semibold"
              : "text-black/80 dark:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          }`}
        >
          {activePage === "settings" && (
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

  const viewportWidthClass =
    viewport === "mobile"
      ? "max-w-[390px] mx-auto border-x border-black/10 dark:border-white/10 shadow-lg"
      : viewport === "tablet"
        ? "max-w-[768px] mx-auto border-x border-black/10 dark:border-white/10 shadow-lg"
        : viewport === "desktop"
          ? "max-w-[1100px] mx-auto border-x border-black/10 dark:border-white/10 shadow-lg"
          : "w-full";

  const editorLineCount = activeFile.content.split("\n").length;
  const hasTitleBarPortal = Boolean(isInsideWindowFrame && titleBarSlotEl);

  const hamburgerButton = (
    <button
      type="button"
      id="btn-winui-fw-hamburger"
      onClick={() => {
        if (isCompactContainer) {
          setIsNavDrawerOpen((v) => !v);
        } else {
          setIsNavCollapsed((v) => !v);
        }
      }}
      aria-label={
        isCompactContainer
          ? isNavDrawerOpen
            ? "Close navigation"
            : "Open navigation"
          : isNavCollapsed
            ? "Expand navigation"
            : "Collapse navigation"
      }
      className="w-8 h-8 rounded-[5px] flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.09] active:bg-black/10 dark:active:bg-white/15 transition-colors cursor-pointer shrink-0 border-none"
    >
      <Menu className="w-4 h-4 stroke-[1.75]" />
    </button>
  );

  return (
    <div
      ref={containerRef}
      id="winui-framework-app"
      className={`relative w-full h-full flex flex-row overflow-hidden ${
        isInsideWindowFrame ? "bg-transparent" : "bg-[#f3f3f3] dark:bg-[#1b1f24]"
      } text-[#18181b] dark:text-[#f4f4f5] select-none`}
    >
      {hasTitleBarPortal && titleBarSlotEl ? createPortal(hamburgerButton, titleBarSlotEl) : null}

      <input
        ref={importInputRef}
        type="file"
        accept=".json,.winui.json"
        className="hidden"
        onChange={handleImportProjectFile}
      />

      {/* Desktop WinUI 3 Gallery-style Hamburger NavigationView Sidebar */}
      {!isCompactContainer && (
        <aside
          aria-label="WinUI Framework navigation"
          className={`hidden md:flex relative z-20 h-full flex-col pt-1 ${
            isInsideWindowFrame ? "bg-transparent" : "bg-[#f3f3f3] dark:bg-[#1b1f24]"
          } shrink-0 transition-[width] duration-150 ${isNavCollapsed ? "w-[52px]" : "w-[240px]"}`}
        >
          {!hasTitleBarPortal && (
            <div
              className={`pb-1 flex items-center ${
                isNavCollapsed ? "justify-center px-1" : "px-2"
              } shrink-0`}
            >
              {hamburgerButton}
            </div>
          )}
          {renderHamburgerSidebarBody(isNavCollapsed)}
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
              aria-label="WinUI Framework navigation"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={`relative z-10 w-[252px] max-w-[85%] h-full flex flex-col ${
                isInsideWindowFrame
                  ? "bg-[#f3f3f3]/95 dark:bg-[#202329]/95"
                  : "bg-[#f3f3f3]/95 dark:bg-[#1b1f24]/95"
              } backdrop-blur-2xl border-r border-black/10 dark:border-white/10 shadow-2xl`}
            >
              <div className="px-2.5 pt-2 pb-1 flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNavDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>
              {renderHamburgerSidebarBody(false)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Collapsed Sidebar Hover Tooltip */}
      {isNavCollapsed && navTooltip && !isCompactContainer && (
        <div
          style={{ top: navTooltip.top, left: navTooltip.left }}
          className="fixed -translate-y-1/2 z-[9999] pointer-events-none px-2.5 py-1 rounded-[5px] bg-[#2c3037] text-white text-[11.5px] font-medium shadow-md border border-white/10 whitespace-nowrap"
        >
          {navTooltip.label}
        </div>
      )}

      {/* Main Content Shell */}
      <div
        style={isInsideWindowFrame ? getWindowMainContentSurfaceStyle(settings.theme) : undefined}
        className={`flex-1 min-w-0 h-full flex flex-col overflow-hidden ${
          isInsideWindowFrame
            ? "rounded-tl-[8px] border-t border-l border-black/[0.06] dark:border-white/[0.07]"
            : "bg-[#f9f9f9] dark:bg-[#282c31] rounded-tl-[8px] border-t border-l border-black/[0.06] dark:border-white/[0.07]"
        }`}
      >
        {/* Top Context Header (when not on Studio or compact menu trigger) */}
        {activePage !== "studio" && (
          <header
            className={`h-12 px-4 sm:px-6 shrink-0 border-b border-black/[0.07] dark:border-white/[0.08] ${
              isInsideWindowFrame
                ? "bg-white/40 dark:bg-white/[0.03]"
                : "bg-[#f8f9fa]/85 dark:bg-[#24282e]/85 backdrop-blur-xl"
            } flex items-center justify-between gap-4`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {!hasTitleBarPortal && (
                <button
                  type="button"
                  onClick={() => setIsNavDrawerOpen(true)}
                  aria-label="Open navigation"
                  className={`${isCompactContainer ? "flex" : "md:hidden flex"} w-8 h-8 rounded-[6px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] items-center justify-center cursor-pointer shrink-0`}
                >
                  <Menu className="w-4 h-4" />
                </button>
              )}
              <span className="text-[13.5px] font-semibold truncate">
                {activePage === "home"
                  ? "Home"
                  : activePage === "templates"
                    ? "Project Templates"
                    : activePage === "controls"
                      ? "Controls & API"
                      : activePage === "build"
                        ? "Build & Package"
                        : "Settings"}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActivePage("studio")}
                className="h-8 px-3.5 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12px] font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Open Studio</span>
              </button>
            </div>
          </header>
        )}

        {/* PAGE: HOME */}
        {activePage === "home" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Hero Banner */}
              <div className="relative rounded-[10px] overflow-hidden border border-black/[0.08] dark:border-white/[0.08] bg-[#e6edf5] dark:bg-[#192231] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                  <div className="text-[12px] font-medium text-[#0067b8] dark:text-[#4cc2ff]">
                    WinUI Framework SDK 2.9 · SparkleOS Build 28000.14
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
                    Write and build WinUI 3 apps directly in SparkleOS
                  </h1>
                  <p className="text-[13.5px] text-black/65 dark:text-white/70 leading-relaxed">
                    Author declarative Fluent markup in <span className="font-mono">App.winui</span>
                    , attach reactive state handlers in{" "}
                    <span className="font-mono">App.logic.js</span>, compile with live diagnostics,
                    and package standalone WinUI 3 web executables.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNewProjectModalOpen(true)}
                      className="h-9 px-4 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12.5px] font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span>New WinUI App</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        runBuild(activeProject, true);
                        setActivePage("studio");
                      }}
                      className="h-9 px-4 rounded-[6px] border border-black/15 dark:border-white/15 bg-white/85 dark:bg-white/[0.08] hover:bg-black/5 dark:hover:bg-white/12 text-[12.5px] font-medium cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
                    >
                      <Hammer className="w-4 h-4" />
                      <span>Build "{activeProject.name}"</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => importInputRef.current?.click()}
                      className="h-9 px-3.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white/60 dark:bg-white/[0.05] hover:bg-black/5 dark:hover:bg-white/10 text-[12.5px] font-medium cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import Project</span>
                    </button>
                  </div>
                </div>
                <div className="hidden sm:flex items-center justify-center shrink-0">
                  <Fluent3DWinUIFrameworkIcon className="w-24 h-24 drop-shadow-md" />
                </div>
              </div>

              {/* Installed Start Menu Apps */}
              {installedApps.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold tracking-tight">
                      Installed Start Menu Apps
                    </h2>
                    <span className="text-[12px] text-black/55 dark:text-white/55 tabular-nums">
                      {installedApps.length} app(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {installedApps.map((app) => (
                      <div
                        key={app.id}
                        className="rounded-[8px] border border-black/[0.08] dark:border-white/[0.08] bg-white/85 dark:bg-[#2c3037]/85 p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <InstalledWinUIAppBadge
                            iconKey={app.iconKey}
                            accentColor={app.accentColor}
                            className="w-10 h-10"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold truncate">{app.name}</div>
                            <div className="text-[11px] opacity-60 capitalize">
                              {app.mode} layout · Start Menu
                            </div>
                            <p className="text-[12px] text-black/65 dark:text-white/65 line-clamp-2 mt-1">
                              {app.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.07]">
                          <div className="flex items-center gap-1.5">
                            {navigate && (
                              <button
                                type="button"
                                onClick={() => navigate(app.route)}
                                className="h-7 px-3 rounded-[5px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12px] font-semibold cursor-pointer flex items-center gap-1"
                              >
                                <Play className="w-3 h-3" />
                                <span>Launch</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (projects.some((p) => p.id === app.projectId)) {
                                  setActiveProjectId(app.projectId);
                                }
                                setViewMode(app.mode === "visual" ? "visual" : "split");
                                setActivePage("studio");
                              }}
                              className="h-7 px-2.5 rounded-[5px] border border-black/12 dark:border-white/12 text-[12px] font-medium cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              uninstallWinUIApp(app.id);
                              pinActions.unpinFromTaskbar(app.route);
                              showAppToast(`Uninstalled "${app.name}"`, {
                                appName: "WinUI Framework",
                              });
                            }}
                            aria-label={`Uninstall ${app.name}`}
                            className="w-7 h-7 rounded-[5px] flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Saved Workspace Projects */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-semibold tracking-tight">Recent Projects</h2>
                  <span className="text-[12px] text-black/55 dark:text-white/55 tabular-nums">
                    {projects.length} project(s)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projects.map((proj) => {
                    const isCurrent = proj.id === activeProject.id;
                    return (
                      <div
                        key={proj.id}
                        className={`rounded-[8px] border p-4 bg-white/85 dark:bg-[#2c3037]/85 flex flex-col justify-between gap-3 ${
                          isCurrent
                            ? "border-[#0067b8]/50 dark:border-[#4cc2ff]/50"
                            : "border-black/[0.08] dark:border-white/[0.08]"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[14px] font-semibold truncate">{proj.name}</span>
                            {isCurrent && (
                              <span className="text-[11px] font-medium text-[#0067b8] dark:text-[#4cc2ff] shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-black/60 dark:text-white/60 line-clamp-2">
                            {proj.description}
                          </p>
                          <div className="text-[11px] text-black/45 dark:text-white/45 tabular-nums pt-1">
                            {proj.files.length} files · Updated{" "}
                            {new Date(proj.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.07]">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveProjectId(proj.id);
                              setActivePage("studio");
                            }}
                            className="h-7 px-3 rounded-[5px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Open in Studio
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProject(proj.id)}
                            aria-label={`Delete ${proj.name}`}
                            className="w-7 h-7 rounded-[5px] flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Starter Templates */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-semibold tracking-tight">Starter Blueprints</h2>
                  <button
                    type="button"
                    onClick={() => setActivePage("templates")}
                    className="text-[12px] font-medium text-[#0067b8] dark:text-[#4cc2ff] hover:underline cursor-pointer"
                  >
                    View all templates
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {WINUI_TEMPLATES.slice(0, 4).map((tpl) => (
                    <div
                      key={tpl.id}
                      className="rounded-[8px] border border-black/[0.08] dark:border-white/[0.08] bg-white/85 dark:bg-[#2c3037]/85 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="text-[13.5px] font-semibold truncate">{tpl.name}</div>
                        <div className="text-[11.5px] text-black/55 dark:text-white/55">
                          {tpl.category} · {tpl.files.length} source files
                        </div>
                        <p className="text-[12px] text-black/65 dark:text-white/65 line-clamp-2">
                          {tpl.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCreateProject(tpl.id)}
                        className="h-8 px-3 rounded-[6px] border border-black/12 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Use Template
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* PAGE: STUDIO IDE */}
        {activePage === "studio" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* WinUI 3 IDE CommandBar */}
            <header
              className={`shrink-0 border-b border-black/[0.07] dark:border-white/[0.08] ${
                isInsideWindowFrame
                  ? "bg-white/40 dark:bg-white/[0.03]"
                  : "bg-[#f8f9fa]/90 dark:bg-[#24282e]/90 backdrop-blur-xl"
              } px-3 py-1.5 flex flex-wrap items-center justify-between gap-2`}
            >
              {/* Left: Hamburger (mobile when not in titlebar) + Project Selector + File Tabs */}
              <div className="flex items-center gap-2 min-w-0">
                {!hasTitleBarPortal && (
                  <button
                    type="button"
                    onClick={() => setIsNavDrawerOpen(true)}
                    aria-label="Open navigation"
                    className={`${isCompactContainer ? "flex" : "md:hidden flex"} w-7 h-7 rounded-[5px] items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer shrink-0`}
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                )}

                <select
                  aria-label="Active project"
                  value={activeProject.id}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="h-7 max-w-[170px] rounded-[5px] border border-black/12 dark:border-white/12 bg-white dark:bg-[#1f2328] px-2 text-[12px] font-semibold outline-none cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {viewMode !== "visual" && (
                  <div className="flex items-center gap-1 border-l border-black/10 dark:border-white/10 pl-2">
                    {activeProject.files.map((file) => {
                      const active = file.kind === activeFileKind;
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setActiveFileKind(file.kind)}
                          className={`h-7 px-2.5 rounded-[5px] text-[12px] font-mono whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                            active
                              ? "bg-[#0067b8]/12 dark:bg-[#4cc2ff]/15 text-[#0067b8] dark:text-[#4cc2ff] font-semibold"
                              : "hover:bg-black/[0.05] dark:hover:bg-white/[0.07] opacity-80"
                          }`}
                        >
                          {file.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: Build to Start, Run Window, View Mode & Export */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  id="btn-winui-fw-install-start"
                  onClick={openInstallModal}
                  className="h-7 px-3 rounded-[5px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12px] font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Build to Start</span>
                </button>

                <button
                  type="button"
                  id="btn-winui-fw-build"
                  onClick={() => runBuild(activeProject, true)}
                  className="h-7 px-2.5 rounded-[5px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.06] hover:bg-black/5 dark:hover:bg-white/10 text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Hammer className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Compile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRunningWindowOpen(true)}
                  disabled={viewMode !== "visual" && !lastBuild.success}
                  className="h-7 px-2.5 rounded-[5px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.06] hover:bg-black/5 dark:hover:bg-white/10 text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run</span>
                </button>

                <div className="flex items-center rounded-[5px] border border-black/10 dark:border-white/10 p-0.5 bg-black/[0.03] dark:bg-white/[0.04]">
                  {(
                    [
                      {
                        id: "visual",
                        icon: <LayoutTemplate className="w-3.5 h-3.5" />,
                        label: "Visual",
                      },
                      { id: "split", icon: <Columns2 className="w-3.5 h-3.5" />, label: "Split" },
                      { id: "code", icon: <Code2 className="w-3.5 h-3.5" />, label: "Code" },
                      {
                        id: "preview",
                        icon: <Maximize2 className="w-3.5 h-3.5" />,
                        label: "Preview",
                      },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setViewMode(m.id)}
                      className={`h-6 px-2 rounded-[4px] flex items-center gap-1 text-[11.5px] cursor-pointer whitespace-nowrap ${
                        viewMode === m.id
                          ? "bg-white dark:bg-[#32363e] font-semibold shadow-xs"
                          : "opacity-65 hover:opacity-100"
                      }`}
                    >
                      {m.icon}
                      <span className="hidden lg:inline">{m.label}</span>
                    </button>
                  ))}
                </div>

                {(viewMode === "split" || viewMode === "preview") && (
                  <div className="hidden md:flex items-center rounded-[5px] border border-black/10 dark:border-white/10 p-0.5 bg-black/[0.03] dark:bg-white/[0.04]">
                    {(
                      [
                        { id: "full", icon: <Maximize2 className="w-3.5 h-3.5" />, title: "Fill" },
                        {
                          id: "desktop",
                          icon: <Monitor className="w-3.5 h-3.5" />,
                          title: "Desktop",
                        },
                        { id: "tablet", icon: <Tablet className="w-3.5 h-3.5" />, title: "Tablet" },
                        {
                          id: "mobile",
                          icon: <Smartphone className="w-3.5 h-3.5" />,
                          title: "Mobile",
                        },
                      ] as const
                    ).map((vp) => (
                      <button
                        key={vp.id}
                        type="button"
                        title={vp.title}
                        aria-label={vp.title}
                        onClick={() => setViewport(vp.id)}
                        className={`h-6 w-7 rounded-[4px] flex items-center justify-center cursor-pointer ${
                          viewport === vp.id
                            ? "bg-white dark:bg-[#32363e] shadow-xs"
                            : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        {vp.icon}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleExportHtml}
                  title="Export standalone .winui.html app"
                  className="h-7 px-2.5 rounded-[5px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.06] hover:bg-black/5 dark:hover:bg-white/10 text-[12px] font-medium whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Export HTML</span>
                </button>
              </div>
            </header>

            {/* Quick Insert Strip when editing App.winui in Code/Split mode */}
            {(viewMode === "code" || viewMode === "split") && activeFileKind === "ui" && (
              <div className="shrink-0 px-3 py-1 border-b border-black/[0.06] dark:border-white/[0.07] bg-[#f4f5f6] dark:bg-[#202329] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-medium text-black/50 dark:text-white/50 whitespace-nowrap mr-1">
                  Insert Control:
                </span>
                {WINUI_CONTROL_DOCS.slice(0, 8).map((ctrl) => (
                  <button
                    key={ctrl.tag}
                    type="button"
                    onClick={() => handleInsertSnippet(ctrl.snippet, ctrl.tag)}
                    className="h-6 px-2 rounded-[4px] border border-black/10 dark:border-white/10 bg-white/75 dark:bg-white/[0.05] hover:bg-[#0067b8]/10 dark:hover:bg-[#4cc2ff]/12 text-[11px] font-mono whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    + {ctrl.tag}
                  </button>
                ))}
              </div>
            )}

            {/* Studio Main Workspace: SwiftUI Visual Editor OR Split Code+Preview */}
            {viewMode === "visual" ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <WinUIVisualEditor
                  appName={activeProject.name}
                  canvas={resolvedVisualDesign.canvas}
                  elements={resolvedVisualDesign.elements}
                  handlerNames={lastBuild.handlerNames}
                  onChange={handleVisualChange}
                  onImportFromCode={handleSyncVisualFromCode}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                {/* Code Editor Pane */}
                {viewMode !== "preview" && (
                  <div
                    className={`${
                      viewMode === "split"
                        ? "h-1/2 lg:h-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-black/[0.08] dark:border-white/[0.08]"
                        : "h-full w-full"
                    } flex flex-col min-w-0 bg-[#ffffff] dark:bg-[#1a1d22]`}
                  >
                    <div className="flex-1 min-h-0 flex overflow-hidden">
                      {/* Line numbers gutter */}
                      <div
                        aria-hidden="true"
                        style={{ fontSize: `${prefs.fontSize}px` }}
                        className="w-11 py-3 px-2 text-right font-mono tabular-nums text-black/35 dark:text-white/30 bg-black/[0.02] dark:bg-white/[0.02] border-r border-black/[0.05] dark:border-white/[0.05] select-none overflow-hidden leading-[1.55]"
                      >
                        {Array.from({ length: Math.min(editorLineCount, 400) }, (_, idx) => (
                          <div key={idx}>{idx + 1}</div>
                        ))}
                      </div>

                      {/* Editable source textarea */}
                      <textarea
                        aria-label={`Code editor for ${activeFile.name}`}
                        value={activeFile.content}
                        onChange={(e) => updateActiveFileContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Tab") {
                            e.preventDefault();
                            const target = e.currentTarget;
                            const start = target.selectionStart;
                            const end = target.selectionEnd;
                            const next =
                              activeFile.content.slice(0, start) +
                              "  " +
                              activeFile.content.slice(end);
                            updateActiveFileContent(next);
                            requestAnimationFrame(() => {
                              target.selectionStart = target.selectionEnd = start + 2;
                            });
                          }
                        }}
                        spellCheck={false}
                        style={{ fontSize: `${prefs.fontSize}px` }}
                        className={`flex-1 h-full p-3 font-mono leading-[1.55] bg-transparent outline-none resize-none ${
                          prefs.wordWrap ? "whitespace-pre-wrap" : "whitespace-pre overflow-x-auto"
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Live Built WinUI App Preview Pane */}
                {viewMode !== "code" && (
                  <div
                    className={`${
                      viewMode === "split" ? "h-1/2 lg:h-full lg:w-1/2" : "h-full w-full"
                    } flex flex-col min-w-0 bg-[#eaedf2] dark:bg-[#15181c] overflow-hidden`}
                  >
                    <div className="h-8 px-3 shrink-0 border-b border-black/[0.06] dark:border-white/[0.07] bg-white/70 dark:bg-[#22252b]/80 flex items-center justify-between gap-2 text-[11.5px]">
                      <div className="flex items-center gap-2 min-w-0">
                        {lastBuild.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        )}
                        <span className="font-medium truncate">
                          {lastBuild.success ? "Live Built Preview" : "Build Errors Detected"}
                        </span>
                        <span className="text-black/45 dark:text-white/45 tabular-nums hidden sm:inline">
                          · {lastBuild.controlCount} controls · {lastBuild.durationMs} ms
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRuntimeState({ ...lastBuild.initialState });
                            appendRuntimeLog("Reset runtime state");
                          }}
                          className="h-6 px-2 rounded-[4px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset State</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 p-3 overflow-auto">
                      <div
                        className={`h-full min-h-[300px] rounded-[8px] border border-black/10 dark:border-white/10 overflow-hidden shadow-sm ${viewportWidthClass}`}
                      >
                        <WinUIRuntimePreview
                          build={lastBuild}
                          state={runtimeState}
                          onUpdateState={(patch) =>
                            setRuntimeState((prev) =>
                              typeof patch === "function" ? patch(prev) : { ...prev, ...patch },
                            )
                          }
                          onLog={appendRuntimeLog}
                          themeOverride={prefs.previewTheme}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Build Diagnostics & Runtime Console Panel */}
            <div className="shrink-0 border-t border-black/[0.08] dark:border-white/[0.08] bg-[#f8f9fa] dark:bg-[#1f2228]">
              <div className="h-8 px-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConsoleTab("problems");
                      setIsConsoleOpen(true);
                    }}
                    className={`h-6 px-2.5 rounded-[4px] text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer tabular-nums ${
                      isConsoleOpen && consoleTab === "problems"
                        ? "bg-black/[0.08] dark:bg-white/[0.1]"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      Problems ({errorCount} errors · {warningCount} warnings)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConsoleTab("output");
                      setIsConsoleOpen(true);
                    }}
                    className={`h-6 px-2.5 rounded-[4px] text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer ${
                      isConsoleOpen && consoleTab === "output"
                        ? "bg-black/[0.08] dark:bg-white/[0.1]"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Hammer className="w-3.5 h-3.5" />
                    <span>Build Output</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConsoleTab("runtime");
                      setIsConsoleOpen(true);
                    }}
                    className={`h-6 px-2.5 rounded-[4px] text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer tabular-nums ${
                      isConsoleOpen && consoleTab === "runtime"
                        ? "bg-black/[0.08] dark:bg-white/[0.1]"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Runtime ({runtimeLogs.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsConsoleOpen((v) => !v)}
                  className="h-6 px-2 rounded-[4px] text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
                >
                  {isConsoleOpen ? "Hide" : "Show"}
                </button>
              </div>

              {isConsoleOpen && (
                <div className="h-32 overflow-y-auto border-t border-black/[0.06] dark:border-white/[0.07] px-3 py-2 font-mono text-[11.5px]">
                  {consoleTab === "problems" && (
                    <div className="space-y-1">
                      {lastBuild.diagnostics.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            if (d.file === "App.winui") setActiveFileKind("ui");
                            else if (d.file === "App.logic.js") setActiveFileKind("logic");
                            else if (d.file === "App.manifest.json") setActiveFileKind("manifest");
                          }}
                          className="w-full text-left px-2 py-1 rounded-[4px] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] flex items-center gap-2 cursor-pointer"
                        >
                          {d.severity === "error" ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          ) : d.severity === "warning" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <Info className="w-3.5 h-3.5 text-[#0067b8] dark:text-[#4cc2ff] shrink-0" />
                          )}
                          <span className="opacity-60 tabular-nums shrink-0">
                            {d.file}:{d.line}
                          </span>
                          <span className="truncate">{d.message}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {consoleTab === "output" && (
                    <div className="space-y-1 text-black/75 dark:text-white/75 tabular-nums">
                      <div>
                        Target: SparkleOS WinUI Framework SDK 2.9 (Build 28000.14) ·{" "}
                        {lastBuild.manifest.name} v{lastBuild.manifest.version}
                      </div>
                      <div>
                        Result: {lastBuild.success ? "Succeeded" : "Failed"} ·{" "}
                        {lastBuild.controlCount} controls · {formatBytes(lastBuild.bundleSizeBytes)}{" "}
                        standalone bundle · {lastBuild.durationMs} ms
                      </div>
                      <div>
                        Exported handlers:{" "}
                        {lastBuild.handlerNames.length > 0
                          ? lastBuild.handlerNames.join(", ")
                          : "(none)"}
                      </div>
                    </div>
                  )}

                  {consoleTab === "runtime" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold opacity-65">Event Logs</div>
                        {runtimeLogs.length === 0 ? (
                          <div className="opacity-50">
                            Interact with controls in the preview to view runtime logs.
                          </div>
                        ) : (
                          runtimeLogs.map((l) => (
                            <div key={l.id} className="truncate">
                              <span className="opacity-50 mr-2">[{l.time}]</span>
                              <span>{l.text}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold opacity-65">Live App State</div>
                        <pre className="text-[11px] opacity-80 whitespace-pre-wrap break-all">
                          {JSON.stringify(runtimeState, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAGE: TEMPLATES */}
        {activePage === "templates" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6">
            <div className="max-w-5xl mx-auto space-y-5">
              <div>
                <h1 className="text-[20px] font-semibold tracking-tight">
                  WinUI 3 Application Templates
                </h1>
                <p className="text-[13px] text-black/60 dark:text-white/60 mt-1">
                  Start a new app from a complete Fluent Design blueprint with pre-wired markup,
                  logic handlers, and manifest metadata.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {WINUI_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="rounded-[8px] border border-black/[0.08] dark:border-white/[0.08] bg-white/85 dark:bg-[#2c3037]/85 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="text-[11.5px] font-medium text-[#0067b8] dark:text-[#4cc2ff]">
                        {tpl.category} · {tpl.files.length} files
                      </div>
                      <h2 className="text-[16px] font-semibold">{tpl.name}</h2>
                      <p className="text-[12.5px] text-black/65 dark:text-white/65 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.07]">
                      <button
                        type="button"
                        onClick={() => handleCreateProject(tpl.id)}
                        className="h-8 px-3.5 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Create Project
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProjects((prev) =>
                            prev.map((p) =>
                              p.id === activeProject.id
                                ? {
                                    ...p,
                                    templateId: tpl.id,
                                    files: tpl.files.map((f) => ({ ...f })),
                                    updatedAt: Date.now(),
                                  }
                                : p,
                            ),
                          );
                          setActivePage("studio");
                          showAppToast(`Loaded "${tpl.name}" into ${activeProject.name}`, {
                            appName: "WinUI Framework",
                          });
                        }}
                        className="h-8 px-3 rounded-[6px] border border-black/12 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 text-[12px] font-medium cursor-pointer whitespace-nowrap"
                      >
                        Replace Active Files
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PAGE: CONTROLS & API */}
        {activePage === "controls" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6">
            <div className="max-w-5xl mx-auto space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-[20px] font-semibold tracking-tight">
                    WinUI Framework Controls & API
                  </h1>
                  <p className="text-[13px] text-black/60 dark:text-white/60 mt-0.5">
                    Insert declarative WinUI 3 controls straight into{" "}
                    <span className="font-mono">App.winui</span>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={controlSearch}
                    onChange={(e) => setControlSearch(e.target.value)}
                    placeholder="Filter controls..."
                    className="h-8 w-48 rounded-[6px] border border-black/12 dark:border-white/12 bg-white dark:bg-[#1f2328] px-3 text-[12.5px] outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {["All", "Navigation", "Layout", "Input", "Status", "Collections"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setControlCategory(cat)}
                    className={`h-7 px-3 rounded-[6px] text-[12px] font-medium cursor-pointer transition-colors ${
                      controlCategory === cat
                        ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black font-semibold"
                        : "bg-white/75 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredControls.map((ctrl) => (
                  <div
                    key={ctrl.tag}
                    className="rounded-[8px] border border-black/[0.08] dark:border-white/[0.08] bg-white/85 dark:bg-[#2c3037]/85 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14.5px] font-semibold font-mono">
                          &lt;{ctrl.tag}&gt;
                        </span>
                        <span className="text-[11.5px] text-black/55 dark:text-white/55">
                          {ctrl.category}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-black/65 dark:text-white/65">
                        {ctrl.summary}
                      </p>
                      <div className="text-[11.5px] text-black/55 dark:text-white/55 font-mono">
                        Props: {ctrl.props.join(" · ")}
                      </div>
                      <pre className="p-2.5 rounded-[6px] bg-[#f4f5f6] dark:bg-[#1a1d22] border border-black/[0.06] dark:border-white/[0.06] text-[11.5px] font-mono overflow-x-auto leading-relaxed">
                        {ctrl.snippet}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleInsertSnippet(ctrl.snippet, ctrl.tag)}
                        className="h-7 px-3 rounded-[5px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Insert into App.winui
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(ctrl.snippet);
                          setCopiedSnippetTag(ctrl.tag);
                          window.setTimeout(() => setCopiedSnippetTag(null), 1500);
                        }}
                        className="h-7 px-2.5 rounded-[5px] border border-black/12 dark:border-white/12 text-[12px] font-medium cursor-pointer flex items-center gap-1"
                      >
                        {copiedSnippetTag === ctrl.tag ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedSnippetTag === ctrl.tag ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PAGE: BUILD & PACKAGE */}
        {activePage === "build" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6">
            <div className="max-w-5xl mx-auto space-y-5">
              <div className="rounded-[8px] border border-black/[0.08] dark:border-white/[0.08] bg-white/85 dark:bg-[#2c3037]/85 p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[12px] text-black/55 dark:text-white/55">
                    Active Build Target · {lastBuild.manifest.targetBuild}
                  </div>
                  <h1 className="text-[19px] font-semibold">{lastBuild.manifest.name}</h1>
                  <div className="text-[12.5px] text-black/65 dark:text-white/65 tabular-nums">
                    v{lastBuild.manifest.version} · {lastBuild.controlCount} controls ·{" "}
                    {formatBytes(lastBuild.bundleSizeBytes)} bundle ·{" "}
                    {lastBuild.success ? "Build Succeeded" : "Build Failed"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openInstallModal}
                    className="h-8 px-3.5 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12.5px] font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Build to Start Menu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => runBuild(activeProject, true)}
                    className="h-8 px-3.5 rounded-[6px] border border-black/15 dark:border-white/15 text-[12.5px] font-medium cursor-pointer flex items-center gap-1.5"
                  >
                    <Hammer className="w-3.5 h-3.5" />
                    <span>Rebuild All</span>
                  </button>
                  <button
                    type="button"
                    disabled={!lastBuild.success}
                    onClick={() => setIsRunningWindowOpen(true)}
                    className="h-8 px-3.5 rounded-[6px] border border-black/15 dark:border-white/15 text-[12.5px] font-medium cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Launch Built App</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportHtml}
                    className="h-8 px-3.5 rounded-[6px] border border-black/15 dark:border-white/15 text-[12.5px] font-medium cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .winui.html</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportProjectJson}
                    className="h-8 px-3.5 rounded-[6px] border border-black/15 dark:border-white/15 text-[12.5px] font-medium cursor-pointer flex items-center gap-1.5"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>Export .winui.json</span>
                  </button>
                </div>
              </div>

              {/* Build History Table */}
              <div className="rounded-[8px] border border-black/[0.08] dark:border-white/[0.08] bg-white/85 dark:bg-[#2c3037]/85 overflow-hidden">
                <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.07] font-semibold text-[13.5px]">
                  Recent Builds
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-black/[0.06] dark:border-white/[0.07] text-[11.5px] text-black/55 dark:text-white/55">
                        <th className="px-4 py-2 font-medium">Build</th>
                        <th className="px-4 py-2 font-medium">Project</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium text-right">Controls</th>
                        <th className="px-4 py-2 font-medium text-right">Size</th>
                        <th className="px-4 py-2 font-medium text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06] tabular-nums">
                      {buildHistory.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2.5 font-mono">#{item.buildNumber}</td>
                          <td className="px-4 py-2.5 font-medium">{item.projectName}</td>
                          <td className="px-4 py-2.5">
                            {item.success ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                Succeeded
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                Failed ({item.errorCount} errors)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{item.controlCount}</td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {formatBytes(item.bundleSizeBytes)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{item.durationMs} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAGE: SETTINGS */}
        {activePage === "settings" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6">
            <div className="max-w-[740px] mx-auto space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-[20px] font-semibold tracking-tight">Settings</h1>
                <button
                  type="button"
                  onClick={() => setActivePage("studio")}
                  className="h-8 px-3 rounded-[6px] border border-black/12 dark:border-white/12 bg-white/80 dark:bg-white/[0.07] hover:bg-black/5 dark:hover:bg-white/10 text-[12.5px] font-medium cursor-pointer"
                >
                  Back to Studio
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Palette className="w-4 h-4 text-[#0067b8] dark:text-[#4cc2ff]" />
                    <div>
                      <div className="text-[13.5px] font-medium">SparkleOS appearance</div>
                      <div className="text-[11.5px] text-black/55 dark:text-white/55">
                        Switch between Dark and Light Fluent Design tokens
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(["dark", "light"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => updateSetting("theme", t)}
                        className={`h-8 px-3 rounded-[6px] border text-[12px] font-medium capitalize cursor-pointer ${
                          settings.theme === t
                            ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent font-semibold"
                            : "border-black/15 dark:border-white/15"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-4 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13.5px] font-medium">Auto-build on code changes</div>
                    <div className="text-[11.5px] text-black/55 dark:text-white/55">
                      Automatically recompile App.winui and App.logic.js while typing
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.autoBuild}
                    onClick={() => setPrefs((p) => ({ ...p, autoBuild: !p.autoBuild }))}
                    className={`relative h-5 w-10 rounded-full transition-colors cursor-pointer ${
                      prefs.autoBuild
                        ? "bg-[#0067b8] dark:bg-[#4cc2ff]"
                        : "bg-black/20 dark:bg-white/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-4 rounded-full bg-white dark:bg-black transition-all ${
                        prefs.autoBuild ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <WrapText className="w-4 h-4" />
                    <div>
                      <div className="text-[13.5px] font-medium">Editor typography & wrap</div>
                      <div className="text-[11.5px] text-black/55 dark:text-white/55">
                        Configure font size and line wrapping in the code editor
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Editor font size"
                      value={prefs.fontSize}
                      onChange={(e) =>
                        setPrefs((p) => ({ ...p, fontSize: Number(e.target.value) }))
                      }
                      className="h-8 px-2 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] text-[12px]"
                    >
                      {[12, 13, 14, 15].map((sz) => (
                        <option key={sz} value={sz}>
                          {sz}px
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, wordWrap: !p.wordWrap }))}
                      className={`h-8 px-3 rounded-[6px] border text-[12px] font-medium cursor-pointer ${
                        prefs.wordWrap
                          ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent"
                          : "border-black/15 dark:border-white/15"
                      }`}
                    >
                      Word Wrap
                    </button>
                  </div>
                </div>

                <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-4 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13.5px] font-medium">Reset workspace projects</div>
                    <div className="text-[11.5px] text-black/55 dark:text-white/55">
                      Restore default starter templates for WinUI Framework
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = [
                        createProjectFromTemplate("task-hub", "Fluent Task Hub"),
                        createProjectFromTemplate("control-playground", "WinUI 3 Control Lab"),
                      ];
                      setProjects(defaults);
                      setActiveProjectId(defaults[0]!.id);
                      showAppToast("Workspace restored to defaults", {
                        appName: "WinUI Framework",
                      });
                    }}
                    className="h-8 px-3.5 rounded-[6px] border border-rose-500/35 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-[12px] font-medium cursor-pointer"
                  >
                    Reset Workspace
                  </button>
                </div>

                {/* About */}
                <div className="pt-2 space-y-2">
                  <h3 className="text-[13px] font-semibold">About</h3>
                  <div className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.07]">
                    <button
                      type="button"
                      onClick={() => setAboutExpanded((v) => !v)}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Info className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="text-[13.5px] font-medium">WinUI Framework Studio</div>
                          <div className="text-[11.5px] tabular-nums text-black/60 dark:text-white/60">
                            Version: 22631.28000.14 · WinUI Framework SDK 2.9
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          aboutExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {aboutExpanded && navigate && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate("/winui-3")}
                          className="w-full px-11 py-2.5 flex items-center justify-between text-[12.5px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer text-left"
                        >
                          <span>Open WinUI 3 Gallery</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/settings")}
                          className="w-full px-11 py-2.5 flex items-center justify-between text-[12.5px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer text-left"
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
        )}
      </div>

      {/* New Project Modal */}
      {newProjectModalOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] as const }}
              onMouseDown={() => setNewProjectModalOpen(false)}
              className="fixed inset-0 z-[2147483640] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
                role="dialog"
                aria-modal="true"
                aria-label="New WinUI Framework App"
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-[10px] border border-black/12 dark:border-white/12 bg-[#f9f9f9] dark:bg-[#272b30] text-[#18181b] dark:text-[#f4f4f5] shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07] dark:border-white/[0.08]">
                  <h3 className="text-[14px] font-semibold">New WinUI Framework App</h3>
                  <button
                    type="button"
                    onClick={() => setNewProjectModalOpen(false)}
                    aria-label="Close"
                    className="w-7 h-7 rounded-[5px] flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.09] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateProject(newProjectTemplate, newProjectName);
                  }}
                  className="p-4 space-y-4"
                >
                  <div>
                    <label className="block text-[12px] font-medium mb-1">App Name</label>
                    <input
                      autoFocus
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="My WinUI 3 App"
                      className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-3 text-[12.5px] outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1">Template</label>
                    <select
                      value={newProjectTemplate}
                      onChange={(e) => setNewProjectTemplate(e.target.value)}
                      className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-2.5 text-[12.5px] outline-none"
                    >
                      {WINUI_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.category})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      className="px-4 h-8 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12.5px] font-semibold cursor-pointer"
                    >
                      Create & Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProjectModalOpen(false)}
                      className="px-4 h-8 rounded-[6px] border border-black/12 dark:border-white/12 text-[12.5px] font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}

      {/* Build & Install to Start Menu Modal */}
      {installModalOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] as const }}
              onMouseDown={() => setInstallModalOpen(false)}
              className="fixed inset-0 z-[2147483640] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
                role="dialog"
                aria-modal="true"
                aria-label="Build & Add App to Start Menu"
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-[10px] border border-black/12 dark:border-white/12 bg-[#f9f9f9] dark:bg-[#272b30] text-[#18181b] dark:text-[#f4f4f5] shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07] dark:border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-[#0067b8] dark:text-[#4cc2ff]" />
                    <h3 className="text-[14px] font-semibold">Build &amp; Add to Start Menu</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInstallModalOpen(false)}
                    aria-label="Close"
                    className="w-7 h-7 rounded-[5px] flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.09] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleInstallToStartMenu} className="p-4 space-y-4">
                  {/* Live Start Tile Preview */}
                  <div className="rounded-[8px] border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[#1f2328]/80 p-3 flex items-center gap-3.5">
                    <InstalledWinUIAppBadge
                      iconKey={installIconKey}
                      accentColor={installAccentColor}
                      className="w-12 h-12"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold truncate">
                        {installName.trim() || activeProject.name}
                      </div>
                      <div className="text-[11.5px] opacity-65 truncate">
                        {installDesc.trim() || "WinUI 3 Visual App · Start Menu"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium mb-1">App Name</label>
                      <input
                        autoFocus
                        required
                        value={installName}
                        onChange={(e) => setInstallName(e.target.value)}
                        placeholder="My Custom App"
                        className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-3 text-[12.5px] outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1">Description</label>
                      <input
                        value={installDesc}
                        onChange={(e) => setInstallDesc(e.target.value)}
                        placeholder="Short subtitle..."
                        className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-3 text-[12.5px] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium mb-1.5">App Icon</label>
                    <div className="grid grid-cols-6 gap-1.5">
                      {WINUI_APP_ICON_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setInstallIconKey(key)}
                          aria-label={`Icon ${key}`}
                          className={`p-1.5 rounded-[6px] border flex items-center justify-center cursor-pointer transition-all ${
                            installIconKey === key
                              ? "border-[#0067b8] dark:border-[#4cc2ff] bg-[#0067b8]/10 dark:bg-[#4cc2ff]/12"
                              : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                          }`}
                        >
                          <InstalledWinUIAppBadge
                            iconKey={key}
                            accentColor={installAccentColor}
                            className="w-7 h-7"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium mb-1.5">Accent Color</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {WINUI_APP_ACCENT_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setInstallAccentColor(hex)}
                          aria-label={`Accent ${hex}`}
                          style={{ backgroundColor: hex }}
                          className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                            installAccentColor === hex
                              ? "ring-2 ring-offset-2 ring-[#0067b8] dark:ring-[#4cc2ff] dark:ring-offset-[#272b30] scale-110"
                              : "hover:scale-105"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={installPinStart}
                        onChange={(e) => setInstallPinStart(e.target.checked)}
                        className="accent-[#0067b8] dark:accent-[#4cc2ff]"
                      />
                      <span>Pin to Start Menu</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={installPinTaskbar}
                        onChange={(e) => setInstallPinTaskbar(e.target.checked)}
                        className="accent-[#0067b8] dark:accent-[#4cc2ff]"
                      />
                      <span>Pin to Taskbar</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.07] dark:border-white/[0.08]">
                    <div>
                      {lastInstalledRoute && navigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setInstallModalOpen(false);
                            navigate(lastInstalledRoute);
                          }}
                          className="h-8 px-3 rounded-[6px] border border-emerald-600/35 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-[12px] font-semibold cursor-pointer flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Launch App</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="px-4 h-8 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12.5px] font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <Pin className="w-3.5 h-3.5" />
                        <span>Build &amp; Install</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstallModalOpen(false)}
                        className="px-3.5 h-8 rounded-[6px] border border-black/12 dark:border-white/12 text-[12.5px] font-medium cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}

      {/* Standalone Built App Runner Modal Window */}
      {isRunningWindowOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] as const }}
              onMouseDown={() => setIsRunningWindowOpen(false)}
              className="fixed inset-0 z-[2147483640] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
                role="dialog"
                aria-modal="true"
                aria-label={lastBuild.manifest.windowTitle}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-4xl h-[82vh] rounded-[10px] border border-black/15 dark:border-white/15 bg-[#f4f4f6] dark:bg-[#1e2126] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="h-9 px-3 border-b border-black/[0.08] dark:border-white/[0.08] bg-white/85 dark:bg-[#24282e] flex items-center justify-between gap-2 shrink-0">
                  <span className="text-[12px] font-semibold truncate">
                    Running Build — {activeProject.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRunningWindowOpen(false);
                        openInstallModal();
                      }}
                      className="h-6 px-2.5 rounded-[4px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[11px] font-semibold cursor-pointer"
                    >
                      Add to Start Menu
                    </button>
                    <button
                      type="button"
                      onClick={handleExportHtml}
                      className="h-6 px-2.5 rounded-[4px] border border-black/12 dark:border-white/12 text-[11px] font-medium cursor-pointer"
                    >
                      Export .html
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRunningWindowOpen(false)}
                      aria-label="Close app window"
                      className="w-7 h-6 rounded-[4px] flex items-center justify-center hover:bg-rose-500 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  {viewMode === "visual" ? (
                    <WinUIVisualRuntime
                      appName={activeProject.name}
                      canvas={resolvedVisualDesign.canvas}
                      elements={resolvedVisualDesign.elements}
                      fillContainer
                      onRunHandler={(handlerName) => {
                        const fn = lastBuild.handlers[handlerName.trim()];
                        if (fn) {
                          fn(
                            runtimeState,
                            (patch) =>
                              setRuntimeState((prev) =>
                                typeof patch === "function" ? patch(prev) : { ...prev, ...patch },
                              ),
                            appendRuntimeLog,
                          );
                        }
                      }}
                      onLog={appendRuntimeLog}
                    />
                  ) : (
                    <WinUIRuntimePreview
                      build={lastBuild}
                      state={runtimeState}
                      onUpdateState={(patch) =>
                        setRuntimeState((prev) =>
                          typeof patch === "function" ? patch(prev) : { ...prev, ...patch },
                        )
                      }
                      onLog={appendRuntimeLog}
                      themeOverride={prefs.previewTheme}
                    />
                  )}
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
};
