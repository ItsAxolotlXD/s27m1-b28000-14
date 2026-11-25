import { galleryDB, getMediaDimensions, type GalleryMediaItem } from "../services/galleryStorage";

export const CUSTOM_FS_STORAGE_KEY = "sparkle_file_explorer_v1";
export const HIDDEN_SYSTEM_IDS_KEY = "sparkle_file_explorer_hidden_v1";

export type SharedExplorerItemKind =
  | "folder"
  | "drive"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "word"
  | "excel"
  | "ppt"
  | "pdf"
  | "html"
  | "note"
  | "text"
  | "code"
  | "archive"
  | "file"
  | "app";

export interface SharedExplorerEntry {
  id: string;
  parentId: string;
  name: string;
  kind: SharedExplorerItemKind;
  sizeBytes?: number | undefined;
  modifiedAt: number;
  dateLabel?: string | undefined;
  locationLabel: string;
  pathLabel: string;
  status?: "synced" | "cloud" | "local" | undefined;
  isFavorite?: boolean | undefined;
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
  driveUsedGb?: number | undefined;
  driveTotalGb?: number | undefined;
  driveLetter?: string | undefined;
  targetDirId?: string | undefined;
  isImportedFromDevice?: boolean | undefined;
}

export const SHARED_TEXT_EDITABLE_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "css",
  "scss",
  "html",
  "htm",
  "xml",
  "svg",
  "csv",
  "yml",
  "yaml",
  "ini",
  "cfg",
  "conf",
  "log",
  "env",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "rs",
  "go",
  "sh",
  "bat",
  "ps1",
  "sql",
]);

export const SEEDED_DESKTOP_ENTRIES: readonly SharedExplorerEntry[] = [
  {
    id: "sys-desk-welcome",
    parentId: "dir-desktop",
    name: "SparkleOS Desktop Guide.txt",
    kind: "text",
    sizeBytes: 3420,
    modifiedAt: Date.now() - 1000 * 60 * 60 * 5,
    locationLabel: "Desktop",
    pathLabel: "C:\\Users\\Sparkle\\Desktop\\SparkleOS Desktop Guide.txt",
    status: "synced",
    linkedSource: "system",
    fileExtension: "txt",
    textContent:
      "SparkleOS Insider Build\n=======================\nWelcome to SparkleOS Desktop & File Explorer.\n\n- Drag apps, folders, notes, HTML files, or Gallery items onto the Desktop.\n- Drop real files from your device directly onto the Desktop or File Explorer to import any format.",
  },
  {
    id: "sys-desk-pc-settings",
    parentId: "dir-desktop",
    name: "PC Settings.lnk",
    kind: "app",
    sizeBytes: 4096,
    modifiedAt: Date.now() - 1000 * 60 * 60 * 24,
    locationLabel: "Desktop",
    pathLabel: "C:\\Users\\Sparkle\\Desktop\\PC Settings.lnk",
    status: "synced",
    linkedSource: "system",
    targetRoute: "/pc-settings",
  },
  {
    id: "sys-desk-html-writer",
    parentId: "dir-desktop",
    name: "HTML Writer Studio.lnk",
    kind: "app",
    sizeBytes: 4096,
    modifiedAt: Date.now() - 1000 * 60 * 60 * 48,
    locationLabel: "Desktop",
    pathLabel: "C:\\Users\\Sparkle\\Desktop\\HTML Writer Studio.lnk",
    status: "synced",
    linkedSource: "system",
    targetRoute: "/html-writer",
  },
];

export function readCustomFsEntries(): SharedExplorerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_FS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SharedExplorerEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeCustomFsEntries(entries: SharedExplorerEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_FS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent("sparkle:file-explorer-fs-updated"));
  window.dispatchEvent(new CustomEvent("sparkle:desktop-updated"));
}

