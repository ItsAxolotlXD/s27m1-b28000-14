import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Code2,
  ExternalLink,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Info,
  Layers,
  Monitor,
  Music,
  Pencil,
  Pin,
  PinOff,
  Settings,
  StickyNote,
  Trash2,
  Tv,
  Upload,
  X,
} from "lucide-react";
import { START_APP_ICONS } from "./StartAppIcons";
import { InstalledWinUIAppBadge } from "./InstalledWinUIAppBadge";
import { WindowsContextMenu, type WindowsContextMenuItem } from "./WindowsContextMenu";
import { START_APPS } from "../data/startApps";
import {
  useInstalledWinUIApps,
  installedWinUIStartAppId,
  type WinUIAppIconKey,
} from "../services/installedWinUIAppsStore";
import { usePinState, pinActions, isRoutePinnedToTaskbar } from "../services/pinStore";
import {
  useDesktopItems,
  addSparkleDragToDesktop,
  reorderDesktopItem,
  removeDesktopItem,
  renameDesktopItem,
  type DesktopItem,
  type DesktopSortMode,
} from "../services/desktopStore";
import {
  beginSparkleDrag,
  clearSparkleDrag,
  getSparkleDragLabel,
  hasExternalDeviceFiles,
  notifyDesktopDropCompleted,
  parseSparkleDrag,
  useSparkleDragState,
  type SparkleDragPayload,
} from "../utils/sparkleDrag";
import { importDeviceFilesToFolder } from "../utils/deviceFileImport";
import { showAppToast } from "../utils/toast";
import { useNotes } from "../context/NotesContext";
import type { Channel } from "../types";

const DESKTOP_REORDER_MIME = "application/x-sparkle-desktop-reorder";

export type DesktopViewSize = "large" | "medium" | "small";

interface DesktopWorkspaceProps {
  viewSize: DesktopViewSize;
  sortBy: DesktopSortMode;
  hasVisibleWindows: boolean;
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onLaunchRoute: (route: string, state?: unknown) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function toDragPayload(item: DesktopItem): SparkleDragPayload | null {
  if (item.source === "fs-custom" || item.source === "fs-seeded") {
    const e = item.fsEntry;
    if (!e) return null;
    return {
      kind: "explorer-entry",
      entry: {
        id: e.id,
        parentId: e.parentId,
        name: e.name,
        explorerKind: e.kind,
        sizeBytes: e.sizeBytes,
        modifiedAt: e.modifiedAt,
        locationLabel: e.locationLabel,
        pathLabel: e.pathLabel,
        status: e.status,
        thumbnailUrl: e.thumbnailUrl,
        mediaUrl: e.mediaUrl,
        mimeType: e.mimeType,
        fileExtension: e.fileExtension,
        isBinary: e.isBinary,
        dimensions: e.dimensions,
        textContent: e.textContent,
        targetRoute: e.targetRoute,
        targetRouteState: e.targetRouteState,
        linkedSource: e.linkedSource,
        linkedId: e.linkedId,
        driveLetter: e.driveLetter,
        driveUsedGb: e.driveUsedGb,
        driveTotalGb: e.driveTotalGb,
        targetDirId: e.targetDirId,
        isImportedFromDevice: e.isImportedFromDevice,
      },
    };
  }
  const sc = item.shortcut;
  if (!sc) return null;
  switch (sc.kind) {
    case "app":
      return {
        kind: "app",
        id: sc.id,
        label: sc.name,
        route: sc.route,
        externalUrl: sc.externalUrl,
        startAppId: sc.startAppId,
        iconKey: sc.iconKey,
        accentColor: sc.accentColor,
      };
    case "folder":
      return {
        kind: "directory",
        dirId: sc.dirId || "dir-home",
        name: sc.name,
        pathLabel: sc.pathLabel,
        iconKind: sc.dirIconKind,
      };
    case "note":
      return {
        kind: "note",
        noteId: sc.noteId || "",
        title: sc.name,
        updatedAt: sc.modifiedAt,
      };
    case "html-file":
      return {
        kind: "html-file",
        fileId: sc.htmlFileId || sc.id,
        name: sc.name,
        content: sc.htmlContent || "",
        updatedAt: sc.modifiedAt,
      };
    case "gallery-item":
      return {
        kind: "gallery-item",
        itemId: sc.galleryItemId || sc.id,
        title: sc.name,
        mediaType: sc.galleryMediaType || "image",
        thumbnailUrl: sc.thumbnailUrl,
        url: sc.mediaUrl,
        size: sc.sizeBytes,
      };
    case "channel":
      return {
        kind: "channel",
        channelId: sc.channelId || sc.id,
        name: sc.name,
        slug: sc.channelSlug || "",
        logo: sc.channelLogo,
      };
    case "winui-project":
      return {
        kind: "winui-project",
        projectId: sc.projectId || "",
        name: sc.name,
      };
    case "setting":
      return {
        kind: "setting",
        id: sc.id,
        label: sc.name,
        route: sc.route || "/pc-settings",
        category: sc.settingCategory,
      };
    case "start-folder":
      return {
        kind: "start-folder",
        folderId: sc.id,
        name: sc.name,
        appIds: sc.startFolderAppIds || [],
      };
  }
}

export const DesktopWorkspace: React.FC<DesktopWorkspaceProps> = ({
  viewSize,
  sortBy,
  hasVisibleWindows,
  channels,
  onSelectChannel,
  onLaunchRoute,
}) => {
  const items = useDesktopItems(sortBy);
  const installedWinUIApps = useInstalledWinUIApps();
  const pinState = usePinState();
  const { setActiveNoteId } = useNotes();
  const dragState = useSparkleDragState();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropHoverTarget, setDropHoverTarget] = useState<"workspace" | "floating-strip" | null>(
    null,
  );
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [internalDragId, setInternalDragId] = useState<string | null>(null);

