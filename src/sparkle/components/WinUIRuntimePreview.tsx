import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Home,
  Info,
  Layers,
  Menu,
  Monitor,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  resolveBindingExpression,
  type BuildResult,
  type WinUINode,
} from "../utils/winuiFrameworkEngine";

interface WinUIRuntimePreviewProps {
  build: BuildResult;
  state: Record<string, unknown>;
  onUpdateState: (
    patch: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>),
  ) => void;
  onLog: (msg: string) => void;
  themeOverride?: "inherit" | "light" | "dark";
}

function getNavIcon(name?: string) {
  const key = (name || "").toLowerCase();
  if (key.includes("home")) return <Home className="w-4 h-4 shrink-0" />;
  if (key.includes("setting")) return <Settings className="w-4 h-4 shrink-0" />;
  if (key.includes("check")) return <Check className="w-4 h-4 shrink-0" />;
  if (key.includes("slider")) return <SlidersHorizontal className="w-4 h-4 shrink-0" />;
  if (key.includes("monitor")) return <Monitor className="w-4 h-4 shrink-0" />;
  if (key.includes("shield")) return <Shield className="w-4 h-4 shrink-0" />;
  if (key.includes("sparkle")) return <Sparkles className="w-4 h-4 shrink-0" />;
  return <Layers className="w-4 h-4 shrink-0" />;
}

function asString(val: unknown): string {
  if (val === undefined || val === null) return "";
  return String(val);
}

function asBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.toLowerCase() === "true";
  return Boolean(val);
}

