import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import type {
  VisualAction,
  VisualCanvasConfig,
  VisualElement,
} from "../services/installedWinUIAppsStore";
import { showAppToast } from "../utils/toast";

interface ListItemEntry {
  id: string;
  label: string;
  done: boolean;
}

interface WinUIVisualRuntimeProps {
  appName: string;
  canvas: VisualCanvasConfig;
  elements: VisualElement[];
  onRunHandler?: (handlerName: string, element: VisualElement) => void;
  onLog?: (msg: string) => void;
  fillContainer?: boolean;
}

function buildInitialMaps(elements: VisualElement[]) {
  const textById: Record<string, string> = {};
  const numById: Record<string, number> = {};
  const boolById: Record<string, boolean> = {};
  const selectedById: Record<string, string> = {};
  const visibleById: Record<string, boolean> = {};
  const expandedById: Record<string, boolean> = {};
  const listItemsById: Record<string, ListItemEntry[]> = {};

  for (const el of elements) {
    const p = el.props;
    textById[el.id] = p.text ?? "";
    numById[el.id] = typeof p.value === "number" ? p.value : 0;
    boolById[el.id] =
      el.type === "CheckBox" ? Boolean(p.isChecked) : p.isOn !== undefined ? Boolean(p.isOn) : true;
    selectedById[el.id] = p.selected ?? "";
    visibleById[el.id] = p.visible !== false;
    expandedById[el.id] = p.isExpanded !== false;

    if (el.type === "ListView") {
      const rawItems = (p.items ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      listItemsById[el.id] = rawItems.map((label, idx) => ({
        id: `${el.id}-item-${idx}`,
        label,
        done: false,
      }));
    }
  }

  return {
    textById,
    numById,
    boolById,
    selectedById,
    visibleById,
    expandedById,
    listItemsById,
  };
}

export function getVisualCanvasSurfaceClass(surface: VisualCanvasConfig["surface"]): string {
  switch (surface) {
    case "light":
      return "bg-[#f8f9fb] text-[#18181b]";
    case "dark":
      return "bg-[#1b1f25] text-[#f4f4f5]";
    case "slate":
      return "bg-gradient-to-br from-[#1f2937] via-[#18212f] to-[#0f172a] text-[#f4f4f5]";
    case "ocean":
      return "bg-gradient-to-br from-[#e0f2fe] via-[#eff6ff] to-[#e0e7ff] dark:from-[#0c2238] dark:via-[#111c33] dark:to-[#171836] text-[#18181b] dark:text-[#f4f4f5]";
    case "mica":
    default:
      return "bg-white/90 dark:bg-[#23272e]/95 text-[#18181b] dark:text-[#f4f4f5]";
  }
}

export const WinUIVisualRuntime: React.FC<WinUIVisualRuntimeProps> = ({
  appName,
  canvas,
  elements,
  onRunHandler,
  onLog,
  fillContainer = false,
}) => {
  const initialMaps = useMemo(() => buildInitialMaps(elements), [elements]);

  const [textById, setTextById] = useState<Record<string, string>>(initialMaps.textById);
  const [numById, setNumById] = useState<Record<string, number>>(initialMaps.numById);
  const [boolById, setBoolById] = useState<Record<string, boolean>>(initialMaps.boolById);
  const [selectedById, setSelectedById] = useState<Record<string, string>>(
    initialMaps.selectedById,
  );
  const [visibleById, setVisibleById] = useState<Record<string, boolean>>(initialMaps.visibleById);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>(
    initialMaps.expandedById,
  );
  const [listItemsById, setListItemsById] = useState<Record<string, ListItemEntry[]>>(
    initialMaps.listItemsById,
  );
  const [listDraftById, setListDraftById] = useState<Record<string, string>>({});

  useEffect(() => {
    setTextById(initialMaps.textById);
    setNumById(initialMaps.numById);
    setBoolById(initialMaps.boolById);
    setSelectedById(initialMaps.selectedById);
    setVisibleById(initialMaps.visibleById);
    setExpandedById(initialMaps.expandedById);
    setListItemsById(initialMaps.listItemsById);
  }, [initialMaps]);

  const executeAction = (action: VisualAction | undefined, sourceEl: VisualElement) => {
    if (!action || action.kind === "none") return;

    if (action.kind === "toast") {
      const msg = action.message?.trim() || `${sourceEl.props.text || sourceEl.name} activated`;
      showAppToast(msg, { appName });
      onLog?.(`[Toast] ${msg}`);
      return;
    }

    if (action.kind === "set-text") {
      const targetId = action.targetElementId || sourceEl.id;
      const nextText = action.value ?? action.message ?? "";
      setTextById((prev) => ({ ...prev, [targetId]: nextText }));
      onLog?.(`[SetText] ${targetId} -> "${nextText}"`);
      return;
    }

    if (action.kind === "increment") {
      const targetId = action.targetElementId;
      const delta = Number(action.value ?? "1") || 1;
      if (targetId) {
        const targetEl = elements.find((e) => e.id === targetId);
        if (targetEl && (targetEl.type === "TextBlock" || targetEl.type === "Badge")) {
          const curStr = textById[targetId] ?? targetEl.props.text ?? "0";
          const match = curStr.match(/-?\d+(\.\d+)?/);
          const baseNum = match ? Number(match[0]) : 0;
          const nextNum = baseNum + delta;
          const updated = match ? curStr.replace(match[0], String(nextNum)) : String(nextNum);
          setTextById((prev) => ({ ...prev, [targetId]: updated }));
        } else {
          setNumById((prev) => {
            const cur = prev[targetId] ?? targetEl?.props.value ?? 0;
            const maxVal = targetEl?.props.max ?? 99999;
            const minVal = targetEl?.props.min ?? -99999;
            return {
              ...prev,
              [targetId]: Math.max(minVal, Math.min(maxVal, cur + delta)),
            };
          });
        }
        onLog?.(`[Increment] ${targetId} by ${delta}`);
      }
      return;
    }

    if (action.kind === "toggle-visibility") {
      const targetId = action.targetElementId;
      if (targetId) {
        setVisibleById((prev) => ({ ...prev, [targetId]: prev[targetId] === false }));
        onLog?.(`[ToggleVisibility] ${targetId}`);
      }
      return;
    }

    if (action.kind === "reset") {
      const fresh = buildInitialMaps(elements);
      setTextById(fresh.textById);
      setNumById(fresh.numById);
      setBoolById(fresh.boolById);
      setSelectedById(fresh.selectedById);
      setVisibleById(fresh.visibleById);
      setExpandedById(fresh.expandedById);
      setListItemsById(fresh.listItemsById);
      setListDraftById({});
      onLog?.("[Reset] Restored initial visual state");
      return;
    }

    if (action.kind === "handler" && action.handlerName) {
      if (onRunHandler) {
        onRunHandler(action.handlerName, sourceEl);
      } else {
        showAppToast(`Ran handler "${action.handlerName}"`, { appName });
      }
      onLog?.(`[Handler] ${action.handlerName}`);
    }
  };

  const sortedElements = useMemo(
    () => [...elements].sort((a, b) => a.zIndex - b.zIndex),
    [elements],
  );

  const isDarkSurface = canvas.surface === "dark" || canvas.surface === "slate";
  const surfaceClass = getVisualCanvasSurfaceClass(canvas.surface);

  const renderElement = (el: VisualElement) => {
    const isVisible = visibleById[el.id] !== false;
    if (!isVisible) return null;

    const p = el.props;
    const radius = p.radius ?? 6;
    const opacity = (p.opacity ?? 100) / 100;
    const currentText = textById[el.id] ?? p.text ?? "";
    const currentNum = numById[el.id] ?? p.value ?? 0;
    const currentBool = boolById[el.id] ?? false;
    const currentSelected = selectedById[el.id] ?? p.selected ?? "";
    const cardBg = isDarkSurface
      ? "bg-white/[0.06] border-white/[0.1]"
      : "bg-white/80 dark:bg-white/[0.06] border-black/[0.09] dark:border-white/[0.1]";

    const wrapperStyle: React.CSSProperties = {
      left: el.x,
      top: el.y,
      width: el.width,
      height: el.height,
      zIndex: el.zIndex,
      opacity,
      borderRadius: `${radius}px`,
    };

    let content: React.ReactNode = null;

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
        content = (
          <div className={`w-full h-full flex items-center px-1 leading-snug ${typCls}`}>
            <span className="truncate w-full">{currentText || el.name}</span>
          </div>
        );
        break;
      }

      case "Button": {
        const variant = p.styleVariant ?? "Accent";
        const btnCls =
          variant === "Accent"
            ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent font-semibold hover:brightness-105"
            : variant === "Danger"
              ? "bg-rose-600 text-white border-transparent font-semibold hover:bg-rose-700"
              : variant === "Subtle"
                ? "bg-transparent border-transparent hover:bg-black/[0.06] dark:hover:bg-white/[0.08] font-medium"
                : "bg-white/90 dark:bg-white/[0.09] border-black/15 dark:border-white/15 hover:bg-black/[0.04] dark:hover:bg-white/[0.14] font-medium shadow-2xs";
        content = (
          <button
            type="button"
            onClick={() => executeAction(el.action, el)}
            style={{ borderRadius: `${radius}px` }}
            className={`w-full h-full px-3 border text-[13px] transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center truncate ${btnCls}`}
          >
            {currentText || "Button"}
          </button>
        );
        break;
      }

      case "HyperlinkButton": {
        content = (
          <button
            type="button"
            onClick={() => executeAction(el.action, el)}
            style={{ borderRadius: `${radius}px` }}
            className="w-full h-full px-2 text-[13px] font-medium text-[#0067b8] dark:text-[#4cc2ff] hover:underline hover:bg-[#0067b8]/[0.07] dark:hover:bg-[#4cc2ff]/10 cursor-pointer flex items-center justify-start truncate"
          >
            {currentText || "HyperlinkButton"}
          </button>
        );
        break;
      }

      case "ToggleSwitch": {
        content = (
          <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
            {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={currentBool}
                onClick={() => {
                  setBoolById((prev) => ({ ...prev, [el.id]: !currentBool }));
                  executeAction(el.action, el);
                }}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 border ${
                  currentBool
                    ? "bg-[#0067b8] dark:bg-[#4cc2ff] border-transparent"
                    : "bg-black/15 dark:bg-white/15 border-black/25 dark:border-white/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-3.5 rounded-full transition-all ${
                    currentBool
                      ? "left-[21px] bg-white dark:bg-black"
                      : "left-0.5 bg-black/70 dark:bg-white/80"
                  }`}
                />
              </button>
              <span className="text-[12.5px] opacity-80">{currentBool ? "On" : "Off"}</span>
            </div>
          </div>
        );
        break;
      }

      case "CheckBox": {
        content = (
          <button
            type="button"
            onClick={() => {
              setBoolById((prev) => ({ ...prev, [el.id]: !currentBool }));
              executeAction(el.action, el);
            }}
            className="w-full h-full px-1 flex items-center gap-2.5 text-left cursor-pointer"
          >
            <span
              className={`size-4.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
                currentBool
                  ? "bg-[#0067b8] dark:bg-[#4cc2ff] border-transparent text-white dark:text-black"
                  : "border-black/35 dark:border-white/35 bg-transparent"
              }`}
            >
              {currentBool && <Check className="w-3 h-3 stroke-[2.7]" />}
            </span>
            <span className="text-[13px] truncate">{currentText || "CheckBox"}</span>
          </button>
        );
        break;
      }

      case "Slider": {
        const min = p.min ?? 0;
        const max = p.max ?? 100;
        content = (
          <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
            <div className="flex items-center justify-between text-[12px] gap-2">
              <span className="font-medium truncate">{p.header ?? "Slider"}</span>
              <span className="font-mono tabular-nums opacity-70">{currentNum}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={currentNum}
              onChange={(e) => setNumById((prev) => ({ ...prev, [el.id]: Number(e.target.value) }))}
              className="w-full accent-[#0067b8] dark:accent-[#4cc2ff] cursor-pointer"
            />
          </div>
        );
        break;
      }

      case "TextBox": {
        content = (
          <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
            {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
            <input
              type="text"
              value={currentText}
              placeholder={p.placeholder ?? "Type here..."}
              onChange={(e) => setTextById((prev) => ({ ...prev, [el.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") executeAction(el.action, el);
              }}
              style={{ borderRadius: `${radius}px` }}
              className={`h-8.5 px-2.5 border border-b-2 text-[12.5px] outline-none transition-colors ${
                isDarkSurface
                  ? "bg-white/[0.06] border-white/15 border-b-white/30 text-white focus:border-b-[#4cc2ff]"
                  : "bg-white dark:bg-[#1f2328] border-black/15 dark:border-white/15 border-b-black/30 dark:border-b-white/30 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
              }`}
            />
          </div>
        );
        break;
      }

      case "NumberBox": {
        const min = p.min ?? 0;
        const max = p.max ?? 9999;
        content = (
          <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
            {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
            <div
              style={{ borderRadius: `${radius}px` }}
              className={`h-8.5 flex items-center border overflow-hidden ${
                isDarkSurface
                  ? "bg-white/[0.06] border-white/15"
                  : "bg-white dark:bg-[#1f2328] border-black/15 dark:border-white/15"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setNumById((prev) => ({ ...prev, [el.id]: Math.max(min, currentNum - 1) }))
                }
                className="w-8 h-full flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer text-[14px]"
              >
                -
              </button>
              <input
                type="number"
                value={currentNum}
                min={min}
                max={max}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) {
                    setNumById((prev) => ({
                      ...prev,
                      [el.id]: Math.max(min, Math.min(max, v)),
                    }));
                  }
                }}
                className="flex-1 min-w-0 bg-transparent text-center font-mono tabular-nums text-[12.5px] outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setNumById((prev) => ({ ...prev, [el.id]: Math.min(max, currentNum + 1) }))
                }
                className="w-8 h-full flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer text-[14px]"
              >
                +
              </button>
            </div>
          </div>
        );
        break;
      }

      case "ComboBox": {
        const options = (p.items ?? "Option 1,Option 2,Option 3")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        content = (
          <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
            {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
            <select
              value={currentSelected || options[0] || ""}
              onChange={(e) => {
                setSelectedById((prev) => ({ ...prev, [el.id]: e.target.value }));
                executeAction(el.action, el);
              }}
              style={{ borderRadius: `${radius}px` }}
              className={`h-8.5 px-2.5 border text-[12.5px] outline-none cursor-pointer ${
                isDarkSurface
                  ? "bg-[#242830] border-white/15 text-white"
                  : "bg-white dark:bg-[#1f2328] border-black/15 dark:border-white/15"
              }`}
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
        break;
      }

      case "RatingControl": {
        const maxStars = Math.max(3, Math.min(5, p.max ?? 5));
        content = (
          <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
            {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
            <div className="flex items-center gap-1">
              {Array.from({ length: maxStars }, (_, idx) => {
                const starVal = idx + 1;
                const filled = starVal <= currentNum;
                return (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => {
                      setNumById((prev) => ({ ...prev, [el.id]: starVal }));
                      executeAction(el.action, el);
                    }}
                    className="p-0.5 cursor-pointer hover:scale-110 transition-transform"
                    aria-label={`${starVal} stars`}
                  >
                    <Star
                      className={`w-4.5 h-4.5 ${
                        filled
                          ? "fill-[#0067b8] text-[#0067b8] dark:fill-[#4cc2ff] dark:text-[#4cc2ff]"
                          : "text-black/30 dark:text-white/30"
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-1.5 text-[11.5px] font-mono tabular-nums opacity-65">
                {currentNum}/{maxStars}
              </span>
            </div>
          </div>
        );
        break;
      }

      case "CalendarDatePicker": {
        content = (
          <div className="w-full h-full flex flex-col justify-center gap-1 px-1">
            {p.header && <span className="text-[12px] font-medium truncate">{p.header}</span>}
            <div
              style={{ borderRadius: `${radius}px` }}
              className={`h-8.5 px-2.5 border flex items-center gap-2 ${
                isDarkSurface
                  ? "bg-white/[0.06] border-white/15"
                  : "bg-white dark:bg-[#1f2328] border-black/15 dark:border-white/15"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 opacity-60 shrink-0" />
              <input
                type="date"
                value={currentText || "2026-11-24"}
                onChange={(e) => setTextById((prev) => ({ ...prev, [el.id]: e.target.value }))}
                className="flex-1 min-w-0 bg-transparent text-[12.5px] outline-none font-mono"
              />
            </div>
          </div>
        );
        break;
      }

      case "InfoBar": {
        const sev = p.severity ?? "info";
        const sevStyles =
          sev === "success"
            ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            : sev === "warning"
              ? "bg-amber-500/12 border-amber-500/30 text-amber-800 dark:text-amber-300"
              : sev === "error"
                ? "bg-rose-500/12 border-rose-500/30 text-rose-700 dark:text-rose-300"
                : "bg-[#0067b8]/10 dark:bg-[#4cc2ff]/12 border-[#0067b8]/25 dark:border-[#4cc2ff]/30 text-[#005192] dark:text-[#7dd3fc]";
        const Icon =
          sev === "success"
            ? CheckCircle2
            : sev === "warning"
              ? AlertTriangle
              : sev === "error"
                ? AlertCircle
                : Info;
        content = (
          <div
            style={{ borderRadius: `${radius}px` }}
            className={`w-full h-full px-3.5 py-2.5 border flex items-start gap-2.5 overflow-hidden ${sevStyles}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              {p.header && <div className="text-[12.5px] font-semibold truncate">{p.header}</div>}
              {currentText && (
                <div className="text-[12px] opacity-90 line-clamp-2">{currentText}</div>
              )}
            </div>
          </div>
        );
        break;
      }

      case "ProgressBar": {
        const max = Math.max(1, p.max ?? 100);
        const pct = Math.max(0, Math.min(100, (currentNum / max) * 100));
        content = (
          <div className="w-full h-full flex flex-col justify-center gap-1.5 px-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium truncate">{p.header ?? "Progress"}</span>
              <span className="font-mono tabular-nums opacity-70">{Math.round(pct)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
              <div
                style={{ width: `${pct}%` }}
                className="h-full rounded-full bg-[#0067b8] dark:bg-[#4cc2ff] transition-[width] duration-200"
              />
            </div>
          </div>
        );
        break;
      }

      case "ProgressRing": {
        const active = currentBool;
        content = (
          <div className="w-full h-full px-2 flex items-center gap-3">
            <span
              className={`size-6 rounded-full border-[2.5px] border-[#0067b8]/20 dark:border-[#4cc2ff]/20 border-t-[#0067b8] dark:border-t-[#4cc2ff] shrink-0 ${
                active ? "animate-spin" : "opacity-40"
              }`}
            />
            <span className="text-[12.5px] font-medium truncate opacity-85">
              {currentText || "Syncing..."}
            </span>
          </div>
        );
        break;
      }

      case "Badge": {
        const sev = p.severity ?? "info";
        const cls =
          sev === "success"
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
            : sev === "warning"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25"
              : sev === "error"
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25"
                : "bg-[#0067b8]/12 text-[#0067b8] dark:bg-[#4cc2ff]/15 dark:text-[#4cc2ff] border-[#0067b8]/20";
        content = (
          <div
            style={{ borderRadius: `${radius}px` }}
            className={`w-full h-full px-2.5 border flex items-center justify-center text-[11.5px] font-semibold truncate ${cls}`}
          >
            {currentText || "Badge"}
          </div>
        );
        break;
      }

      case "Card": {
        content = (
          <div
            style={{ borderRadius: `${radius}px` }}
            className={`w-full h-full border p-3.5 flex flex-col gap-1 overflow-hidden ${cardBg}`}
          >
            {p.header && <div className="text-[13.5px] font-semibold truncate">{p.header}</div>}
            {p.subtitle && <div className="text-[11.5px] opacity-60 truncate">{p.subtitle}</div>}
            {currentText && (
              <div className="text-[12.5px] opacity-85 mt-1 leading-relaxed overflow-hidden">
                {currentText}
              </div>
            )}
          </div>
        );
        break;
      }

      case "Expander": {
        const expanded = expandedById[el.id] !== false;
        content = (
          <div
            style={{ borderRadius: `${radius}px` }}
            className={`w-full h-full border overflow-hidden flex flex-col ${cardBg}`}
          >
            <button
              type="button"
              onClick={() => setExpandedById((prev) => ({ ...prev, [el.id]: !expanded }))}
              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer text-left shrink-0"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold truncate">{p.header ?? "Expander"}</div>
                {p.subtitle && <div className="text-[11px] opacity-60 truncate">{p.subtitle}</div>}
              </div>
              <ChevronDown
                className={`w-4 h-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
            {expanded && (
              <div className="flex-1 min-h-0 px-3.5 py-2.5 border-t border-black/[0.06] dark:border-white/[0.08] text-[12px] opacity-85 overflow-auto">
                {currentText || "Expanded content area"}
              </div>
            )}
          </div>
        );
        break;
      }

      case "ListView": {
        const items = listItemsById[el.id] ?? [];
        const draft = listDraftById[el.id] ?? "";
        const addListItem = () => {
          const clean = draft.trim();
          if (!clean) return;
          setListItemsById((prev) => ({
            ...prev,
            [el.id]: [
              ...(prev[el.id] ?? []),
              { id: `${el.id}-${Date.now()}`, label: clean, done: false },
            ],
          }));
          setListDraftById((prev) => ({ ...prev, [el.id]: "" }));
        };
        content = (
          <div
            style={{ borderRadius: `${radius}px` }}
            className={`w-full h-full border flex flex-col overflow-hidden ${cardBg}`}
          >
            <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
              <span className="text-[12.5px] font-semibold truncate">{p.header ?? "Items"}</span>
              <span className="text-[11px] font-mono tabular-nums opacity-60">{items.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {items.length === 0 ? (
                <div className="p-3 text-[12px] opacity-55">No items yet</div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setListItemsById((prev) => ({
                        ...prev,
                        [el.id]: (prev[el.id] ?? []).map((entry) =>
                          entry.id === item.id ? { ...entry, done: !entry.done } : entry,
                        ),
                      }));
                      executeAction(el.action, el);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-left text-[12.5px] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer"
                  >
                    <span
                      className={`size-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                        item.done
                          ? "bg-[#0067b8] dark:bg-[#4cc2ff] border-transparent text-white dark:text-black"
                          : "border-black/25 dark:border-white/30"
                      }`}
                    >
                      {item.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                    <span className={`truncate ${item.done ? "line-through opacity-55" : ""}`}>
                      {item.label}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="p-1.5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1 shrink-0">
              <input
                type="text"
                value={draft}
                onChange={(e) => setListDraftById((prev) => ({ ...prev, [el.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addListItem();
                }}
                placeholder="Add item..."
                className="flex-1 min-w-0 h-7 px-2 rounded-[4px] bg-black/[0.04] dark:bg-white/[0.06] text-[11.5px] outline-none"
              />
              <button
                type="button"
                onClick={addListItem}
                aria-label="Add list item"
                className="w-7 h-7 rounded-[4px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black flex items-center justify-center cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
        break;
      }

      case "ImageCard": {
        const accent = p.accentColor || "#0067b8";
        content = (
          <div
            style={{
              borderRadius: `${radius}px`,
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 45%, #090d16))`,
            }}
            className="w-full h-full p-4 text-white flex flex-col justify-between relative overflow-hidden shadow-sm"
          >
            <span
              aria-hidden="true"
              className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/15 blur-xl pointer-events-none"
            />
            <div className="w-8 h-8 rounded-[7px] bg-white/15 backdrop-blur-md flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold truncate">
                {p.header ?? "Featured Tile"}
              </div>
              {p.subtitle && (
                <div className="text-[11.5px] text-white/80 truncate">{p.subtitle}</div>
              )}
            </div>
          </div>
        );
        break;
      }

      case "Divider": {
        content = (
          <div className="w-full h-full flex items-center">
            <div className="w-full h-px bg-black/12 dark:bg-white/15" />
          </div>
        );
        break;
      }
    }

    return (
      <div key={el.id} style={wrapperStyle} className="absolute">
        {content}
      </div>
    );
  };

  if (fillContainer) {
    return (
      <div
        className={`w-full h-full overflow-auto ${surfaceClass} flex items-start justify-center p-4`}
      >
        <div
          style={{ width: `${canvas.width}px`, minHeight: `${canvas.height}px` }}
          className="relative shrink-0"
        >
          {sortedElements.length === 0 ? (
            <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6 opacity-60">
              <div className="text-[14px] font-semibold">{appName}</div>
              <div className="text-[12px] mt-1">
                No visual elements were placed on the canvas yet.
              </div>
            </div>
          ) : (
            sortedElements.map(renderElement)
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ width: `${canvas.width}px`, height: `${canvas.height}px` }}
      className={`relative overflow-hidden ${surfaceClass}`}
    >
      {sortedElements.map(renderElement)}
    </div>
  );
};