  const [iconContextMenu, setIconContextMenu] = useState<{
    x: number;
    y: number;
    item: DesktopItem;
  } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{
    item: DesktopItem;
    value: string;
  } | null>(null);
  const [propertiesDialog, setPropertiesDialog] = useState<DesktopItem | null>(null);
  const [openStartFolder, setOpenStartFolder] = useState<{
    name: string;
    appIds: string[];
  } | null>(null);

  const installedAppMap = useMemo(() => {
    const map = new Map<string, (typeof installedWinUIApps)[number]>();
    for (const app of installedWinUIApps) {
      map.set(installedWinUIStartAppId(app.id), app);
    }
    return map;
  }, [installedWinUIApps]);

  const sizeMetrics = useMemo(() => {
    switch (viewSize) {
      case "large":
        return {
          cellClass: "w-[96px] min-h-[104px] px-2 py-2",
          iconBoxClass: "w-12 h-12",
          iconSvgClass: "w-11 h-11",
          textClass: "text-[12px]",
          rowHeightPx: 112,
          colWidthPx: 102,
        };
      case "small":
        return {
          cellClass: "w-[72px] min-h-[76px] px-1 py-1.5",
          iconBoxClass: "w-8 h-8",
          iconSvgClass: "w-7 h-7",
          textClass: "text-[11px]",
          rowHeightPx: 82,
          colWidthPx: 76,
        };
      case "medium":
      default:
        return {
          cellClass: "w-[84px] min-h-[90px] px-1.5 py-1.5",
          iconBoxClass: "w-10 h-10",
          iconSvgClass: "w-9 h-9",
          textClass: "text-[11.5px]",
          rowHeightPx: 96,
          colWidthPx: 90,
        };
    }
  }, [viewSize]);

