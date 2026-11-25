// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  addSparkleDragToDesktop,
  buildDesktopItems,
  readDesktopOrder,
  readDesktopShortcuts,
  removeDesktopItem,
  renameDesktopItem,
  reorderDesktopItem,
} from "./desktopStore";
import {
  CUSTOM_FS_STORAGE_KEY,
  HIDDEN_SYSTEM_IDS_KEY,
  SEEDED_DESKTOP_ENTRIES,
  createDesktopFolderOnFS,
  createDesktopTextFileOnFS,
  inferExplorerKind,
  readCustomFsEntries,
  readHiddenSystemIds,
} from "../utils/deviceFileImport";
import {
  SPARKLE_DRAG_MIME,
  clearSparkleDrag,
  getActiveSparkleDrag,
  hasExternalDeviceFiles,
  parseSparkleDrag,
  setActiveSparkleDrag,
  type SparkleDragPayload,
} from "../utils/sparkleDrag";

describe("sparkleDrag & desktopStore", () => {
  beforeEach(() => {
    localStorage.clear();
    clearSparkleDrag();
  });

  it("parses SPARKLE_DRAG_MIME payloads and falls back to active drag singleton", () => {
    const payload: SparkleDragPayload = {
      kind: "app",
      id: "app-notepad",
      label: "Notepad",
      route: "/notepad",
      startAppId: "app-notepad",
    };
    const fakeDt = {
      types: [SPARKLE_DRAG_MIME],
      getData: (type: string) => (type === SPARKLE_DRAG_MIME ? JSON.stringify(payload) : ""),
    } as unknown as DataTransfer;

    expect(parseSparkleDrag(fakeDt)).toEqual(payload);
    expect(hasExternalDeviceFiles(fakeDt)).toBe(false);

    setActiveSparkleDrag(payload);
    expect(getActiveSparkleDrag()).toEqual(payload);
    expect(parseSparkleDrag(null)).toEqual(payload);

    clearSparkleDrag();
    expect(getActiveSparkleDrag()).toBeNull();
  });

  it("detects external device files only when no internal Sparkle drag is active", () => {
    const externalDt = {
      types: ["Files"],
      files: [],
    } as unknown as DataTransfer;

    expect(hasExternalDeviceFiles(externalDt)).toBe(true);

    setActiveSparkleDrag({
      kind: "app",
      id: "app-settings",
      label: "Settings",
      route: "/settings",
    });
    expect(hasExternalDeviceFiles(externalDt)).toBe(false);
  });

  it("adds shortcuts for apps, directories, notes, html files, gallery items, channels, winui projects, and start folders without duplicating", () => {
    const appRes = addSparkleDragToDesktop({
      kind: "app",
      id: "app-calculator",
      label: "Calculator",
      route: "/calculator",
      startAppId: "app-calculator",
    });
    expect(appRes.alreadyExisted).toBe(false);

    const dupAppRes = addSparkleDragToDesktop({
      kind: "app",
      id: "app-calculator",
      label: "Calculator",
      route: "/calculator",
      startAppId: "app-calculator",
    });
    expect(dupAppRes.alreadyExisted).toBe(true);
    expect(dupAppRes.itemId).toBe(appRes.itemId);

    addSparkleDragToDesktop({
      kind: "directory",
      dirId: "dir-documents",
      name: "Documents",
      pathLabel: "C:\\Users\\Sparkle\\Documents",
    });
    addSparkleDragToDesktop({
      kind: "note",
      noteId: "note-1",
      title: "Project Plan",
    });
    addSparkleDragToDesktop({
      kind: "html-file",
      fileId: "html-1",
      name: "landing",
      content: "<h1>Hello</h1>",
    });
    addSparkleDragToDesktop({
      kind: "gallery-item",
      itemId: "gal-1",
      title: "Wallpaper.png",
      mediaType: "image",
      size: 20480,
    });
    addSparkleDragToDesktop({
      kind: "channel",
      channelId: "ch-vtv1",
      name: "VTV1 HD",
      slug: "vtv1",
    });
    addSparkleDragToDesktop({
      kind: "winui-project",
      projectId: "proj-1",
      name: "My WinUI App",
    });
    addSparkleDragToDesktop({
      kind: "start-folder",
      folderId: "folder-tools",
      name: "Dev Tools",
      appIds: ["app-html-writer", "app-winui-framework"],
    });

    const shortcuts = readDesktopShortcuts();
    expect(shortcuts).toHaveLength(8);
    expect(shortcuts.find((s) => s.kind === "html-file")?.name).toBe("landing.html");
    expect(shortcuts.find((s) => s.kind === "folder")?.dirId).toBe("dir-documents");
    expect(shortcuts.find((s) => s.kind === "start-folder")?.startFolderAppIds).toEqual([
      "app-html-writer",
      "app-winui-framework",
    ]);
  });

  it("copies File Explorer custom files onto Desktop FS and turns folders into Desktop shortcuts", () => {
    const fileRes = addSparkleDragToDesktop({
      kind: "explorer-entry",
      entry: {
        id: "custom-doc-1",
        parentId: "dir-documents",
        name: "NotesDraft.txt",
        explorerKind: "text",
        sizeBytes: 120,
        modifiedAt: 1000,
        locationLabel: "Documents",
        pathLabel: "C:\\Users\\Sparkle\\Documents\\NotesDraft.txt",
        linkedSource: "custom",
        textContent: "Hello desktop",
      },
    });
    expect(fileRes.alreadyExisted).toBe(false);
    const fsEntries = readCustomFsEntries();
    expect(fsEntries).toHaveLength(1);
    expect(fsEntries[0]?.parentId).toBe("dir-desktop");
    expect(fsEntries[0]?.pathLabel).toBe("C:\\Users\\Sparkle\\Desktop\\NotesDraft.txt");

    // Dragging a folder from File Explorer adds a Desktop folder shortcut
    const dirRes = addSparkleDragToDesktop({
      kind: "explorer-entry",
      entry: {
        id: "dir-pictures",
        parentId: "dir-home",
        name: "Pictures",
        explorerKind: "folder",
        modifiedAt: 1000,
        locationLabel: "This PC",
        pathLabel: "C:\\Users\\Sparkle\\Pictures",
        targetDirId: "dir-pictures",
      },
    });
    expect(dirRes.alreadyExisted).toBe(false);
    const shortcuts = readDesktopShortcuts();
    expect(shortcuts.some((s) => s.kind === "folder" && s.dirId === "dir-pictures")).toBe(true);
  });

  it("creates Desktop folders and text documents in shared FS storage", () => {
    const folder1 = createDesktopFolderOnFS("Workspace");
    const folder2 = createDesktopFolderOnFS("Workspace");
    expect(folder1.name).toBe("Workspace");
    expect(folder2.name).toBe("Workspace (2)");

    const txt1 = createDesktopTextFileOnFS("Readme", "Content");
    const txt2 = createDesktopTextFileOnFS("Readme", "More");
    expect(txt1.name).toBe("Readme.txt");
    expect(txt2.name).toBe("Readme (2).txt");

    const desktopItems = buildDesktopItems("name", false);
    expect(desktopItems.some((i) => i.name === "Workspace")).toBe(true);
    expect(desktopItems.some((i) => i.name === "Readme.txt")).toBe(true);
    expect(desktopItems.some((i) => i.name === SEEDED_DESKTOP_ENTRIES[0]?.name)).toBe(true);
  });

  it("supports reordering, renaming, and removing seeded, FS, and shortcut desktop items", () => {
    const folder = createDesktopFolderOnFS("Alpha");
    const sc = addSparkleDragToDesktop({
      kind: "app",
      id: "app-weather",
      label: "Weather",
      route: "/weather",
    });

    const initial = buildDesktopItems("name", true);
    const ids = initial.map((i) => i.id);
    const firstId = ids[0]!;
    const lastId = ids[ids.length - 1]!;
    reorderDesktopItem(lastId, firstId, ids);

    const reordered = buildDesktopItems("name", true);
    expect(reordered[0]?.id).toBe(lastId);
    expect(readDesktopOrder()[0]).toBe(lastId);

    const scItem = reordered.find((i) => i.id === sc.itemId)!;
    renameDesktopItem(scItem, "Weather Forecast");
    expect(buildDesktopItems("name", true).find((i) => i.id === sc.itemId)?.name).toBe(
      "Weather Forecast",
    );

    const folderItem = buildDesktopItems("name", true).find((i) => i.id === folder.id)!;
    renameDesktopItem(folderItem, "Beta");
    expect(readCustomFsEntries().find((e) => e.id === folder.id)?.pathLabel).toBe(
      "C:\\Users\\Sparkle\\Desktop\\Beta",
    );

    // Removing a seeded desktop item records it in hidden system IDs
    const seededItem = buildDesktopItems("name", true).find((i) => i.source === "fs-seeded")!;
    removeDesktopItem(seededItem);
    expect(readHiddenSystemIds()).toContain(seededItem.id);
    expect(localStorage.getItem(HIDDEN_SYSTEM_IDS_KEY)).toContain(seededItem.id);

    // Removing custom shortcut & FS entry clears them cleanly
    removeDesktopItem(buildDesktopItems("name", true).find((i) => i.id === sc.itemId)!);
    removeDesktopItem(buildDesktopItems("name", true).find((i) => i.id === folder.id)!);
    expect(readDesktopShortcuts()).toHaveLength(0);
    expect(localStorage.getItem(CUSTOM_FS_STORAGE_KEY)).toBe("[]");
  });

  it("infers explorer file kinds accurately for device imports", () => {
    expect(inferExplorerKind("photo.webp", "image/webp").kind).toBe("image");
    expect(inferExplorerKind("clip.mp4", "video/mp4").kind).toBe("video");
    expect(inferExplorerKind("song.mp3", "audio/mpeg").kind).toBe("audio");
    expect(inferExplorerKind("page.html", "text/html").kind).toBe("html");
    expect(inferExplorerKind("report.pdf", "application/pdf").kind).toBe("pdf");
    expect(inferExplorerKind("script.ts", "text/plain").kind).toBe("code");
    expect(inferExplorerKind("archive.zip", "application/zip").kind).toBe("archive");
  });
});
