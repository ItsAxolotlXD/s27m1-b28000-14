import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Grid,
  Layers,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import type {
  VisualActionKind,
  VisualCanvasConfig,
  VisualElement,
  VisualElementProps,
  VisualElementType,
} from "../services/installedWinUIAppsStore";
import { WINUI_GALLERY_TOOLBOX, type WinUIGalleryToolboxItem } from "../utils/winuiFrameworkEngine";
import { WinUIVisualRuntime, getVisualCanvasSurfaceClass } from "./WinUIVisualRuntime";

interface WinUIVisualEditorProps {
  appName: string;
  canvas: VisualCanvasConfig;
  elements: VisualElement[];
  handlerNames: string[];
  onChange: (nextCanvas: VisualCanvasConfig, nextElements: VisualElement[]) => void;
  onImportFromCode?: () => void;
}

type ResizeHandleDir = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

const TOOLBOX_CATEGORIES = [
  "All",
  "Basic Input",
  "Text & Display",
  "Status & Progress",
  "Layout & Containers",
  "Collections & Pickers",
] as const;

const CANVAS_PRESETS: Array<{ label: string; width: number; height: number }> = [
  { label: "Desktop 840×540", width: 840, height: 540 },
  { label: "Compact 620×440", width: 620, height: 440 },
  { label: "Mobile 380×620", width: 380, height: 620 },
];

const INTERACTIVE_TYPES = new Set<VisualElementType>([
  "Button",
  "HyperlinkButton",
  "ToggleSwitch",
  "CheckBox",
  "ComboBox",
  "RatingControl",
  "ListView",
  "TextBox",
]);

function snapValue(val: number, snap: boolean, step = 8): number {
  return snap ? Math.round(val / step) * step : Math.round(val);
}