  const openDesktopItem = (item: DesktopItem) => {
    if (item.source === "fs-custom" || item.source === "fs-seeded") {
      const entry = item.fsEntry;
      if (!entry) return;
      if (entry.kind === "folder" || entry.kind === "drive") {
        onLaunchRoute("/file-explorer", {
          initialDirId: entry.targetDirId || entry.id,
          _t: Date.now(),
        });
        return;
      }
      if (entry.targetRoute) {
        onLaunchRoute(entry.targetRoute, entry.targetRouteState);
        return;
      }
      if (entry.kind === "html") {
        try {
          if (entry.linkedId) {
            localStorage.setItem("sparkle_html_writer_active_id_v1", entry.linkedId);
          } else if (entry.textContent !== undefined) {
            const raw = localStorage.getItem("sparkle_html_writer_files_v1");
            const existing = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
            const fileId = `html-desk-${entry.id}`;
            const updated = [
              {
                id: fileId,
                name: entry.name,
                content: entry.textContent,
                updatedAt: Date.now(),
              },
              ...existing.filter((f) => f["id"] !== fileId),
            ];
            localStorage.setItem("sparkle_html_writer_files_v1", JSON.stringify(updated));
            localStorage.setItem("sparkle_html_writer_active_id_v1", fileId);
          }
        } catch {
          // ignore
        }
        onLaunchRoute("/html-writer", { _t: Date.now() });
        return;
      }
      if (entry.kind === "text" || entry.kind === "code" || entry.textContent !== undefined) {
        try {
          const payload = {
            id: entry.id,
            name: entry.name,
            content: entry.textContent || "",
            pathLabel: entry.pathLabel,
            linkedSource: entry.linkedSource,
          };
          localStorage.setItem("sparkle_notepad_open_entry_v1", JSON.stringify(payload));
          window.dispatchEvent(new CustomEvent("sparkle:open-in-notepad", { detail: payload }));
        } catch {
          // ignore
        }
        onLaunchRoute("/notepad", { openEntryId: entry.id, _t: Date.now() });
        return;
      }
      if (entry.kind === "video" || entry.kind === "audio") {
        onLaunchRoute("/screenbox", {
          mediaUrl: entry.mediaUrl,
          title: entry.name,
          _t: Date.now(),
        });
        return;
      }
      // Images, PDFs, Office, archives, unknown binaries -> open in File Explorer and select
      onLaunchRoute("/file-explorer", {
        initialDirId: entry.parentId || "dir-desktop",
        selectEntryId: entry.id,
        openPreview: true,
        _t: Date.now(),
      });
      return;
    }

    const sc = item.shortcut;
    if (!sc) return;

    switch (sc.kind) {
      case "app": {
        if (sc.externalUrl) {
          window.open(sc.externalUrl, "_blank", "noopener,noreferrer");
        } else if (sc.route) {
          onLaunchRoute(sc.route, sc.routeState);
        }
        return;
      }
      case "folder": {
        onLaunchRoute("/file-explorer", {
          initialDirId: sc.dirId || "dir-home",
          _t: Date.now(),
        });
        return;
      }
      case "note": {
        if (sc.noteId) setActiveNoteId(sc.noteId);
        onLaunchRoute("/notes", { noteId: sc.noteId, _t: Date.now() });
        return;
      }
      case "html-file": {
        try {
          if (sc.htmlFileId) {
            localStorage.setItem("sparkle_html_writer_active_id_v1", sc.htmlFileId);
          }
        } catch {
          // ignore
        }
        onLaunchRoute("/html-writer", { _t: Date.now() });
        return;
      }
      case "gallery-item": {
        onLaunchRoute(sc.route || `/gallery?preview=${encodeURIComponent(sc.galleryItemId || "")}`);
        return;
      }
      case "channel": {
        const matched = channels.find((c) => c.id === sc.channelId || c.slug === sc.channelSlug);
        if (matched) onSelectChannel(matched);
        onLaunchRoute(sc.route || `/live-tv?channel=${encodeURIComponent(sc.channelSlug || "")}`);
        return;
      }
      case "winui-project": {
        onLaunchRoute("/winui-framework", {
          editProjectId: sc.projectId,
          _t: Date.now(),
        });
        return;
      }
      case "setting": {
        onLaunchRoute(sc.route || "/pc-settings");
        if (sc.settingCategory) {
          window.dispatchEvent(
            new CustomEvent("sparkle:pc-settings-category", {
              detail: { category: sc.settingCategory },
            }),
          );
        }
        return;
      }
      case "start-folder": {
        setOpenStartFolder({
          name: sc.name,
          appIds: sc.startFolderAppIds || [],
        });
        return;
      }
    }
  };

  const handleDesktopDrop = async (e: React.DragEvent<HTMLElement>, targetItemId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropHoverTarget(null);
    setDragOverItemId(null);

    const reorderSource = (() => {
      try {
        return e.dataTransfer.getData(DESKTOP_REORDER_MIME) || internalDragId;
      } catch {
        return internalDragId;
      }
    })();

    if (reorderSource) {
      setInternalDragId(null);
      if (targetItemId && reorderSource !== targetItemId) {
        reorderDesktopItem(
          reorderSource,
          targetItemId,
          items.map((i) => i.id),
        );
      } else if (!targetItemId && items.length > 0) {
        const lastId = items[items.length - 1]?.id;
        if (lastId && lastId !== reorderSource) {
          reorderDesktopItem(
            reorderSource,
            lastId,
            items.map((i) => i.id),
          );
        }
      }
      clearSparkleDrag();
      return;
    }

    if (hasExternalDeviceFiles(e.dataTransfer) && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      clearSparkleDrag();
      try {
        const result = await importDeviceFilesToFolder(files, {
          targetDirId: "dir-desktop",
          targetDirName: "Desktop",
          targetDirPath: "C:\\Users\\Sparkle\\Desktop",
          alsoIndexMediaInGallery: true,
        });
        if (result.firstSelectedId) setSelectedId(result.firstSelectedId);
        showAppToast(
          result.count === 1
            ? `Imported "${result.names[0]}" to Desktop`
            : `Imported ${result.count} files to Desktop`,
          { appName: "Desktop" },
        );
        notifyDesktopDropCompleted();
      } catch {
        showAppToast("Could not import dropped file(s) to Desktop", { appName: "Desktop" });
      }
      return;
    }

    const payload = parseSparkleDrag(e.dataTransfer);
    clearSparkleDrag();
    if (!payload) return;

    const targetIdx = targetItemId ? items.findIndex((i) => i.id === targetItemId) : undefined;
    const res = addSparkleDragToDesktop(
      payload,
      targetIdx !== undefined && targetIdx >= 0 ? targetIdx : undefined,
    );
    setSelectedId(res.itemId);
    notifyDesktopDropCompleted();
    showAppToast(
      res.alreadyExisted ? `"${res.name}" is already on Desktop` : `Added "${res.name}" to Desktop`,
      { appName: "Desktop" },
    );
  };