export function readHiddenSystemIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIDDEN_SYSTEM_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function hideSystemEntry(entryId: string): void {
  const current = readHiddenSystemIds();
  if (current.includes(entryId)) return;
  try {
    localStorage.setItem(HIDDEN_SYSTEM_IDS_KEY, JSON.stringify([...current, entryId]));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent("sparkle:file-explorer-fs-updated"));
  window.dispatchEvent(new CustomEvent("sparkle:desktop-updated"));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

export function inferExplorerKind(
  fileName: string,
  mimeType: string,
): {
  kind: SharedExplorerItemKind;
  ext: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isText: boolean;
} {
  const ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "" : "";
  const isImage =
    mimeType.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif"].includes(ext);
  const isVideo =
    mimeType.startsWith("video/") || ["mp4", "webm", "mkv", "mov", "avi"].includes(ext);
  const isAudio =
    mimeType.startsWith("audio/") || ["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext);
  const isText = SHARED_TEXT_EDITABLE_EXTENSIONS.has(ext) || mimeType.startsWith("text/");

  if (isImage) return { kind: "image", ext, isImage, isVideo, isAudio, isText };
  if (isVideo) return { kind: "video", ext, isImage, isVideo, isAudio, isText };
  if (isAudio) return { kind: "audio", ext, isImage, isVideo, isAudio, isText };

  const kind: SharedExplorerItemKind =
    ext === "html" || ext === "htm"
      ? "html"
      : ext === "pdf"
        ? "pdf"
        : ext === "docx" || ext === "doc" || ext === "rtf" || ext === "odt"
          ? "word"
          : ext === "xlsx" || ext === "xls" || ext === "ods"
            ? "excel"
            : ext === "pptx" || ext === "ppt" || ext === "odp"
              ? "ppt"
              : ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)
                ? "archive"
                : [
                      "js",
                      "mjs",
                      "cjs",
                      "ts",
                      "tsx",
                      "jsx",
                      "json",
                      "css",
                      "scss",
                      "py",
                      "xml",
                      "yml",
                      "yaml",
                      "sql",
                      "sh",
                    ].includes(ext)
                  ? "code"
                  : ["exe", "msi", "app", "apk", "dmg", "deb"].includes(ext)
                    ? "app"
                    : isText
                      ? "text"
                      : "file";

  return { kind, ext, isImage, isVideo, isAudio, isText };
}

export interface ImportDeviceFilesOptions {
  targetDirId: string;
  targetDirName: string;
  targetDirPath: string;
  /** When true (e.g. dir-home / dir-pictures / dir-videos / dir-music), index media into Gallery only if targetDirId !== dir-desktop */
  allowGalleryOnlyForDefaultMediaDir?: boolean;
  /** Also register imported images/video/audio in Gallery DB so Gallery shows them (safe for dir-desktop because galleryMapped does not target dir-desktop) */
  alsoIndexMediaInGallery?: boolean;
}

export interface ImportDeviceFilesResult {
  createdEntries: SharedExplorerEntry[];
  importedGalleryIds: string[];
  firstSelectedId: string | null;
  firstMediaOnly: boolean;
  count: number;
  names: string[];
}

export async function importDeviceFilesToFolder(
  files: FileList | File[],
  options: ImportDeviceFilesOptions,
): Promise<ImportDeviceFilesResult> {
  const fileList = Array.from(files);
  const {
    targetDirId,
    targetDirName,
    targetDirPath,
    allowGalleryOnlyForDefaultMediaDir = false,
    alsoIndexMediaInGallery = true,
  } = options;

  const newCustomEntries: SharedExplorerEntry[] = [];
  const importedGalleryIds: string[] = [];
  let firstSelectedId: string | null = null;
  let firstMediaOnly = false;
  const names: string[] = [];

  for (const file of fileList) {
    names.push(file.name);
    const { kind, ext, isImage, isVideo, isAudio, isText } = inferExplorerKind(
      file.name,
      file.type || "",
    );

    if (isImage || isVideo || isAudio) {
      const dims = await getMediaDimensions(file).catch(() => ({
        width: 1280,
        height: 720,
        duration: undefined,
      }));
      const mediaUrl =
        file.size <= 3_000_000 ? await readFileAsDataUrl(file) : URL.createObjectURL(file);

      const mediaType: GalleryMediaItem["type"] = isVideo ? "video" : isAudio ? "audio" : "image";
      const defaultMediaDir =
        mediaType === "video" ? "dir-videos" : mediaType === "audio" ? "dir-music" : "dir-pictures";

      const isGalleryOnly = allowGalleryOnlyForDefaultMediaDir && targetDirId === defaultMediaDir;

      if (isGalleryOnly || alsoIndexMediaInGallery) {
        const galId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const galleryItem: GalleryMediaItem = {
          id: galId,
          title: file.name,
          type: mediaType,
          url: mediaUrl,
          mimeType: file.type || `${mediaType}/${ext || "octet-stream"}`,
          size: file.size,
          dateAdded: new Date().toISOString(),
          dateLabel: new Date().toLocaleDateString(),
          dimensions: { width: dims.width, height: dims.height },
          aspectRatio: dims.width / Math.max(1, dims.height),
          source: "upload",
        };
        if (mediaType === "image") {
          galleryItem.thumbnailUrl = mediaUrl;
        }
        if (dims.duration !== undefined) {
          galleryItem.duration = dims.duration;
        }
        await galleryDB.add(galleryItem);
        importedGalleryIds.push(galId);
        if (isGalleryOnly) {
          if (!firstSelectedId) {
            firstSelectedId = `gal-${galId}`;
            firstMediaOnly = true;
          }
          continue;
        }
      }

      const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry: SharedExplorerEntry = {
        id: newId,
        parentId: targetDirId,
        name: file.name,
        kind: mediaType,
        sizeBytes: file.size,
        modifiedAt: Date.now(),
        locationLabel: targetDirName,
        pathLabel: `${targetDirPath}\\${file.name}`,
        status: "local",
        linkedSource: "custom",
        mediaUrl,
        mimeType: file.type || `${mediaType}/${ext || "octet-stream"}`,
        fileExtension: ext,
        dimensions: { width: dims.width, height: dims.height },
        isImportedFromDevice: true,
      };
      if (mediaType === "image") {
        entry.thumbnailUrl = mediaUrl;
      }
      newCustomEntries.push(entry);
      if (!firstSelectedId) firstSelectedId = newId;
    } else {
      const textContent = isText ? await file.text().catch(() => "") : undefined;
      const mediaUrl =
        file.size <= 1_500_000 ? await readFileAsDataUrl(file) : URL.createObjectURL(file);

      const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry: SharedExplorerEntry = {
        id: newId,
        parentId: targetDirId,
        name: file.name,
        kind,
        sizeBytes: file.size,
        modifiedAt: Date.now(),
        locationLabel: targetDirName,
        pathLabel: `${targetDirPath}\\${file.name}`,
        status: "local",
        linkedSource: "custom",
        mediaUrl,
        mimeType: file.type || "application/octet-stream",
        fileExtension: ext,
        isBinary: !isText,
        isImportedFromDevice: true,
      };
      if (textContent !== undefined) {
        entry.textContent = textContent;
      }
      newCustomEntries.push(entry);
      if (!firstSelectedId) firstSelectedId = newId;
    }
  }

  if (newCustomEntries.length > 0) {
    const existing = readCustomFsEntries();
    writeCustomFsEntries([...newCustomEntries, ...existing]);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sparkle:desktop-refresh"));
  }

  return {
    createdEntries: newCustomEntries,
    importedGalleryIds,
    firstSelectedId,
    firstMediaOnly,
    count: fileList.length,
    names,
  };
}

export function createDesktopFolderOnFS(rawName = "New folder"): SharedExplorerEntry {
  const existing = readCustomFsEntries();
  const baseName = rawName.trim() || "New folder";
  const desktopNames = new Set(
    existing.filter((e) => e.parentId === "dir-desktop").map((e) => e.name.toLowerCase()),
  );
  let candidate = baseName;
  let n = 2;
  while (desktopNames.has(candidate.toLowerCase())) {
    candidate = `${baseName} (${n++})`;
  }
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const entry: SharedExplorerEntry = {
    id,
    parentId: "dir-desktop",
    name: candidate,
    kind: "folder",
    sizeBytes: 0,
    modifiedAt: Date.now(),
    locationLabel: "Desktop",
    pathLabel: `C:\\Users\\Sparkle\\Desktop\\${candidate}`,
    status: "local",
    linkedSource: "custom",
    targetDirId: `dir-${id}`,
  };
  writeCustomFsEntries([entry, ...existing]);
  return entry;
}

export function createDesktopTextFileOnFS(
  rawName = "New Text Document.txt",
  content = "",
): SharedExplorerEntry {
  const existing = readCustomFsEntries();
  const normalized = rawName.trim() || "New Text Document.txt";
  const baseName = normalized.includes(".") ? normalized : `${normalized}.txt`;
  const desktopNames = new Set(
    existing.filter((e) => e.parentId === "dir-desktop").map((e) => e.name.toLowerCase()),
  );
  let candidate = baseName;
  let n = 2;
  const dotIdx = baseName.lastIndexOf(".");
  const stem = dotIdx > 0 ? baseName.slice(0, dotIdx) : baseName;
  const ext = dotIdx > 0 ? baseName.slice(dotIdx) : "";
  while (desktopNames.has(candidate.toLowerCase())) {
    candidate = `${stem} (${n++})${ext}`;
  }

  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const entry: SharedExplorerEntry = {
    id,
    parentId: "dir-desktop",
    name: candidate,
    kind: ext === ".html" || ext === ".htm" ? "html" : "text",
    sizeBytes: content.length,
    modifiedAt: Date.now(),
    locationLabel: "Desktop",
    pathLabel: `C:\\Users\\Sparkle\\Desktop\\${candidate}`,
    status: "local",
    linkedSource: "custom",
    fileExtension: ext.replace(/^\./, "") || "txt",
    textContent: content,
  };
  writeCustomFsEntries([entry, ...existing]);
  return entry;
}