function renderDesignPreview(el: VisualElement, isDarkSurface: boolean): React.ReactNode {
  const p = el.props;
  const radius = p.radius ?? 6;
  const cardCls = isDarkSurface
    ? "bg-white/[0.06] border-white/[0.12]"
    : "bg-white/85 dark:bg-white/[0.06] border-black/[0.1] dark:border-white/[0.12]";

  switch (el.type) {
    case "TextBlock": {
      const variant = p.styleVariant ?? "Body";
      const typCls =
        variant === "Title"
          ? "text-[20px] font-semibold tracking-tight"
          : variant === "Subtitle"
            ? "text-[15.5px] font-semibold"
            : variant === "Caption"
              ? "text-[12px] opacity-65"
              : "text-[13.5px]";
      return (
        <div className={`w-full h-full flex items-center px-1 ${typCls}`}>
          <span className="truncate">{p.text ?? el.name}</span>
        </div>
      );
    }

    case "Button": {
      const variant = p.styleVariant ?? "Accent";
      const cls =
        variant === "Accent"
          ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent font-semibold"
          : variant === "Danger"
            ? "bg-rose-600 text-white border-transparent font-semibold"
            : variant === "Subtle"
              ? "bg-black/[0.04] dark:bg-white/[0.06] border-transparent font-medium"
              : "bg-white/90 dark:bg-white/[0.09] border-black/15 dark:border-white/15 font-medium";
      return (
        <div
          style={{ borderRadius: `${radius}px` }}
          className={`w-full h-full px-3 border text-[13px] flex items-center justify-center truncate ${cls}`}
        >
          {p.text ?? "Button"}
        </div>
      );
    }

    case "HyperlinkButton":
      return (
        <div className="w-full h-full px-2 text-[13px] font-medium text-[#0067b8] dark:text-[#4cc2ff] underline flex items-center truncate">
          {p.text ?? "HyperlinkButton"}
        </div>
      );

    case "ToggleSwitch": {
      const on = p.isOn !== false;
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
          {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
          <div className="flex items-center gap-2">
            <div
              className={`relative w-10 h-5 rounded-full ${
                on ? "bg-[#0067b8] dark:bg-[#4cc2ff]" : "bg-black/20 dark:bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full ${
                  on
                    ? "left-[21px] bg-white dark:bg-black"
                    : "left-0.5 bg-black/70 dark:bg-white/80"
                }`}
              />
            </div>
            <span className="text-[12px] opacity-75">{on ? "On" : "Off"}</span>
          </div>
        </div>
      );
    }

    case "CheckBox":
      return (
        <div className="w-full h-full px-1 flex items-center gap-2.5">
          <span
            className={`size-4.5 rounded-[4px] border flex items-center justify-center shrink-0 text-[10px] ${
              p.isChecked !== false
                ? "bg-[#0067b8] dark:bg-[#4cc2ff] border-transparent text-white dark:text-black"
                : "border-black/35 dark:border-white/35"
            }`}
          >
            {p.isChecked !== false ? "✓" : ""}
          </span>
          <span className="text-[13px] truncate">{p.text ?? "CheckBox"}</span>
        </div>
      );

    case "Slider": {
      const min = p.min ?? 0;
      const max = Math.max(min + 1, p.max ?? 100);
      const val = Math.max(min, Math.min(max, p.value ?? 50));
      const pct = ((val - min) / (max - min)) * 100;
      return (
        <div className="w-full h-full flex flex-col justify-center gap-2 px-1">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium truncate">{p.header ?? "Slider"}</span>
            <span className="font-mono tabular-nums opacity-70">{val}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-black/15 dark:bg-white/15">
            <div
              style={{ width: `${pct}%` }}
              className="h-full rounded-full bg-[#0067b8] dark:bg-[#4cc2ff]"
            />
            <span
              style={{ left: `calc(${pct}% - 7px)` }}
              className="absolute top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-[#0067b8] dark:bg-[#4cc2ff] ring-2 ring-white dark:ring-[#1f2328]"
            />
          </div>
        </div>
      );
    }

    case "TextBox":
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
          {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
          <div
            style={{ borderRadius: `${radius}px` }}
            className="h-8.5 px-2.5 border border-black/15 dark:border-white/15 border-b-2 border-b-black/30 dark:border-b-white/30 bg-white dark:bg-[#1f2328] flex items-center text-[12.5px] opacity-75 truncate"
          >
            {p.text || p.placeholder || "TextBox"}
          </div>
        </div>
      );

    case "NumberBox":
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
          {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
          <div
            style={{ borderRadius: `${radius}px` }}
            className="h-8.5 px-2.5 border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] flex items-center justify-between text-[12.5px] font-mono tabular-nums"
          >
            <span>-</span>
            <span>{p.value ?? 0}</span>
            <span>+</span>
          </div>
        </div>
      );

    case "ComboBox":
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
          {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
          <div
            style={{ borderRadius: `${radius}px` }}
            className="h-8.5 px-2.5 border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] flex items-center justify-between text-[12.5px]"
          >
            <span className="truncate">{p.selected || "Select option"}</span>
            <span className="opacity-50 text-[10px]">▼</span>
          </div>
        </div>
      );

    case "RatingControl": {
      const val = p.value ?? 4;
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
          {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
          <div className="flex items-center gap-1 text-[15px]">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={
                  n <= val
                    ? "text-[#0067b8] dark:text-[#4cc2ff]"
                    : "text-black/25 dark:text-white/25"
                }
              >
                ★
              </span>
            ))}
          </div>
        </div>
      );
    }

    case "CalendarDatePicker":
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
          {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
          <div
            style={{ borderRadius: `${radius}px` }}
            className="h-8.5 px-2.5 border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] flex items-center justify-between text-[12px] font-mono"
          >
            <span>{p.text || "2026-11-24"}</span>
            <span className="opacity-50">📅</span>
          </div>
        </div>
      );

    case "InfoBar": {
      const sev = p.severity ?? "info";
      const cls =
        sev === "success"
          ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
          : sev === "warning"
            ? "bg-amber-500/12 border-amber-500/30 text-amber-800 dark:text-amber-300"
            : sev === "error"
              ? "bg-rose-500/12 border-rose-500/30 text-rose-700 dark:text-rose-300"
              : "bg-[#0067b8]/10 dark:bg-[#4cc2ff]/12 border-[#0067b8]/25 dark:border-[#4cc2ff]/30 text-[#005192] dark:text-[#7dd3fc]";
      return (
        <div
          style={{ borderRadius: `${radius}px` }}
          className={`w-full h-full px-3 py-2 border flex flex-col justify-center overflow-hidden ${cls}`}
        >
          <div className="text-[12.5px] font-semibold truncate">{p.header ?? "InfoBar"}</div>
          {p.text && <div className="text-[11.5px] opacity-85 truncate">{p.text}</div>}
        </div>
      );
    }

    case "ProgressBar": {
      const pct = Math.max(0, Math.min(100, ((p.value ?? 50) / Math.max(1, p.max ?? 100)) * 100));
      return (
        <div className="w-full h-full flex flex-col justify-center gap-1.5 px-1">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium truncate">{p.header ?? "Progress"}</span>
            <span className="font-mono tabular-nums opacity-70">{Math.round(pct)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/12 dark:bg-white/15 overflow-hidden">
            <div
              style={{ width: `${pct}%` }}
              className="h-full rounded-full bg-[#0067b8] dark:bg-[#4cc2ff]"
            />
          </div>
        </div>
      );
    }

    case "ProgressRing":
      return (
        <div className="w-full h-full px-2 flex items-center gap-2.5">
          <span className="size-6 rounded-full border-[2.5px] border-[#0067b8]/25 border-t-[#0067b8] dark:border-[#4cc2ff]/25 dark:border-t-[#4cc2ff] shrink-0" />
          <span className="text-[12.5px] truncate opacity-80">{p.text ?? "Syncing..."}</span>
        </div>
      );

    case "Badge":
      return (
        <div
          style={{ borderRadius: `${radius}px` }}
          className="w-full h-full px-2.5 border border-[#0067b8]/25 bg-[#0067b8]/12 text-[#0067b8] dark:bg-[#4cc2ff]/15 dark:text-[#4cc2ff] flex items-center justify-center text-[11.5px] font-semibold truncate"
        >
          {p.text ?? "Badge"}
        </div>
      );

    case "Card":
    case "Expander":
      return (
        <div
          style={{ borderRadius: `${radius}px` }}
          className={`w-full h-full border p-3 flex flex-col gap-1 overflow-hidden ${cardCls}`}
        >
          <div className="text-[13px] font-semibold truncate">{p.header ?? el.type}</div>
          {p.subtitle && <div className="text-[11px] opacity-60 truncate">{p.subtitle}</div>}
          {p.text && <div className="text-[12px] opacity-80 line-clamp-3 mt-0.5">{p.text}</div>}
        </div>
      );

    case "ListView": {
      const list = (p.items ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return (
        <div
          style={{ borderRadius: `${radius}px` }}
          className={`w-full h-full border flex flex-col overflow-hidden ${cardCls}`}
        >
          <div className="px-3 py-1.5 border-b border-black/[0.06] dark:border-white/[0.08] text-[12px] font-semibold truncate">
            {p.header ?? "ListView"}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            {list.slice(0, 4).map((item, i) => (
              <div key={i} className="px-3 py-1.5 text-[12px] truncate opacity-85">
                • {item}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "ImageCard": {
      const accent = p.accentColor || "#0067b8";
      return (
        <div
          style={{
            borderRadius: `${radius}px`,
            background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 45%, #090d16))`,
          }}
          className="w-full h-full p-3.5 text-white flex flex-col justify-between overflow-hidden"
        >
          <Sparkles className="w-4 h-4 opacity-90" />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold truncate">{p.header ?? "AcrylicTile"}</div>
            {p.subtitle && <div className="text-[11px] text-white/80 truncate">{p.subtitle}</div>}
          </div>
        </div>
      );
    }

    case "Divider":
      return (
        <div className="w-full h-full flex items-center">
          <div className="w-full h-px bg-black/15 dark:bg-white/20" />
        </div>
      );
  }
}

export const WinUIVisualEditor: React.FC<WinUIVisualEditorProps> = ({
  appName,
  canvas,
  elements,
  handlerNames,
  onChange,
  onImportFromCode,
}) => {
  const [toolboxCategory, setToolboxCategory] = useState<string>("All");
  const [toolboxSearch, setToolboxSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [canvasMode, setCanvasMode] = useState<"design" | "test">("design");
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState<string>("");

  // Undo / Redo history
  const [historyPast, setHistoryPast] = useState<VisualElement[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<VisualElement[][]>([]);

  const artboardRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) ?? null,
    [elements, selectedId],
  );

  const commitElements = useCallback(
    (nextElements: VisualElement[], pushHistory = true) => {
      if (pushHistory) {
        setHistoryPast((prev) => [...prev.slice(-29), elementsRef.current]);
        setHistoryFuture([]);
      }
      onChange(canvasRef.current, nextElements);
    },
    [onChange],
  );

  const handleUndo = useCallback(() => {
    setHistoryPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1]!;
      setHistoryFuture((f) => [elementsRef.current, ...f.slice(0, 29)]);
      onChange(canvasRef.current, previous);
      return prev.slice(0, -1);
    });
  }, [onChange]);

  const handleRedo = useCallback(() => {
    setHistoryFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0]!;
      setHistoryPast((p) => [...p.slice(-29), elementsRef.current]);
      onChange(canvasRef.current, next);
      return prev.slice(1);
    });
  }, [onChange]);

  const addElementFromToolbox = useCallback(
    (item: WinUIGalleryToolboxItem, dropPos?: { x: number; y: number }) => {
      const current = elementsRef.current;
      const snap = canvasRef.current.snapGrid;
      const cascade = (current.length % 7) * 16;
      const rawX = dropPos ? dropPos.x - item.defaultWidth / 2 : 28 + cascade;
      const rawY = dropPos ? dropPos.y - item.defaultHeight / 2 : 28 + cascade;
      const x = Math.max(
        0,
        Math.min(canvasRef.current.width - item.defaultWidth, snapValue(rawX, snap)),
      );
      const y = Math.max(
        0,
        Math.min(canvasRef.current.height - item.defaultHeight, snapValue(rawY, snap)),
      );
      const maxZ = current.reduce((m, e) => Math.max(m, e.zIndex), 0);

      const created: VisualElement = {
        id: `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        type: item.type,
        name: `${item.label} ${current.length + 1}`,
        x,
        y,
        width: item.defaultWidth,
        height: item.defaultHeight,
        zIndex: maxZ + 1,
        props: { ...item.defaultProps },
        ...(item.defaultAction ? { action: { ...item.defaultAction } } : {}),
      };

      commitElements([...current, created], true);
      setSelectedId(created.id);
      setCanvasMode("design");
    },
    [commitElements],
  );

  const updateSelectedProps = (patch: Partial<VisualElementProps>) => {
    if (!selectedElement) return;
    const next = elements.map((el) =>
      el.id === selectedElement.id ? { ...el, props: { ...el.props, ...patch } } : el,
    );
    commitElements(next, false);
  };

  const updateSelectedElement = useCallback(
    (patch: Partial<VisualElement>, pushHistory = false) => {
      if (!selectedId) return;
      const next = elementsRef.current.map((el) =>
        el.id === selectedId ? { ...el, ...patch } : el,
      );
      commitElements(next, pushHistory);
    },
    [commitElements, selectedId],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    commitElements(
      elementsRef.current.filter((el) => el.id !== selectedId),
      true,
    );
    setSelectedId(null);
  }, [commitElements, selectedId]);

  const handleDuplicateSelected = useCallback(() => {
    const target = elementsRef.current.find((el) => el.id === selectedId);
    if (!target) return;
    const maxZ = elementsRef.current.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const clone: VisualElement = {
      ...JSON.parse(JSON.stringify(target)),
      id: `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${target.name} Copy`,
      x: Math.min(canvasRef.current.width - target.width, target.x + 16),
      y: Math.min(canvasRef.current.height - target.height, target.y + 16),
      zIndex: maxZ + 1,
    };
    commitElements([...elementsRef.current, clone], true);
    setSelectedId(clone.id);
  }, [commitElements, selectedId]);

  const shiftZIndex = (dir: 1 | -1) => {
    if (!selectedElement) return;
    const nextZ = Math.max(1, selectedElement.zIndex + dir);
    updateSelectedElement({ zIndex: nextZ }, true);
  };

  // Drag / Resize state
  const interactionRef = useRef<
    | {
        mode: "move";
        id: string;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        width: number;
        height: number;
        snapshot: VisualElement[];
        moved: boolean;
      }
    | {
        mode: "resize";
        id: string;
        dir: ResizeHandleDir;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        origW: number;
        origH: number;
        snapshot: VisualElement[];
        moved: boolean;
      }
    | null
  >(null);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const act = interactionRef.current;
      if (!act) return;
      const dx = (e.clientX - act.startX) / zoom;
      const dy = (e.clientY - act.startY) / zoom;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) act.moved = true;

      const c = canvasRef.current;
      const snap = c.snapGrid;

      if (act.mode === "move") {
        const nx = Math.max(0, Math.min(c.width - act.width, snapValue(act.origX + dx, snap)));
        const ny = Math.max(0, Math.min(c.height - act.height, snapValue(act.origY + dy, snap)));
        onChange(
          c,
          elementsRef.current.map((el) => (el.id === act.id ? { ...el, x: nx, y: ny } : el)),
        );
      } else {
        const minW = 48;
        const minH = 18;
        let nx = act.origX;
        let ny = act.origY;
        let nw = act.origW;
        let nh = act.origH;

        if (act.dir.includes("e")) {
          nw = Math.max(minW, Math.min(c.width - act.origX, snapValue(act.origW + dx, snap)));
        }
        if (act.dir.includes("s")) {
          nh = Math.max(minH, Math.min(c.height - act.origY, snapValue(act.origH + dy, snap)));
        }
        if (act.dir.includes("w")) {
          const candW = Math.max(
            minW,
            Math.min(act.origX + act.origW, snapValue(act.origW - dx, snap)),
          );
          nx = act.origX + (act.origW - candW);
          nw = candW;
        }
        if (act.dir.includes("n")) {
          const candH = Math.max(
            minH,
            Math.min(act.origY + act.origH, snapValue(act.origH - dy, snap)),
          );
          ny = act.origY + (act.origH - candH);
          nh = candH;
        }

        onChange(
          c,
          elementsRef.current.map((el) =>
            el.id === act.id ? { ...el, x: nx, y: ny, width: nw, height: nh } : el,
          ),
        );
      }
    };

    const onPointerUp = () => {
      const act = interactionRef.current;
      if (!act) return;
      if (act.moved) {
        setHistoryPast((prev) => [...prev.slice(-29), act.snapshot]);
        setHistoryFuture([]);
      }
      interactionRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onChange, zoom]);

  // Keyboard nudge/delete/duplicate/undo when artboard is active
  const handleArtboardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (inlineEditId) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      handleRedo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      handleDuplicateSelected();
      return;
    }
    if (!selectedElement) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      handleDeleteSelected();
      return;
    }
    const step = e.shiftKey ? 8 : 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      updateSelectedElement({ x: Math.max(0, selectedElement.x - step) }, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      updateSelectedElement(
        { x: Math.min(canvas.width - selectedElement.width, selectedElement.x + step) },
        true,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      updateSelectedElement({ y: Math.max(0, selectedElement.y - step) }, true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      updateSelectedElement(
        { y: Math.min(canvas.height - selectedElement.height, selectedElement.y + step) },
        true,
      );
    }
  };

  const filteredToolbox = useMemo(() => {
    const q = toolboxSearch.trim().toLowerCase();
    return WINUI_GALLERY_TOOLBOX.filter((item) => {
      const catOk = toolboxCategory === "All" || item.category === toolboxCategory;
      const textOk =
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [toolboxCategory, toolboxSearch]);

  const sortedLayers = useMemo(() => [...elements].sort((a, b) => b.zIndex - a.zIndex), [elements]);

  const isDarkSurface = canvas.surface === "dark" || canvas.surface === "slate";
  const surfaceClass = getVisualCanvasSurfaceClass(canvas.surface);

  const handles: Array<{ dir: ResizeHandleDir; posClass: string; cursor: string }> = [
    { dir: "nw", posClass: "-top-1 -left-1", cursor: "nwse-resize" },
    { dir: "n", posClass: "-top-1 left-1/2 -translate-x-1/2", cursor: "ns-resize" },
    { dir: "ne", posClass: "-top-1 -right-1", cursor: "nesw-resize" },
    { dir: "w", posClass: "top-1/2 -left-1 -translate-y-1/2", cursor: "ew-resize" },
    { dir: "e", posClass: "top-1/2 -right-1 -translate-y-1/2", cursor: "ew-resize" },
    { dir: "sw", posClass: "-bottom-1 -left-1", cursor: "nesw-resize" },
    { dir: "s", posClass: "-bottom-1 left-1/2 -translate-x-1/2", cursor: "ns-resize" },
    { dir: "se", posClass: "-bottom-1 -right-1", cursor: "nwse-resize" },
  ];

  const startInlineEdit = (el: VisualElement) => {
    const editableTypes: VisualElementType[] = [
      "TextBlock",
      "Button",
      "HyperlinkButton",
      "CheckBox",
      "Badge",
    ];
    if (editableTypes.includes(el.type)) {
      setInlineEditId(el.id);
      setInlineDraft(el.props.text ?? el.name);
      return;
    }
    if (el.props.header !== undefined) {
      setInlineEditId(el.id);
      setInlineDraft(el.props.header);
    }
  };

  const commitInlineEdit = (el: VisualElement) => {
    const useHeader =
      el.type !== "TextBlock" &&
      el.type !== "Button" &&
      el.type !== "HyperlinkButton" &&
      el.type !== "CheckBox" &&
      el.type !== "Badge";
    const next = elements.map((item) =>
      item.id === el.id
        ? {
            ...item,
            props: useHeader
              ? { ...item.props, header: inlineDraft }
              : { ...item.props, text: inlineDraft },
          }
        : item,
    );
    commitElements(next, true);
    setInlineEditId(null);
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row min-h-0 overflow-hidden bg-[#f1f3f7] dark:bg-[#171a20]">
      {/* LEFT PANE: WinUI 3 Gallery Toolbox */}
      <aside className="w-full lg:w-[232px] shrink-0 border-b lg:border-b-0 lg:border-r border-black/[0.08] dark:border-white/[0.08] bg-[#f8f9fb] dark:bg-[#1e2229] flex flex-col max-h-[210px] lg:max-h-none min-h-0">
        <div className="p-2.5 border-b border-black/[0.06] dark:border-white/[0.07] space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold">WinUI 3 Elements</span>
            <span className="text-[11px] font-mono tabular-nums opacity-55">
              {filteredToolbox.length}
            </span>
          </div>
          <div className="h-7.5 px-2 rounded-[5px] bg-white dark:bg-[#15181e] border border-black/10 dark:border-white/10 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
            <input
              type="text"
              value={toolboxSearch}
              onChange={(e) => setToolboxSearch(e.target.value)}
              placeholder="Search Gallery controls..."
              className="w-full bg-transparent text-[11.5px] outline-none"
            />
          </div>
          <select
            aria-label="Filter control category"
            value={toolboxCategory}
            onChange={(e) => setToolboxCategory(e.target.value)}
            className="w-full h-7 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[11.5px] outline-none cursor-pointer"
          >
            {TOOLBOX_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {filteredToolbox.map((item) => (
            <button
              key={item.type}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-winui-type", item.type);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => addElementFromToolbox(item)}
              title={item.summary}
              className="w-full px-2.5 py-2 rounded-[6px] border border-black/[0.06] dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.04] hover:border-[#0067b8]/50 dark:hover:border-[#4cc2ff]/50 hover:bg-[#0067b8]/[0.05] dark:hover:bg-[#4cc2ff]/[0.07] flex items-center justify-between gap-2 text-left cursor-grab active:cursor-grabbing transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[12px] font-semibold truncate">{item.label}</div>
                <div className="text-[10.5px] opacity-55 truncate">{item.category}</div>
              </div>
              <Plus className="w-3.5 h-3.5 shrink-0 text-[#0067b8] dark:text-[#4cc2ff]" />
            </button>
          ))}
        </div>
      </aside>

      {/* CENTER PANE: Design Toolbar + Interactive Artboard */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Designer Toolbar */}
        <div className="h-9 px-3 shrink-0 border-b border-black/[0.07] dark:border-white/[0.08] bg-white/75 dark:bg-[#22262e] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center rounded-[5px] border border-black/10 dark:border-white/10 p-0.5 bg-black/[0.03] dark:bg-white/[0.04]">
              <button
                type="button"
                onClick={() => setCanvasMode("design")}
                className={`h-6 px-2.5 rounded-[4px] flex items-center gap-1 text-[11.5px] cursor-pointer ${
                  canvasMode === "design"
                    ? "bg-white dark:bg-[#32363e] font-semibold shadow-xs"
                    : "opacity-65 hover:opacity-100"
                }`}
              >
                <MousePointer2 className="w-3 h-3" />
                <span>Design</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setCanvasMode("test");
                }}
                className={`h-6 px-2.5 rounded-[4px] flex items-center gap-1 text-[11.5px] cursor-pointer ${
                  canvasMode === "test"
                    ? "bg-white dark:bg-[#32363e] font-semibold shadow-xs text-emerald-600 dark:text-emerald-400"
                    : "opacity-65 hover:opacity-100"
                }`}
              >
                <Play className="w-3 h-3" />
                <span>Live Test</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              title="Undo (Ctrl+Z)"
              className="w-7 h-7 rounded-[5px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyFuture.length === 0}
              title="Redo (Ctrl+Y)"
              className="w-7 h-7 rounded-[5px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:opacity-35 cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onChange({ ...canvas, snapGrid: !canvas.snapGrid }, elements)}
              title="Snap to 8px Grid"
              className={`h-7 px-2 rounded-[5px] flex items-center gap-1 text-[11.5px] cursor-pointer ${
                canvas.snapGrid
                  ? "bg-[#0067b8]/12 dark:bg-[#4cc2ff]/15 text-[#0067b8] dark:text-[#4cc2ff] font-medium"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Snap</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              aria-label="Canvas size preset"
              value={`${canvas.width}x${canvas.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split("x").map(Number);
                if (w && h) onChange({ ...canvas, width: w, height: h }, elements);
              }}
              className="h-7 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#181b20] text-[11.5px] outline-none cursor-pointer tabular-nums"
            >
              {CANVAS_PRESETS.map((p) => (
                <option key={p.label} value={`${p.width}x${p.height}`}>
                  {p.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Canvas zoom"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-7 px-1.5 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#181b20] text-[11.5px] outline-none cursor-pointer tabular-nums"
            >
              <option value={0.75}>75%</option>
              <option value={1}>100%</option>
              <option value={1.25}>125%</option>
            </select>

            {onImportFromCode && (
              <button
                type="button"
                onClick={onImportFromCode}
                title="Sync elements from App.winui code"
                className="h-7 px-2 rounded-[5px] border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-[11.5px] flex items-center gap-1 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">From Code</span>
              </button>
            )}

            {elements.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  commitElements([], true);
                  setSelectedId(null);
                }}
                className="h-7 px-2 rounded-[5px] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-[11.5px] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Artboard Stage */}
        <div
          tabIndex={0}
          onKeyDown={handleArtboardKeyDown}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
          className="flex-1 min-h-0 overflow-auto p-6 flex items-start justify-center outline-none"
        >
          <div
            style={{
              width: canvas.width * zoom,
              height: canvas.height * zoom,
            }}
            className="relative shrink-0"
          >
            <div
              ref={artboardRef}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-winui-type")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }
              }}
              onDrop={(e) => {
                const typeStr = e.dataTransfer.getData(
                  "application/x-winui-type",
                ) as VisualElementType;
                const found = WINUI_GALLERY_TOOLBOX.find((t) => t.type === typeStr);
                if (!found || !artboardRef.current) return;
                e.preventDefault();
                const rect = artboardRef.current.getBoundingClientRect();
                addElementFromToolbox(found, {
                  x: (e.clientX - rect.left) / zoom,
                  y: (e.clientY - rect.top) / zoom,
                });
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && canvasMode === "design") {
                  setSelectedId(null);
                }
              }}
              style={{
                width: canvas.width,
                height: canvas.height,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                backgroundImage:
                  canvasMode === "design" && canvas.snapGrid
                    ? `radial-gradient(${isDarkSurface ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.11)"} 1px, transparent 1px)`
                    : undefined,
                backgroundSize:
                  canvasMode === "design" && canvas.snapGrid ? "16px 16px" : undefined,
              }}
              className={`relative rounded-[10px] border border-black/15 dark:border-white/15 shadow-[0_14px_40px_rgba(0,0,0,0.14)] overflow-hidden ${surfaceClass}`}
            >
              {canvasMode === "test" ? (
                <WinUIVisualRuntime appName={appName} canvas={canvas} elements={elements} />
              ) : (
                <>
                  {elements.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none opacity-65">
                      <Layers className="w-9 h-9 mb-2.5 text-[#0067b8] dark:text-[#4cc2ff]" />
                      <div className="text-[14px] font-semibold">
                        Click or drag WinUI 3 controls onto the canvas
                      </div>
                      <div className="text-[12px] mt-1 max-w-sm">
                        Move, resize from any corner, double-click labels to edit text, wire up
                        actions, then build into your Start Menu.
                      </div>
                    </div>
                  )}

                  {[...elements]
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map((el) => {
                      const isSelected = el.id === selectedId;
                      const isHidden = el.props.visible === false;
                      const isEditingInline = inlineEditId === el.id;

                      return (
                        <div
                          key={el.id}
                          onPointerDown={(e) => {
                            if (isEditingInline) return;
                            e.stopPropagation();
                            setSelectedId(el.id);
                            artboardRef.current?.parentElement?.parentElement?.focus();
                            interactionRef.current = {
                              mode: "move",
                              id: el.id,
                              startX: e.clientX,
                              startY: e.clientY,
                              origX: el.x,
                              origY: el.y,
                              width: el.width,
                              height: el.height,
                              snapshot: elementsRef.current,
                              moved: false,
                            };
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startInlineEdit(el);
                          }}
                          style={{
                            left: el.x,
                            top: el.y,
                            width: el.width,
                            height: el.height,
                            zIndex: el.zIndex,
                            opacity: isHidden ? 0.3 : (el.props.opacity ?? 100) / 100,
                          }}
                          className={`absolute select-none cursor-move group ${
                            isSelected
                              ? "ring-2 ring-[#0067b8] dark:ring-[#4cc2ff]"
                              : "hover:ring-1 hover:ring-[#0067b8]/55 dark:hover:ring-[#4cc2ff]/55"
                          }`}
                        >
                          {isEditingInline ? (
                            <input
                              autoFocus
                              value={inlineDraft}
                              onChange={(e) => setInlineDraft(e.target.value)}
                              onBlur={() => commitInlineEdit(el)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitInlineEdit(el);
                                if (e.key === "Escape") setInlineEditId(null);
                              }}
                              className="w-full h-full px-2 rounded-[4px] bg-white dark:bg-[#1f2328] text-[#18181b] dark:text-white border border-[#0067b8] outline-none text-[13px]"
                            />
                          ) : (
                            <div className="w-full h-full pointer-events-none">
                              {renderDesignPreview(el, isDarkSurface)}
                            </div>
                          )}

                          {isSelected && !isEditingInline && (
                            <>
                              {/* Coordinate pill */}
                              <div className="absolute -top-6 left-0 px-1.5 py-0.5 rounded-[4px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[10px] font-mono tabular-nums whitespace-nowrap pointer-events-none shadow-xs">
                                {el.x}, {el.y} · {el.width}×{el.height}
                              </div>

                              {/* 8 Resize Handles */}
                              {handles.map((h) => (
                                <div
                                  key={h.dir}
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    interactionRef.current = {
                                      mode: "resize",
                                      id: el.id,
                                      dir: h.dir,
                                      startX: e.clientX,
                                      startY: e.clientY,
                                      origX: el.x,
                                      origY: el.y,
                                      origW: el.width,
                                      origH: el.height,
                                      snapshot: elementsRef.current,
                                      moved: false,
                                    };
                                  }}
                                  style={{ cursor: h.cursor }}
                                  className={`absolute ${h.posClass} size-2.5 rounded-[2px] bg-white border border-[#0067b8] dark:border-[#4cc2ff] shadow-xs z-20`}
                                />
                              ))}
                            </>
                          )}
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: SwiftUI-style Inspector & Layer Tree */}
      <aside className="w-full lg:w-[272px] shrink-0 border-t lg:border-t-0 lg:border-l border-black/[0.08] dark:border-white/[0.08] bg-[#f8f9fb] dark:bg-[#1e2229] flex flex-col max-h-[260px] lg:max-h-none min-h-0 overflow-y-auto">
        {selectedElement ? (
          <div className="p-3 space-y-4">
            {/* Element Header + Quick Actions */}
            <div className="space-y-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.07]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-semibold text-[#0067b8] dark:text-[#4cc2ff]">
                  &lt;{selectedElement.type}&gt;
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => shiftZIndex(1)}
                    title="Bring Forward"
                    className="w-6 h-6 rounded-[4px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftZIndex(-1)}
                    title="Send Backward"
                    className="w-6 h-6 rounded-[4px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    title="Duplicate (Ctrl+D)"
                    className="w-6 h-6 rounded-[4px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    title="Delete"
                    className="w-6 h-6 rounded-[4px] flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <input
                type="text"
                aria-label="Element name"
                value={selectedElement.name}
                onChange={(e) => updateSelectedElement({ name: e.target.value })}
                className="w-full h-7.5 px-2 rounded-[5px] border border-black/12 dark:border-white/12 bg-white dark:bg-[#15181e] text-[12px] font-medium outline-none"
              />
            </div>

            {/* Geometry */}
            <div className="space-y-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.07]">
              <div className="text-[11px] font-semibold opacity-65">Layout & Frame</div>
              <div className="grid grid-cols-2 gap-1.5 text-[11.5px] tabular-nums">
                {(
                  [
                    { label: "X", key: "x", val: selectedElement.x },
                    { label: "Y", key: "y", val: selectedElement.y },
                    { label: "W", key: "width", val: selectedElement.width },
                    { label: "H", key: "height", val: selectedElement.height },
                  ] as const
                ).map((field) => (
                  <label
                    key={field.key}
                    className="h-7 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] flex items-center gap-1.5"
                  >
                    <span className="opacity-50 font-mono w-3">{field.label}</span>
                    <input
                      type="number"
                      value={field.val}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        if (!Number.isFinite(num)) return;
                        updateSelectedElement({
                          [field.key]:
                            field.key === "width"
                              ? Math.max(40, num)
                              : field.key === "height"
                                ? Math.max(16, num)
                                : Math.max(0, num),
                        });
                      }}
                      className="w-full min-w-0 bg-transparent font-mono outline-none text-right"
                    />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11.5px] tabular-nums">
                <label className="h-7 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] flex items-center gap-1.5">
                  <span className="opacity-50">Rad</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={selectedElement.props.radius ?? 6}
                    onChange={(e) => updateSelectedProps({ radius: Number(e.target.value) || 0 })}
                    className="w-full min-w-0 bg-transparent font-mono outline-none text-right"
                  />
                </label>
                <label className="h-7 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] flex items-center gap-1.5">
                  <span className="opacity-50">Op%</span>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={selectedElement.props.opacity ?? 100}
                    onChange={(e) =>
                      updateSelectedProps({
                        opacity: Math.max(10, Math.min(100, Number(e.target.value) || 100)),
                      })
                    }
                    className="w-full min-w-0 bg-transparent font-mono outline-none text-right"
                  />
                </label>
              </div>
              <label className="flex items-center justify-between text-[12px] pt-0.5 cursor-pointer">
                <span>Visible</span>
                <input
                  type="checkbox"
                  checked={selectedElement.props.visible !== false}
                  onChange={(e) => updateSelectedProps({ visible: e.target.checked })}
                  className="accent-[#0067b8] dark:accent-[#4cc2ff]"
                />
              </label>
            </div>

            {/* Control Content & WinUI Properties */}
            <div className="space-y-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.07]">
              <div className="text-[11px] font-semibold opacity-65">WinUI Properties</div>

              {(selectedElement.type === "ToggleSwitch" ||
                selectedElement.type === "Slider" ||
                selectedElement.type === "TextBox" ||
                selectedElement.type === "NumberBox" ||
                selectedElement.type === "ComboBox" ||
                selectedElement.type === "InfoBar" ||
                selectedElement.type === "ProgressBar" ||
                selectedElement.type === "Card" ||
                selectedElement.type === "Expander" ||
                selectedElement.type === "ListView" ||
                selectedElement.type === "RatingControl" ||
                selectedElement.type === "CalendarDatePicker" ||
                selectedElement.type === "ImageCard") && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">Header / Title</label>
                  <input
                    type="text"
                    value={selectedElement.props.header ?? ""}
                    onChange={(e) => updateSelectedProps({ header: e.target.value })}
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  />
                </div>
              )}

              {(selectedElement.type === "Card" ||
                selectedElement.type === "Expander" ||
                selectedElement.type === "ImageCard") && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={selectedElement.props.subtitle ?? ""}
                    onChange={(e) => updateSelectedProps({ subtitle: e.target.value })}
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  />
                </div>
              )}

              {(selectedElement.type === "TextBlock" ||
                selectedElement.type === "Button" ||
                selectedElement.type === "HyperlinkButton" ||
                selectedElement.type === "CheckBox" ||
                selectedElement.type === "TextBox" ||
                selectedElement.type === "InfoBar" ||
                selectedElement.type === "ProgressRing" ||
                selectedElement.type === "Badge" ||
                selectedElement.type === "Card" ||
                selectedElement.type === "Expander" ||
                selectedElement.type === "CalendarDatePicker") && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">Text / Content</label>
                  <input
                    type="text"
                    value={selectedElement.props.text ?? ""}
                    onChange={(e) => updateSelectedProps({ text: e.target.value })}
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  />
                </div>
              )}

              {selectedElement.type === "TextBox" && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={selectedElement.props.placeholder ?? ""}
                    onChange={(e) => updateSelectedProps({ placeholder: e.target.value })}
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  />
                </div>
              )}

              {selectedElement.type === "Button" && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">Button Style</label>
                  <select
                    value={selectedElement.props.styleVariant ?? "Accent"}
                    onChange={(e) =>
                      updateSelectedProps({
                        styleVariant: e.target.value as NonNullable<
                          VisualElementProps["styleVariant"]
                        >,
                      })
                    }
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  >
                    <option value="Accent">Accent</option>
                    <option value="Standard">Standard</option>
                    <option value="Subtle">Subtle</option>
                    <option value="Danger">Danger</option>
                  </select>
                </div>
              )}

              {selectedElement.type === "TextBlock" && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">Typography</label>
                  <select
                    value={selectedElement.props.styleVariant ?? "Body"}
                    onChange={(e) =>
                      updateSelectedProps({
                        styleVariant: e.target.value as NonNullable<
                          VisualElementProps["styleVariant"]
                        >,
                      })
                    }
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  >
                    <option value="Title">Title</option>
                    <option value="Subtitle">Subtitle</option>
                    <option value="Body">Body</option>
                    <option value="Caption">Caption</option>
                  </select>
                </div>
              )}

              {(selectedElement.type === "InfoBar" || selectedElement.type === "Badge") && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">Severity</label>
                  <select
                    value={selectedElement.props.severity ?? "info"}
                    onChange={(e) =>
                      updateSelectedProps({
                        severity: e.target.value as NonNullable<VisualElementProps["severity"]>,
                      })
                    }
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  >
                    <option value="info">Informational</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              )}

              {(selectedElement.type === "Slider" ||
                selectedElement.type === "NumberBox" ||
                selectedElement.type === "ProgressBar" ||
                selectedElement.type === "RatingControl") && (
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <label>
                    <span className="block opacity-60 mb-0.5">Min</span>
                    <input
                      type="number"
                      value={selectedElement.props.min ?? 0}
                      onChange={(e) => updateSelectedProps({ min: Number(e.target.value) || 0 })}
                      className="w-full h-7 px-1.5 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] font-mono outline-none"
                    />
                  </label>
                  <label>
                    <span className="block opacity-60 mb-0.5">Value</span>
                    <input
                      type="number"
                      value={selectedElement.props.value ?? 0}
                      onChange={(e) => updateSelectedProps({ value: Number(e.target.value) || 0 })}
                      className="w-full h-7 px-1.5 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] font-mono outline-none"
                    />
                  </label>
                  <label>
                    <span className="block opacity-60 mb-0.5">Max</span>
                    <input
                      type="number"
                      value={selectedElement.props.max ?? 100}
                      onChange={(e) => updateSelectedProps({ max: Number(e.target.value) || 100 })}
                      className="w-full h-7 px-1.5 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] font-mono outline-none"
                    />
                  </label>
                </div>
              )}

              {(selectedElement.type === "ComboBox" || selectedElement.type === "ListView") && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">
                    Items (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={selectedElement.props.items ?? ""}
                    onChange={(e) => updateSelectedProps({ items: e.target.value })}
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  />
                </div>
              )}

              {selectedElement.type === "ImageCard" && (
                <div>
                  <label className="block text-[11px] opacity-60 mb-1">Accent Color</label>
                  <input
                    type="color"
                    value={selectedElement.props.accentColor ?? "#0067b8"}
                    onChange={(e) => updateSelectedProps({ accentColor: e.target.value })}
                    className="w-full h-7 rounded-[5px] border border-black/10 dark:border-white/10 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* No-Code Action Builder */}
            {INTERACTIVE_TYPES.has(selectedElement.type) && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold opacity-65">Visual Action</div>
                <select
                  value={selectedElement.action?.kind ?? "none"}
                  onChange={(e) => {
                    const kind = e.target.value as VisualActionKind;
                    updateSelectedElement(
                      {
                        action: {
                          ...(selectedElement.action ?? {}),
                          kind,
                        },
                      },
                      true,
                    );
                  }}
                  className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                >
                  <option value="none">None</option>
                  <option value="toast">Show Toast Notification</option>
                  <option value="set-text">Update Element Text</option>
                  <option value="increment">Increment Element Value</option>
                  <option value="toggle-visibility">Toggle Element Visibility</option>
                  <option value="reset">Reset All Inputs</option>
                  <option value="handler">Call App.logic.js Handler</option>
                </select>

                {selectedElement.action?.kind === "toast" && (
                  <input
                    type="text"
                    placeholder="Toast message..."
                    value={selectedElement.action.message ?? ""}
                    onChange={(e) =>
                      updateSelectedElement({
                        action: { kind: "toast", message: e.target.value },
                      })
                    }
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  />
                )}

                {(selectedElement.action?.kind === "set-text" ||
                  selectedElement.action?.kind === "increment" ||
                  selectedElement.action?.kind === "toggle-visibility") && (
                  <select
                    value={selectedElement.action.targetElementId ?? ""}
                    onChange={(e) =>
                      updateSelectedElement({
                        action: {
                          ...(selectedElement.action ?? { kind: "set-text" }),
                          targetElementId: e.target.value,
                        },
                      })
                    }
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  >
                    <option value="">Select target element...</option>
                    {elements.map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.name}
                      </option>
                    ))}
                  </select>
                )}

                {(selectedElement.action?.kind === "set-text" ||
                  selectedElement.action?.kind === "increment") && (
                  <input
                    type="text"
                    placeholder={
                      selectedElement.action.kind === "increment" ? "Delta (e.g. 1)" : "New text..."
                    }
                    value={selectedElement.action.value ?? ""}
                    onChange={(e) =>
                      updateSelectedElement({
                        action: {
                          ...(selectedElement.action ?? { kind: "set-text" }),
                          value: e.target.value,
                        },
                      })
                    }
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none"
                  />
                )}

                {selectedElement.action?.kind === "handler" && (
                  <select
                    value={selectedElement.action.handlerName ?? ""}
                    onChange={(e) =>
                      updateSelectedElement({
                        action: { kind: "handler", handlerName: e.target.value },
                      })
                    }
                    className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] font-mono outline-none"
                  >
                    <option value="">Select handler...</option>
                    {handlerNames.map((fnName) => (
                      <option key={fnName} value={fnName}>
                        {fnName}()
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-4">
            <div className="space-y-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.07]">
              <div className="text-[12px] font-semibold">Canvas Surface</div>
              <select
                aria-label="Canvas surface theme"
                value={canvas.surface}
                onChange={(e) =>
                  onChange(
                    {
                      ...canvas,
                      surface: e.target.value as VisualCanvasConfig["surface"],
                    },
                    elements,
                  )
                }
                className="w-full h-7.5 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] text-[12px] outline-none cursor-pointer"
              >
                <option value="mica">Windows 11 Mica</option>
                <option value="light">Light Crisp</option>
                <option value="dark">Dark Slate</option>
                <option value="slate">Deep Midnight</option>
                <option value="ocean">Fluent Ocean Gradient</option>
              </select>
              <div className="grid grid-cols-2 gap-1.5 text-[11.5px] tabular-nums">
                <label className="h-7 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] flex items-center gap-1.5">
                  <span className="opacity-50">W</span>
                  <input
                    type="number"
                    min={320}
                    max={1440}
                    value={canvas.width}
                    onChange={(e) =>
                      onChange(
                        { ...canvas, width: Math.max(320, Number(e.target.value) || 840) },
                        elements,
                      )
                    }
                    className="w-full min-w-0 bg-transparent font-mono outline-none text-right"
                  />
                </label>
                <label className="h-7 px-2 rounded-[5px] border border-black/10 dark:border-white/10 bg-white dark:bg-[#15181e] flex items-center gap-1.5">
                  <span className="opacity-50">H</span>
                  <input
                    type="number"
                    min={240}
                    max={1200}
                    value={canvas.height}
                    onChange={(e) =>
                      onChange(
                        { ...canvas, height: Math.max(240, Number(e.target.value) || 540) },
                        elements,
                      )
                    }
                    className="w-full min-w-0 bg-transparent font-mono outline-none text-right"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px] font-semibold">
                <span>Layers</span>
                <span className="font-mono text-[11px] tabular-nums opacity-55">
                  {elements.length}
                </span>
              </div>
              {sortedLayers.length === 0 ? (
                <div className="text-[11.5px] opacity-55 py-2">
                  Add controls from the left gallery to build your UI visually.
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedLayers.map((el) => (
                    <div
                      key={el.id}
                      onClick={() => setSelectedId(el.id)}
                      className="h-7.5 px-2 rounded-[5px] border border-black/[0.06] dark:border-white/[0.06] bg-white/75 dark:bg-white/[0.04] hover:border-[#0067b8]/50 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="text-[11.5px] truncate">{el.name}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = elements.map((item) =>
                              item.id === el.id
                                ? {
                                    ...item,
                                    props: {
                                      ...item.props,
                                      visible: item.props.visible === false,
                                    },
                                  }
                                : item,
                            );
                            commitElements(next, true);
                          }}
                          aria-label={`Toggle ${el.name} visibility`}
                          className="w-5 h-5 rounded flex items-center justify-center opacity-60 hover:opacity-100 cursor-pointer"
                        >
                          {el.props.visible === false ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