  const renderDesktopItemIcon = (item: DesktopItem) => {
    const iconSizeCls = sizeMetrics.iconSvgClass;

    if (item.source === "fs-custom" || item.source === "fs-seeded") {
      const e = item.fsEntry;
      if (!e) return <FileText className={`${iconSizeCls} text-sky-400`} />;
      if (e.kind === "app" && e.targetRoute) {
        const appId =
          e.targetRoute === "/pc-settings"
            ? "app-pc-settings"
            : e.targetRoute === "/html-writer"
              ? "app-html-writer"
              : null;
        if (appId && START_APP_ICONS[appId]) {
          return START_APP_ICONS[appId](iconSizeCls);
        }
      }
      if (e.thumbnailUrl) {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[6px] overflow-hidden border border-white/25 shadow-md bg-black/30`}
          >
            <img src={e.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          </div>
        );
      }
      if (e.kind === "folder") {
        return (
          <svg viewBox="0 0 48 48" className={`${iconSizeCls} drop-shadow-md`} aria-hidden="true">
            <path
              d="M6 12C6 9.79 7.79 8 10 8H19.5L23.5 12H38C40.21 12 42 13.79 42 16V36C42 38.21 40.21 40 38 40H10C7.79 40 6 38.21 6 36V12Z"
              fill="#F59E0B"
            />
            <path
              d="M6 17H42V36C42 38.21 40.21 40 38 40H10C7.79 40 6 38.21 6 36V17Z"
              fill="#FBBF24"
            />
          </svg>
        );
      }
      if (e.kind === "drive") {
        return <HardDrive className={`${iconSizeCls} text-slate-200 drop-shadow-md`} />;
      }
      if (e.kind === "html") {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md border border-white/20`}
          >
            <Code2 className="w-[56%] h-[56%] text-white" />
          </div>
        );
      }
      if (e.kind === "code") {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-sky-600 to-indigo-700 flex items-center justify-center shadow-md border border-white/20`}
          >
            <FileCode2 className="w-[56%] h-[56%] text-white" />
          </div>
        );
      }
      if (e.kind === "video") {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md border border-white/20`}
          >
            <Film className="w-[56%] h-[56%] text-white" />
          </div>
        );
      }
      if (e.kind === "audio") {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-md border border-white/20`}
          >
            <Music className="w-[56%] h-[56%] text-white" />
          </div>
        );
      }
      if (e.kind === "image") {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md border border-white/20`}
          >
            <ImageIcon className="w-[56%] h-[56%] text-white" />
          </div>
        );
      }
      if (e.kind === "pdf") {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center shadow-md border border-white/20 text-white font-bold text-[10px]`}
          >
            PDF
          </div>
        );
      }
      if (e.kind === "excel") {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center shadow-md border border-white/20`}
          >
            <FileSpreadsheet className="w-[56%] h-[56%] text-white" />
          </div>
        );
      }
      if (e.kind === "archive") {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md border border-white/20`}
          >
            <FileArchive className="w-[56%] h-[56%] text-white" />
          </div>
        );
      }
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-white/95 dark:bg-slate-800/95 flex flex-col items-center justify-center shadow-md border border-black/15 dark:border-white/20`}
        >
          <FileText className="w-[54%] h-[54%] text-[#0078d4] dark:text-[#4cc2ff]" />
          {e.fileExtension && (
            <span className="text-[8px] font-bold uppercase text-neutral-600 dark:text-neutral-300 leading-none mt-0.5">
              {e.fileExtension.slice(0, 4)}
            </span>
          )}
        </div>
      );
    }

    const sc = item.shortcut;
    if (!sc) return null;

    if (sc.kind === "app") {
      if (sc.iconKey && sc.accentColor) {
        return (
          <InstalledWinUIAppBadge
            iconKey={sc.iconKey as WinUIAppIconKey}
            accentColor={sc.accentColor}
            className={iconSizeCls}
          />
        );
      }
      const customApp = sc.startAppId ? installedAppMap.get(sc.startAppId) : undefined;
      if (customApp) {
        return (
          <InstalledWinUIAppBadge
            iconKey={customApp.iconKey}
            accentColor={customApp.accentColor}
            className={iconSizeCls}
          />
        );
      }
      const renderer = sc.startAppId ? START_APP_ICONS[sc.startAppId] : undefined;
      if (renderer) return renderer(iconSizeCls);
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-[#0078d4] flex items-center justify-center shadow-md text-white`}
        >
          <Monitor className="w-[56%] h-[56%]" />
        </div>
      );
    }

    if (sc.kind === "folder") {
      return (
        <svg viewBox="0 0 48 48" className={`${iconSizeCls} drop-shadow-md`} aria-hidden="true">
          <path
            d="M6 12C6 9.79 7.79 8 10 8H19.5L23.5 12H38C40.21 12 42 13.79 42 16V36C42 38.21 40.21 40 38 40H10C7.79 40 6 38.21 6 36V12Z"
            fill="#F59E0B"
          />
          <path
            d="M6 17H42V36C42 38.21 40.21 40 38 40H10C7.79 40 6 38.21 6 36V17Z"
            fill="#FBBF24"
          />
        </svg>
      );
    }

    if (sc.kind === "start-folder") {
      const miniIds = (sc.startFolderAppIds || []).slice(0, 4);
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[10px] bg-white/25 backdrop-blur-md border border-white/35 p-1 grid grid-cols-2 gap-0.5 shadow-md`}
        >
          {miniIds.map((id) => {
            const custom = installedAppMap.get(id);
            const r = START_APP_ICONS[id];
            return (
              <div key={id} className="w-full h-full flex items-center justify-center">
                {custom ? (
                  <InstalledWinUIAppBadge
                    iconKey={custom.iconKey}
                    accentColor={custom.accentColor}
                    className="w-3.5 h-3.5"
                  />
                ) : r ? (
                  r("w-3.5 h-3.5")
                ) : (
                  <div className="w-2.5 h-2.5 rounded bg-white/60" />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (sc.kind === "note") {
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md border border-white/30`}
        >
          <StickyNote className="w-[56%] h-[56%] text-amber-950" />
        </div>
      );
    }

    if (sc.kind === "html-file") {
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md border border-white/25`}
        >
          <Code2 className="w-[56%] h-[56%] text-white" />
        </div>
      );
    }

    if (sc.kind === "gallery-item") {
      if (sc.thumbnailUrl) {
        return (
          <div
            className={`${sizeMetrics.iconBoxClass} rounded-[6px] overflow-hidden border border-white/30 shadow-md bg-black/40`}
          >
            <img src={sc.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          </div>
        );
      }
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md border border-white/25`}
        >
          <ImageIcon className="w-[56%] h-[56%] text-white" />
        </div>
      );
    }

    if (sc.kind === "channel") {
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-white/95 dark:bg-slate-900/95 flex items-center justify-center shadow-md border border-white/35 p-1 overflow-hidden`}
        >
          {sc.channelLogo ? (
            <img src={sc.channelLogo} alt="" className="w-full h-full object-contain" />
          ) : (
            <Tv className="w-[56%] h-[56%] text-[#0078d4]" />
          )}
        </div>
      );
    }

    if (sc.kind === "winui-project") {
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-[#0078d4] to-[#2563eb] flex items-center justify-center shadow-md border border-white/25`}
        >
          <Layers className="w-[56%] h-[56%] text-white" />
        </div>
      );
    }

    if (sc.kind === "setting") {
      return (
        <div
          className={`${sizeMetrics.iconBoxClass} rounded-[8px] bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-md border border-white/25`}
        >
          <Settings className="w-[56%] h-[56%] text-white" />
        </div>
      );
    }

    return <Folder className={`${iconSizeCls} text-amber-400`} />;
  };

  const buildContextMenuItems = (item: DesktopItem): WindowsContextMenuItem[] => {
    const result: WindowsContextMenuItem[] = [
      {
        id: "desk-item-open",
        label: "Open",
        icon: <ExternalLink className="w-4 h-4" />,
        onSelect: () => openDesktopItem(item),
      },
    ];

    if (item.source === "fs-custom" || item.source === "fs-seeded") {
      const parentId =
        item.fsEntry?.kind === "folder"
          ? item.fsEntry.targetDirId || item.id
          : item.fsEntry?.parentId || "dir-desktop";
      result.push({
        id: "desk-item-location",
        label: "Open file location",
        icon: <FolderOpen className="w-4 h-4" />,
        onSelect: () =>
          onLaunchRoute("/file-explorer", {
            initialDirId: parentId,
            selectEntryId: item.id,
            _t: Date.now(),
          }),
      });
    } else if (item.shortcut?.dirId) {
      result.push({
        id: "desk-item-location",
        label: "Open in File Explorer",
        icon: <FolderOpen className="w-4 h-4" />,
        onSelect: () =>
          onLaunchRoute("/file-explorer", {
            initialDirId: item.shortcut?.dirId,
            _t: Date.now(),
          }),
      });
    }

    const appRoute =
      item.shortcut?.kind === "app" ? item.shortcut.route : item.fsEntry?.targetRoute;
    const appStartId = item.shortcut?.startAppId;
    if (appRoute || appStartId) {
      const resolvedDef = appStartId ? START_APPS.find((a) => a.id === appStartId) : undefined;
      const resolvedTitle = resolvedDef?.label || item.name;
      if (appStartId && resolvedDef) {
        const isStartPinned = !pinState.startUnpinned.includes(appStartId);
        result.push({
          id: "desk-item-pin-start",
          label: isStartPinned ? "Unpin from Start" : "Pin to Start",
          icon: isStartPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
          onSelect: () =>
            isStartPinned
              ? pinActions.unpinFromStart(appStartId)
              : pinActions.pinToStart(appStartId),
        });
      }
      if (appRoute) {
        const isTbPinned = isRoutePinnedToTaskbar(pinState.taskbarPins, appRoute);
        result.push({
          id: "desk-item-pin-taskbar",
          label: isTbPinned ? "Unpin from taskbar" : "Pin to taskbar",
          icon: isTbPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
          onSelect: () =>
            isTbPinned
              ? pinActions.unpinFromTaskbar(appRoute)
              : pinActions.pinToTaskbar(appRoute, resolvedTitle),
        });
      }
    }

    result.push({ id: "desk-item-div-1", divider: true });
    result.push({
      id: "desk-item-rename",
      label: "Rename",
      icon: <Pencil className="w-4 h-4" />,
      onSelect: () => setRenameDialog({ item, value: item.name }),
    });
    result.push({
      id: "desk-item-delete",
      label: item.source === "shortcut" ? "Remove shortcut" : "Delete",
      icon: <Trash2 className="w-4 h-4" />,
      onSelect: () => {
        removeDesktopItem(item);
        if (selectedId === item.id) setSelectedId(null);
        showAppToast(`Removed "${item.name}" from Desktop`, { appName: "Desktop" });
      },
    });
    result.push({ id: "desk-item-div-2", divider: true });
    result.push({
      id: "desk-item-props",
      label: "Properties",
      icon: <Info className="w-4 h-4" />,
      onSelect: () => setPropertiesDialog(item),
    });

    return result;
  };

  const activeDragLabel = dragState.payload
    ? getSparkleDragLabel(dragState.payload)
    : dragState.hasExternalFiles
      ? "device files"
      : null;

  return (
    <>
      <div
        data-desktop-icons-layer="true"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedId(null);
          }
        }}
        onDragOver={(e) => {
          const isInternalReorder = (() => {
            try {
              return (
                Boolean(internalDragId) ||
                Array.from(e.dataTransfer.types || []).includes(DESKTOP_REORDER_MIME)
              );
            } catch {
              return Boolean(internalDragId);
            }
          })();
          if (isInternalReorder || dragState.payload || hasExternalDeviceFiles(e.dataTransfer)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = isInternalReorder ? "move" : "copy";
            if (!isInternalReorder) setDropHoverTarget("workspace");
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropHoverTarget((prev) => (prev === "workspace" ? null : prev));
            setDragOverItemId(null);
          }
        }}
        onDrop={(e) => {
          void handleDesktopDrop(e);
        }}
        className="absolute inset-0 z-[2] p-2.5 sm:p-3 overflow-hidden select-none"
      >
        {/* Vertical-first Windows Desktop icon flow */}
        <div
          style={{
            gridAutoFlow: "column",
            gridTemplateRows: `repeat(auto-fill, ${sizeMetrics.rowHeightPx}px)`,
            gridAutoColumns: `${sizeMetrics.colWidthPx}px`,
          }}
          className="grid h-full w-full content-start justify-start gap-1 pointer-events-none"
        >
          {items.map((item) => {
            const isSelected = selectedId === item.id;
            const isDropTarget = dragOverItemId === item.id;
            const sparklePayload = toDragPayload(item);

            return (
              <div
                key={item.id}
                data-desktop-icon={item.id}
                role="button"
                tabIndex={0}
                draggable
                aria-label={item.name}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedId(item.id);
                  setIconContextMenu(null);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openDesktopItem(item);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDesktopItem(item);
                  } else if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    removeDesktopItem(item);
                  } else if (e.key === "F2") {
                    e.preventDefault();
                    setRenameDialog({ item, value: item.name });
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedId(item.id);
                  setIconContextMenu({ x: e.clientX, y: e.clientY, item });
                }}
                onDragStart={(e) => {
                  setInternalDragId(item.id);
                  try {
                    e.dataTransfer.setData(DESKTOP_REORDER_MIME, item.id);
                  } catch {
                    // ignore
                  }
                  if (sparklePayload) {
                    beginSparkleDrag(e, sparklePayload, { preserveTextPlain: false });
                  }
                }}
                onDragEnd={() => {
                  setInternalDragId(null);
                  setDragOverItemId(null);
                  clearSparkleDrag();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverItemId(item.id);
                }}
                onDragLeave={() => {
                  setDragOverItemId((prev) => (prev === item.id ? null : prev));
                }}
                onDrop={(e) => {
                  void handleDesktopDrop(e, item.id);
                }}
                className={`pointer-events-auto group relative flex flex-col items-center justify-start gap-1 rounded-[6px] border transition-colors cursor-default outline-none ${sizeMetrics.cellClass} ${
                  isDropTarget
                    ? "bg-white/25 border-[#4cc2ff] ring-1 ring-[#4cc2ff]/70"
                    : isSelected
                      ? "bg-white/22 border-white/35 backdrop-blur-xs shadow-sm"
                      : "border-transparent hover:bg-white/14 hover:border-white/20"
                }`}
              >
                <div className="relative flex items-center justify-center shrink-0">
                  {renderDesktopItemIcon(item)}
                  {item.isShortcut && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-[3px] bg-white/95 text-[#0078d4] border border-black/15 shadow-xs flex items-center justify-center pointer-events-none"
                    >
                      <ArrowUpRight className="w-2.5 h-2.5 stroke-[2.5]" />
                    </span>
                  )}
                </div>
                <span
                  className={`${sizeMetrics.textClass} leading-[1.22] font-normal text-white text-center line-clamp-2 break-words w-full px-0.5`}
                  style={{
                    textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.95)",
                  }}
                >
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Desktop Drop Overlay (for empty desktop background) */}
        <AnimatePresence>
          {dropHoverTarget === "workspace" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-3 rounded-[12px] border-2 border-dashed border-[#4cc2ff] bg-[#0078d4]/12 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-[5]"
            >
              <div className="px-4 py-2.5 rounded-[10px] bg-white/90 dark:bg-[#1e222a]/90 border border-black/10 dark:border-white/15 shadow-xl flex items-center gap-2.5 text-[#111827] dark:text-white">
                <Upload className="w-4 h-4 text-[#0078d4] dark:text-[#4cc2ff]" />
                <span className="text-[13px] font-medium">
                  {dragState.payload
                    ? `Drop "${getSparkleDragLabel(dragState.payload)}" to place on Desktop`
                    : "Drop files here to import onto Desktop"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Top-Center "Drop to Desktop" target whenever windows cover desktop during an active drag */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {hasVisibleWindows && activeDragLabel && !internalDragId && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                  setDropHoverTarget("floating-strip");
                }}
                onDragLeave={() => {
                  setDropHoverTarget((prev) => (prev === "floating-strip" ? null : prev));
                }}
                onDrop={(e) => {
                  void handleDesktopDrop(e);
                }}
                className={`fixed top-3 left-1/2 -translate-x-1/2 z-[2147483000] px-4 py-2.5 rounded-[10px] border shadow-2xl backdrop-blur-xl flex items-center gap-2.5 transition-all select-none ${
                  dropHoverTarget === "floating-strip"
                    ? "bg-[#0078d4] text-white border-[#4cc2ff] scale-105"
                    : "bg-white/90 dark:bg-[#20242c]/90 text-[#111827] dark:text-white border-black/15 dark:border-white/20"
                }`}
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span className="text-[12.5px] font-medium whitespace-nowrap">
                  Drop here to add &ldquo;{activeDragLabel}&rdquo; to Desktop
                </span>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Desktop Icon Context Menu */}
      <AnimatePresence>
        {iconContextMenu && (
          <WindowsContextMenu
            key={`desk-icon-ctx-${iconContextMenu.item.id}`}
            x={iconContextMenu.x}
            y={iconContextMenu.y}
            ariaLabel={`Actions for ${iconContextMenu.item.name}`}
            onClose={() => setIconContextMenu(null)}
            items={buildContextMenuItems(iconContextMenu.item)}
          />
        )}
      </AnimatePresence>

      {/* Start Folder Launcher Popover */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {openStartFolder && (
              <div className="fixed inset-0 z-[2147483640] flex items-center justify-center p-4 select-none">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setOpenStartFolder(null)}
                  className="fixed inset-0 bg-black/45 backdrop-blur-xs"
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-10 w-full max-w-[360px] rounded-[12px] bg-white/95 dark:bg-[#202020]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-2xl p-4 space-y-3 text-[#111827] dark:text-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold truncate">{openStartFolder.name}</h3>
                    <button
                      type="button"
                      onClick={() => setOpenStartFolder(null)}
                      aria-label="Close folder"
                      className="p-1.5 rounded-[6px] hover:bg-black/5 dark:hover:bg-white/10 border-none bg-transparent cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {openStartFolder.appIds.map((appId) => {
                      const stdApp = START_APPS.find((a) => a.id === appId);
                      const customApp = installedAppMap.get(appId);
                      const label = customApp?.name || stdApp?.label || appId;
                      const renderer = START_APP_ICONS[appId];
                      return (
                        <button
                          key={appId}
                          type="button"
                          onClick={() => {
                            setOpenStartFolder(null);
                            if (customApp) {
                              onLaunchRoute(
                                `/winui-framework?launch=${encodeURIComponent(customApp.id)}`,
                              );
                            } else if (stdApp?.externalUrl) {
                              window.open(stdApp.externalUrl, "_blank", "noopener,noreferrer");
                            } else if (stdApp?.route) {
                              onLaunchRoute(stdApp.route);
                            }
                          }}
                          className="flex flex-col items-center gap-1.5 p-2.5 rounded-[8px] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-transparent hover:border-black/10 dark:hover:border-white/10 bg-transparent cursor-pointer"
                        >
                          {customApp ? (
                            <InstalledWinUIAppBadge
                              iconKey={customApp.iconKey}
                              accentColor={customApp.accentColor}
                              className="w-8 h-8"
                            />
                          ) : renderer ? (
                            renderer("w-8 h-8")
                          ) : (
                            <Monitor className="w-8 h-8 text-[#0078d4]" />
                          )}
                          <span className="text-[11.5px] text-center line-clamp-2 leading-tight">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Rename Desktop Item Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {renameDialog && (
              <div className="fixed inset-0 z-[2147483645] flex items-center justify-center p-4 select-none">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setRenameDialog(null)}
                  className="fixed inset-0 bg-black/55 backdrop-blur-xs"
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="fluent-modal-dialog relative z-10 w-full max-w-[420px] bg-white dark:bg-[#202020] rounded-[10px] overflow-hidden shadow-2xl border border-black/[0.08] dark:border-white/[0.08] text-[#111827] dark:text-[#F3F4F6]"
                >
                  <div className="p-6 pb-5 space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-[18px] font-semibold tracking-tight">
                          Rename Desktop item
                        </h2>
                        <p className="mt-1 text-[12.5px] text-black/60 dark:text-white/60 truncate">
                          Update name for &ldquo;{renameDialog.item.name}&rdquo;.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close"
                        onClick={() => setRenameDialog(null)}
                        className="rounded-[6px] p-1.5 hover:bg-black/5 dark:hover:bg-white/10 border-none bg-transparent cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={renameDialog.value}
                      onChange={(e) =>
                        setRenameDialog((prev) =>
                          prev ? { ...prev, value: e.target.value } : null,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && renameDialog.value.trim()) {
                          renameDesktopItem(renameDialog.item, renameDialog.value);
                          setRenameDialog(null);
                        }
                        if (e.key === "Escape") setRenameDialog(null);
                      }}
                      className="w-full h-[36px] px-3 rounded-[6px] bg-black/[0.03] dark:bg-white/[0.06] border border-black/15 dark:border-white/15 text-[13.5px] outline-none"
                    />
                  </div>
                  <div className="h-[1px] w-full bg-black/10 dark:bg-white/10" />
                  <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] px-6 py-3 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRenameDialog(null)}
                      className="px-4 h-8 rounded-[6px] bg-white dark:bg-[#2C2C2C] text-[12.5px] border border-black/10 dark:border-white/10 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (renameDialog.value.trim()) {
                          renameDesktopItem(renameDialog.item, renameDialog.value);
                          setRenameDialog(null);
                        }
                      }}
                      className="fluent-btn-primary px-4 h-8 rounded-[6px] bg-[#0078d4] text-white text-[12.5px] font-medium border-none cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Properties Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {propertiesDialog && (
              <div className="fixed inset-0 z-[2147483645] flex items-center justify-center p-4 select-none">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setPropertiesDialog(null)}
                  className="fixed inset-0 bg-black/55 backdrop-blur-xs"
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="fluent-modal-dialog relative z-10 w-full max-w-[400px] bg-white dark:bg-[#202020] rounded-[10px] overflow-hidden shadow-2xl border border-black/[0.08] dark:border-white/[0.08] text-[#111827] dark:text-[#F3F4F6]"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderDesktopItemIcon(propertiesDialog)}
                        <div className="min-w-0">
                          <h2 className="text-[16px] font-semibold truncate">
                            {propertiesDialog.name}
                          </h2>
                          <div className="text-[11.5px] text-black/60 dark:text-white/60 uppercase">
                            {propertiesDialog.fsEntry?.kind || propertiesDialog.kind}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Close"
                        onClick={() => setPropertiesDialog(null)}
                        className="rounded-[6px] p-1.5 hover:bg-black/5 dark:hover:bg-white/10 border-none bg-transparent cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="h-[1px] bg-black/10 dark:bg-white/10" />
                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex justify-between gap-4">
                        <span className="text-black/60 dark:text-white/60">Location</span>
                        <span className="text-right truncate font-medium">
                          {propertiesDialog.fsEntry?.pathLabel ||
                            propertiesDialog.shortcut?.pathLabel ||
                            propertiesDialog.shortcut?.route ||
                            "C:\\Users\\Sparkle\\Desktop"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-black/60 dark:text-white/60">Size</span>
                        <span className="font-medium">
                          {formatBytes(propertiesDialog.sizeBytes)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-black/60 dark:text-white/60">Modified</span>
                        <span className="font-medium">
                          {new Date(propertiesDialog.modifiedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#F3F3F3] dark:bg-[#1C1C1C] px-5 py-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPropertiesDialog(null)}
                      className="fluent-btn-primary px-4 h-8 rounded-[6px] bg-[#0078d4] text-white text-[12.5px] font-medium border-none cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};