function asNumber(val: unknown, fallback = 0): number {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export const WinUIRuntimePreview: React.FC<WinUIRuntimePreviewProps> = ({
  build,
  state,
  onUpdateState,
  onLog,
  themeOverride = "inherit",
}) => {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [localNavTag, setLocalNavTag] = useState<string>("");
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const invoke = (handlerName: string | undefined, payload?: unknown) => {
    if (!handlerName) return;
    const fn = build.handlers[handlerName.trim()];
    if (!fn) {
      onLog(`Warning: Handler "${handlerName}" is not defined in App.logic.js`);
      return;
    }
    try {
      fn(state, onUpdateState, onLog, payload);
    } catch (err) {
      onLog(`Runtime error in ${handlerName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const resolveProp = (raw: string | undefined): unknown => {
    if (raw === undefined) return undefined;
    return resolveBindingExpression(raw, state);
  };

  const renderNode = (node: WinUINode, keyPath: string): React.ReactNode => {
    const p = node.props;
    const prop = (name: string): string | undefined => p[name];

    if (node.tag === "Page") {
      return (
        <div key={keyPath} className="w-full h-full flex flex-col">
          {node.children.map((c, idx) => renderNode(c, `${keyPath}-${idx}`))}
        </div>
      );
    }

    if (node.tag === "NavigationView") {
      const navItems = node.children.filter((c) => c.tag === "NavigationViewItem");
      const contentChildren = node.children.filter((c) => c.tag !== "NavigationViewItem");
      const boundTag = asString(resolveProp(prop("SelectedTag")));
      const activeTag = boundTag || localNavTag || (navItems[0]?.props["Tag"] ?? "");
      const navTitle = asString(resolveProp(prop("Title"))) || build.manifest.name;

      return (
        <div key={keyPath} className="w-full h-full flex min-h-[320px] overflow-hidden">
          <aside
            className={`shrink-0 flex flex-col border-r border-black/[0.07] dark:border-white/[0.08] bg-[#eeeeee]/80 dark:bg-[#1c1f24]/90 transition-[width] duration-150 ${
              navCollapsed ? "w-12" : "w-48"
            }`}
          >
            <div
              className={`h-11 px-2 flex items-center ${
                navCollapsed ? "justify-center" : "gap-2"
              } shrink-0`}
            >
              <button
                type="button"
                onClick={() => setNavCollapsed((v) => !v)}
                aria-label="Toggle app navigation"
                className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer"
              >
                <Menu className="w-4 h-4" />
              </button>
              {!navCollapsed && (
                <span className="text-[13px] font-semibold truncate">{navTitle}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
              {navItems.map((item, idx) => {
                const tagVal = asString(resolveProp(item.props["Tag"])) || `nav-${idx}`;
                const label = asString(resolveProp(item.props["Label"])) || tagVal;
                const isSelected = activeTag === tagVal;
                return (
                  <button
                    key={`${keyPath}-nav-${idx}`}
                    type="button"
                    onClick={() => {
                      setLocalNavTag(tagVal);
                      invoke(prop("OnSelectTag"), tagVal);
                    }}
                    title={navCollapsed ? label : undefined}
                    className={`relative w-full h-8 rounded-[6px] flex items-center ${
                      navCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                    } text-[12.5px] transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-black/[0.07] dark:bg-white/[0.1] font-semibold"
                        : "opacity-80 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[14px] rounded-full bg-[#0067b8] dark:bg-[#4cc2ff]" />
                    )}
                    {getNavIcon(item.props["Icon"] || label)}
                    {!navCollapsed && <span className="truncate">{label}</span>}
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="flex-1 min-w-0 overflow-y-auto">
            {contentChildren.map((c, idx) => renderNode(c, `${keyPath}-c-${idx}`))}
          </div>
        </div>
      );
    }

    if (node.tag === "NavigationViewItem") {
      return null;
    }

    if (node.tag === "StackPanel") {
      const isRow = (prop("Orientation") || "").toLowerCase() === "horizontal";
      const gapPx = asNumber(prop("Spacing"), 12);
      const padRaw = prop("Padding");
      const padPx = padRaw ? asNumber(padRaw, 0) : 0;
      return (
        <div
          key={keyPath}
          style={{ gap: `${gapPx}px`, padding: padPx ? `${padPx}px` : undefined }}
          className={`flex ${isRow ? "flex-row flex-wrap items-center" : "flex-col"}`}
        >
          {node.children.map((c, idx) => renderNode(c, `${keyPath}-${idx}`))}
        </div>
      );
    }

    if (node.tag === "Grid") {
      const cols = Math.max(1, Math.min(6, asNumber(prop("Columns"), 2)));
      const gapPx = asNumber(prop("Gap"), 12);
      const gridClass =
        cols === 1
          ? "grid-cols-1"
          : cols === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : cols === 3
              ? "grid-cols-1 sm:grid-cols-3"
              : cols === 4
                ? "grid-cols-2 sm:grid-cols-4"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
      return (
        <div key={keyPath} style={{ gap: `${gapPx}px` }} className={`grid ${gridClass}`}>
          {node.children.map((c, idx) => renderNode(c, `${keyPath}-${idx}`))}
        </div>
      );
    }

    if (node.tag === "Card") {
      const title = asString(resolveProp(prop("Title")));
      const subtitle = asString(resolveProp(prop("Subtitle")));
      const padRaw = prop("Padding");
      const padPx = padRaw ? asNumber(padRaw, 14) : 14;
      return (
        <div
          key={keyPath}
          style={{ padding: `${padPx}px` }}
          className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/85 dark:bg-[#2c3037]/90 shadow-xs"
        >
          {(title || subtitle) && (
            <div className="mb-2.5">
              {title && <div className="text-[13.5px] font-semibold leading-snug">{title}</div>}
              {subtitle && (
                <div className="text-[11.5px] text-black/55 dark:text-white/55 mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
          )}
          {node.children.map((c, idx) => renderNode(c, `${keyPath}-${idx}`))}
        </div>
      );
    }

    if (node.tag === "Expander") {
      const header = asString(resolveProp(prop("Header"))) || "Section";
      const subtitle = asString(resolveProp(prop("Subtitle")));
      const defaultOpen = prop("IsExpanded") !== "false";
      const isOpen = expandedMap[keyPath] ?? defaultOpen;
      return (
        <div
          key={keyPath}
          className="rounded-[8px] border border-black/[0.07] dark:border-white/[0.08] bg-white/85 dark:bg-[#2c3037]/90 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setExpandedMap((m) => ({ ...m, [keyPath]: !isOpen }))}
            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-black/[0.025] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium truncate">{header}</div>
              {subtitle && (
                <div className="text-[11.5px] text-black/55 dark:text-white/55 truncate">
                  {subtitle}
                </div>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
          {isOpen && (
            <div className="px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.07]">
              {node.children.map((c, idx) => renderNode(c, `${keyPath}-${idx}`))}
            </div>
          )}
        </div>
      );
    }

    if (node.tag === "TextBlock") {
      const text = asString(resolveProp(prop("Text") ?? node.textContent));
      const style = (prop("Style") || "Body").toLowerCase();
      const cls =
        style === "title"
          ? "text-[20px] font-semibold tracking-tight"
          : style === "subtitle"
            ? "text-[15px] font-semibold"
            : style === "caption"
              ? "text-[12px] text-black/60 dark:text-white/60"
              : "text-[13.5px] leading-relaxed";
      return (
        <div key={keyPath} className={`${cls} tabular-nums`}>
          {text}
        </div>
      );
    }

    if (node.tag === "Button") {
      const content = asString(resolveProp(prop("Content") ?? node.textContent)) || "Button";
      const style = (prop("Style") || "Standard").toLowerCase();
      const disabled = asBool(resolveProp(prop("Disabled")));
      const btnCls =
        style === "accent"
          ? "bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black border-transparent hover:opacity-90"
          : style === "subtle"
            ? "bg-transparent border-transparent hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
            : style === "danger"
              ? "bg-rose-600 text-white border-transparent hover:bg-rose-700"
              : "bg-white dark:bg-white/[0.08] border-black/12 dark:border-white/15 hover:bg-black/[0.04] dark:hover:bg-white/[0.12]";
      return (
        <button
          key={keyPath}
          type="button"
          disabled={disabled}
          onClick={() => invoke(prop("OnClick"))}
          className={`h-8 px-3.5 rounded-[6px] border text-[12.5px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-40 ${btnCls}`}
        >
          {content}
        </button>
      );
    }

    if (node.tag === "ToggleSwitch") {
      const header = asString(resolveProp(prop("Header")));
      const isOn = asBool(resolveProp(prop("IsOn")));
      const onLabel = asString(resolveProp(prop("OnContent"))) || "On";
      const offLabel = asString(resolveProp(prop("OffContent"))) || "Off";
      return (
        <div key={keyPath} className="flex items-center justify-between gap-3">
          {header && <span className="text-[13px] font-medium">{header}</span>}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[12px] text-black/60 dark:text-white/60">
              {isOn ? onLabel : offLabel}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isOn}
              onClick={() => invoke(prop("OnToggled"), !isOn)}
              className={`relative h-5 w-10 rounded-full transition-colors cursor-pointer border ${
                isOn
                  ? "bg-[#0067b8] dark:bg-[#4cc2ff] border-transparent"
                  : "bg-black/15 dark:bg-white/15 border-black/20 dark:border-white/25"
              }`}
            >
              <span
                className={`absolute top-0.5 size-3.5 rounded-full transition-all ${
                  isOn ? "left-[21px] bg-white dark:bg-black" : "left-0.5 bg-white"
                }`}
              />
            </button>
          </div>
        </div>
      );
    }

    if (node.tag === "Slider") {
      const header = asString(resolveProp(prop("Header")));
      const min = asNumber(resolveProp(prop("Minimum")), 0);
      const max = asNumber(resolveProp(prop("Maximum")), 100);
      const val = asNumber(resolveProp(prop("Value")), min);
      return (
        <div key={keyPath} className="space-y-1.5">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-medium">{header || "Value"}</span>
            <span className="font-mono tabular-nums text-[#0067b8] dark:text-[#4cc2ff] font-semibold">
              {val}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            value={val}
            onChange={(e) => invoke(prop("OnChanged"), Number(e.target.value))}
            className="w-full h-1.5 accent-[#0067b8] dark:accent-[#4cc2ff] cursor-pointer"
          />
        </div>
      );
    }

    if (node.tag === "TextBox") {
      const header = asString(resolveProp(prop("Header")));
      const placeholder = asString(resolveProp(prop("PlaceholderText")));
      const textVal = asString(resolveProp(prop("Text")));
      const onSubmit = prop("OnSubmit");
      return (
        <div key={keyPath} className="flex-1 min-w-[180px] space-y-1">
          {header && <label className="block text-[12px] font-medium">{header}</label>}
          <input
            type="text"
            value={textVal}
            placeholder={placeholder}
            onChange={(e) => invoke(prop("OnChanged"), e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onSubmit) {
                e.preventDefault();
                invoke(onSubmit, textVal);
              }
            }}
            className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-3 text-[12.5px] outline-none focus:border-b-2 focus:border-b-[#0067b8] dark:focus:border-b-[#4cc2ff]"
          />
        </div>
      );
    }

    if (node.tag === "CheckBox") {
      const content = asString(resolveProp(prop("Content"))) || "Option";
      const checked = asBool(resolveProp(prop("IsChecked")));
      return (
        <label
          key={keyPath}
          className="inline-flex items-center gap-2 text-[13px] cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => invoke(prop("OnChanged"), e.target.checked)}
            className="size-4 rounded-[4px] accent-[#0067b8] dark:accent-[#4cc2ff] cursor-pointer"
          />
          <span>{content}</span>
        </label>
      );
    }

    if (node.tag === "ComboBox") {
      const header = asString(resolveProp(prop("Header")));
      const rawItems = resolveProp(prop("Items"));
      const items = Array.isArray(rawItems)
        ? rawItems.map(String)
        : asString(rawItems)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      const selected = asString(resolveProp(prop("Selected")));
      return (
        <div key={keyPath} className="space-y-1">
          {header && <label className="block text-[12px] font-medium">{header}</label>}
          <select
            value={selected}
            onChange={(e) => invoke(prop("OnChanged"), e.target.value)}
            className="w-full h-8.5 rounded-[6px] border border-black/15 dark:border-white/15 bg-white dark:bg-[#1f2328] px-2.5 text-[12.5px] outline-none focus:border-[#0067b8] dark:focus:border-[#4cc2ff]"
          >
            {items.map((it) => (
              <option key={it} value={it}>
                {it}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (node.tag === "InfoBar") {
      const rawIsOpen = prop("IsOpen");
      const isOpen = rawIsOpen === undefined ? true : asBool(resolveProp(rawIsOpen));
      if (!isOpen) return null;
      const severity = asString(resolveProp(prop("Severity"))).toLowerCase();
      const title = asString(resolveProp(prop("Title")));
      const message = asString(resolveProp(prop("Message")));

      const styleCls =
        severity === "success"
          ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
          : severity === "warning"
            ? "bg-amber-500/12 border-amber-500/30 text-amber-900 dark:text-amber-300"
            : severity === "error"
              ? "bg-rose-500/12 border-rose-500/30 text-rose-800 dark:text-rose-300"
              : "bg-[#0067b8]/10 dark:bg-[#4cc2ff]/12 border-[#0067b8]/25 dark:border-[#4cc2ff]/25 text-[#0f172a] dark:text-[#e2e8f0]";

      const IconComp =
        severity === "success"
          ? CheckCircle2
          : severity === "warning"
            ? AlertTriangle
            : severity === "error"
              ? AlertCircle
              : Info;

      return (
        <div
          key={keyPath}
          className={`rounded-[8px] border px-3.5 py-2.5 flex items-start gap-2.5 text-[12.5px] ${styleCls}`}
        >
          <IconComp className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            {title && <span className="font-semibold mr-1.5">{title}</span>}
            <span className="opacity-90">{message}</span>
          </div>
        </div>
      );
    }

    if (node.tag === "ProgressRing") {
      const rawIsActive = prop("IsActive");
      const isActive = rawIsActive === undefined ? true : asBool(resolveProp(rawIsActive));
      const size = Math.max(16, Math.min(64, asNumber(prop("Size"), 28)));
      const label = asString(resolveProp(prop("Label")));
      return (
        <div key={keyPath} className="inline-flex items-center gap-2.5">
          <div
            style={{ width: size, height: size }}
            className={`rounded-full border-[3px] border-black/10 dark:border-white/15 border-t-[#0067b8] dark:border-t-[#4cc2ff] ${
              isActive ? "animate-spin" : "opacity-40"
            }`}
          />
          {label && <span className="text-[12.5px] opacity-80">{label}</span>}
        </div>
      );
    }

    if (node.tag === "ProgressBar") {
      const max = Math.max(1, asNumber(resolveProp(prop("Maximum")), 100));
      const val = Math.max(0, Math.min(max, asNumber(resolveProp(prop("Value")), 0)));
      const pct = Math.round((val / max) * 100);
      const label = asString(resolveProp(prop("Label")));
      return (
        <div key={keyPath} className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span>{label || "Progress"}</span>
            <span className="font-mono tabular-nums opacity-75">{pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/12 overflow-hidden">
            <div
              style={{ width: `${pct}%` }}
              className="h-full rounded-full bg-[#0067b8] dark:bg-[#4cc2ff] transition-[width] duration-200"
            />
          </div>
        </div>
      );
    }

    if (node.tag === "ListView") {
      const raw = resolveProp(prop("Items"));
      const items = Array.isArray(raw) ? raw : [];
      const emptyText = asString(resolveProp(prop("EmptyText"))) || "No items";
      if (items.length === 0) {
        return (
          <div
            key={keyPath}
            className="rounded-[6px] border border-dashed border-black/15 dark:border-white/15 px-3 py-4 text-center text-[12px] opacity-60"
          >
            {emptyText}
          </div>
        );
      }
      return (
        <div
          key={keyPath}
          className="rounded-[6px] border border-black/[0.08] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.07] overflow-hidden"
        >
          {items.map((item, idx) => {
            const obj =
              item && typeof item === "object"
                ? (item as { id?: string; label?: string; title?: string; done?: boolean })
                : { id: String(idx), label: String(item), done: false };
            const text = obj.label ?? obj.title ?? String(item);
            return (
              <button
                key={obj.id ?? idx}
                type="button"
                onClick={() => invoke(prop("OnItemClick"), obj)}
                className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-[12.5px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                      obj.done
                        ? "bg-[#0067b8] dark:bg-[#4cc2ff] border-transparent text-white dark:text-black"
                        : "border-black/25 dark:border-white/25"
                    }`}
                  >
                    {obj.done && <Check className="w-3 h-3" />}
                  </span>
                  <span className={`truncate ${obj.done ? "line-through opacity-55" : ""}`}>
                    {text}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (node.tag === "Divider") {
      return <div key={keyPath} className="h-px bg-black/10 dark:bg-white/10 my-1" />;
    }

    if (node.tag === "Badge") {
      const content = asString(resolveProp(prop("Content") ?? node.textContent));
      return (
        <span
          key={keyPath}
          className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-semibold bg-[#0067b8]/14 dark:bg-[#4cc2ff]/18 text-[#0067b8] dark:text-[#4cc2ff]"
        >
          {content}
        </span>
      );
    }

    return (
      <div key={keyPath} className="space-y-2">
        {node.children.map((c, idx) => renderNode(c, `${keyPath}-${idx}`))}
      </div>
    );
  };

  const wrapperTheme =
    themeOverride === "dark"
      ? "dark bg-[#1e2126] text-[#f4f4f5]"
      : themeOverride === "light"
        ? "bg-[#f4f4f6] text-[#18181b]"
        : "bg-[#f4f4f6] dark:bg-[#1e2126] text-[#18181b] dark:text-[#f4f4f5]";

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${wrapperTheme}`}>
      {/* Simulated WinUI 3 App Title Bar */}
      <div className="h-9 px-3.5 shrink-0 border-b border-black/[0.07] dark:border-white/[0.08] bg-white/75 dark:bg-[#24282e]/85 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 rounded-[4px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black flex items-center justify-center text-[9.5px] font-bold shrink-0">
            W
          </div>
          <span className="text-[12px] font-semibold truncate">
            {build.manifest.windowTitle || build.manifest.name}
          </span>
        </div>
        <span className="text-[11px] text-black/50 dark:text-white/50 tabular-nums shrink-0">
          v{build.manifest.version} · Build {build.manifest.targetBuild}
        </span>
      </div>

      {/* Rendered AST Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {build.ast.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6 text-[12.5px] opacity-60">
            No WinUI controls rendered. Add controls inside &lt;Page&gt; in App.winui.
          </div>
        ) : (
          build.ast.map((node, idx) => renderNode(node, `root-${idx}`))
        )}
      </div>
    </div>
  );
};
