export type RegValueType =
  "REG_SZ" | "REG_BINARY" | "REG_DWORD" | "REG_QWORD" | "REG_MULTI_SZ" | "REG_EXPAND_SZ";

export interface RegValue {
  name: string;
  type: RegValueType;
  /**
   * Canonical stored representation:
   * - REG_SZ / REG_EXPAND_SZ: plain string
   * - REG_MULTI_SZ: newline-separated strings
   * - REG_DWORD / REG_QWORD: base-10 non-negative integer string (or hex parsed to BigInt string)
   * - REG_BINARY: space-separated uppercase hex byte pairs, e.g. "0A FF 12 00"
   */
  data: string;
}

export interface RegKeyNode {
  name: string;
  values: RegValue[];
  children: Record<string, RegKeyNode>;
}

export interface RegSearchResult {
  path: string;
  matchKind: "key" | "value" | "data";
  valueName?: string;
  preview: string;
}

export const REGISTRY_STORAGE_KEY = "sparkle_registry_editor_tree_v1";
export const REGISTRY_FAVORITES_KEY = "sparkle_registry_editor_favorites_v1";

export const ROOT_HIVES = [
  "HKEY_CLASSES_ROOT",
  "HKEY_CURRENT_USER",
  "HKEY_LOCAL_MACHINE",
  "HKEY_USERS",
  "HKEY_CURRENT_CONFIG",
] as const;

const HIVE_ALIASES: Record<string, string> = {
  HKCR: "HKEY_CLASSES_ROOT",
  HKCU: "HKEY_CURRENT_USER",
  HKLM: "HKEY_LOCAL_MACHINE",
  HKU: "HKEY_USERS",
  HKCC: "HKEY_CURRENT_CONFIG",
};

export const DEFAULT_FAVORITES: string[] = [
  "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion\\Desktop",
  "Computer\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
  "Computer\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
  "Computer\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
];

function makeKey(
  name: string,
  values: RegValue[] = [],
  childrenList: RegKeyNode[] = [],
): RegKeyNode {
  const children: Record<string, RegKeyNode> = {};
  for (const child of childrenList) {
    children[child.name] = child;
  }
  const hasDefault = values.some((v) => v.name === "");
  const normalizedValues = hasDefault
    ? values
    : [{ name: "", type: "REG_SZ" as const, data: "" }, ...values];
  return {
    name,
    values: normalizedValues,
    children,
  };
}

export function createInitialRegistryTree(): RegKeyNode {
  return makeKey(
    "Computer",
    [],
    [
      makeKey(
        "HKEY_CLASSES_ROOT",
        [],
        [
          makeKey(".html", [
            { name: "", type: "REG_SZ", data: "Sparkle.HTMLDocument" },
            { name: "Content Type", type: "REG_SZ", data: "text/html" },
            { name: "PerceivedType", type: "REG_SZ", data: "text" },
          ]),
          makeKey(".json", [
            { name: "", type: "REG_SZ", data: "jsonfile" },
            { name: "Content Type", type: "REG_SZ", data: "application/json" },
          ]),
          makeKey(".m3u8", [
            { name: "", type: "REG_SZ", data: "Sparkle.WatchPlaylist" },
            { name: "Content Type", type: "REG_SZ", data: "application/vnd.apple.mpegurl" },
          ]),
          makeKey(".mp4", [
            { name: "", type: "REG_SZ", data: "Screenbox.mp4" },
            { name: "Content Type", type: "REG_SZ", data: "video/mp4" },
            { name: "PerceivedType", type: "REG_SZ", data: "video" },
          ]),
          makeKey(".png", [
            { name: "", type: "REG_SZ", data: "pngfile" },
            { name: "Content Type", type: "REG_SZ", data: "image/png" },
            { name: "PerceivedType", type: "REG_SZ", data: "image" },
          ]),
          makeKey(".reg", [{ name: "", type: "REG_SZ", data: "regfile" }]),
          makeKey(".txt", [
            { name: "", type: "REG_SZ", data: "txtfile" },
            { name: "Content Type", type: "REG_SZ", data: "text/plain" },
            { name: "PerceivedType", type: "REG_SZ", data: "text" },
          ]),
          makeKey(
            "Directory",
            [],
            [
              makeKey(
                "shell",
                [],
                [
                  makeKey(
                    "OpenInExplorer",
                    [{ name: "", type: "REG_SZ", data: "Open in File Explorer" }],
                    [makeKey("command", [{ name: "", type: "REG_SZ", data: 'explorer.exe "%1"' }])],
                  ),
                ],
              ),
            ],
          ),
          makeKey(
            "regfile",
            [
              { name: "", type: "REG_SZ", data: "Registration Entries" },
              { name: "EditFlags", type: "REG_DWORD", data: "2097152" },
            ],
            [
              makeKey("DefaultIcon", [
                { name: "", type: "REG_EXPAND_SZ", data: "%SystemRoot%\\regedit.exe,-100" },
              ]),
            ],
          ),
        ],
      ),
      makeKey(
        "HKEY_CURRENT_USER",
        [],
        [
          makeKey(
            "Control Panel",
            [],
            [
              makeKey("Colors", [
                { name: "ActiveBorder", type: "REG_SZ", data: "180 180 180" },
                { name: "ActiveTitle", type: "REG_SZ", data: "153 180 209" },
                { name: "Background", type: "REG_SZ", data: "22 22 26" },
                { name: "Window", type: "REG_SZ", data: "255 255 255" },
                { name: "WindowText", type: "REG_SZ", data: "0 0 0" },
              ]),
              makeKey(
                "Desktop",
                [
                  { name: "DragFullWindows", type: "REG_SZ", data: "1" },
                  { name: "FontSmoothing", type: "REG_SZ", data: "2" },
                  { name: "MenuShowDelay", type: "REG_SZ", data: "120" },
                  { name: "WallpaperStyle", type: "REG_SZ", data: "10" },
                  {
                    name: "UserPreferencesMask",
                    type: "REG_BINARY",
                    data: "9E 3E 07 80 12 00 00 00",
                  },
                ],
                [
                  makeKey("WindowMetrics", [
                    { name: "IconSpacing", type: "REG_SZ", data: "-1125" },
                    { name: "IconVerticalSpacing", type: "REG_SZ", data: "-1125" },
                    { name: "MinAnimate", type: "REG_SZ", data: "1" },
                  ]),
                ],
              ),
            ],
          ),
          makeKey("Environment", [
            { name: "OS", type: "REG_SZ", data: "SparkleOS_NT" },
            { name: "TEMP", type: "REG_EXPAND_SZ", data: "%USERPROFILE%\\AppData\\Local\\Temp" },
            { name: "TMP", type: "REG_EXPAND_SZ", data: "%USERPROFILE%\\AppData\\Local\\Temp" },
          ]),
          makeKey(
            "Software",
            [],
            [
              makeKey(
                "Microsoft",
                [],
                [
                  makeKey(
                    "Windows",
                    [],
                    [
                      makeKey(
                        "CurrentVersion",
                        [],
                        [
                          makeKey(
                            "Explorer",
                            [],
                            [
                              makeKey("Advanced", [
                                { name: "Hidden", type: "REG_DWORD", data: "1" },
                                { name: "HideFileExt", type: "REG_DWORD", data: "0" },
                                {
                                  name: "ShowSyncProviderNotifications",
                                  type: "REG_DWORD",
                                  data: "1",
                                },
                                { name: "TaskbarAl", type: "REG_DWORD", data: "1" },
                                { name: "TaskbarDa", type: "REG_DWORD", data: "1" },
                                { name: "TaskbarSi", type: "REG_DWORD", data: "1" },
                              ]),
                            ],
                          ),
                          makeKey("Run", [
                            {
                              name: "SparkleShell",
                              type: "REG_SZ",
                              data: '"C:\\Program Files\\SparkleOS\\sparkle.exe" --tray',
                            },
                            {
                              name: "WindowsSecurityHealth",
                              type: "REG_EXPAND_SZ",
                              data: "%windir%\\system32\\SecurityHealthSystray.exe",
                            },
                          ]),
                          makeKey(
                            "Themes",
                            [],
                            [
                              makeKey("Personalize", [
                                { name: "AppsUseLightTheme", type: "REG_DWORD", data: "0" },
                                { name: "SystemUsesLightTheme", type: "REG_DWORD", data: "0" },
                                { name: "EnableTransparency", type: "REG_DWORD", data: "1" },
                                { name: "ColorPrevalence", type: "REG_DWORD", data: "0" },
                              ]),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
              makeKey(
                "SparkleOS",
                [],
                [
                  makeKey(
                    "CurrentVersion",
                    [],
                    [
                      makeKey("Desktop", [
                        { name: "WindowsMode", type: "REG_DWORD", data: "1" },
                        { name: "Wallpaper", type: "REG_SZ", data: "waves-ocean-light" },
                        { name: "SpotlightInterval", type: "REG_SZ", data: "1m" },
                        { name: "SpatialGlass", type: "REG_DWORD", data: "1" },
                        { name: "SpatialGlassOpacity", type: "REG_DWORD", data: "20" },
                        { name: "SpatialGlassBlur", type: "REG_DWORD", data: "10" },
                        { name: "UiScale", type: "REG_SZ", data: "default" },
                      ]),
                      makeKey("Taskbar", [
                        { name: "TaskbarLocation", type: "REG_SZ", data: "bottom" },
                        { name: "TaskbarAlignment", type: "REG_SZ", data: "center" },
                        { name: "TaskbarScale", type: "REG_SZ", data: "default" },
                        { name: "SearchStyle", type: "REG_SZ", data: "box" },
                      ]),
                      makeKey("ViveTool", [
                        {
                          name: "EnabledFeatures",
                          type: "REG_MULTI_SZ",
                          data: "48433719\n52800241\n55194322",
                        },
                        { name: "DeveloperMode", type: "REG_DWORD", data: "0" },
                      ]),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      makeKey(
        "HKEY_LOCAL_MACHINE",
        [],
        [
          makeKey(
            "HARDWARE",
            [],
            [
              makeKey(
                "DESCRIPTION",
                [],
                [
                  makeKey(
                    "System",
                    [],
                    [
                      makeKey(
                        "CentralProcessor",
                        [],
                        [
                          makeKey("0", [
                            { name: "~MHz", type: "REG_DWORD", data: "3800" },
                            {
                              name: "Identifier",
                              type: "REG_SZ",
                              data: "AMD64 Family 25 Model 97 Stepping 2",
                            },
                            {
                              name: "ProcessorNameString",
                              type: "REG_SZ",
                              data: "Sparkle Virtual x64 Processor",
                            },
                            { name: "VendorIdentifier", type: "REG_SZ", data: "AuthenticAMD" },
                          ]),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          makeKey(
            "SOFTWARE",
            [],
            [
              makeKey(
                "Microsoft",
                [],
                [
                  makeKey(
                    "Windows NT",
                    [],
                    [
                      makeKey("CurrentVersion", [
                        {
                          name: "BuildLabEx",
                          type: "REG_SZ",
                          data: "28000.14.amd64fre.ge_sparkle.261124-1200",
                        },
                        { name: "CurrentBuild", type: "REG_SZ", data: "28000.14" },
                        { name: "CurrentBuildNumber", type: "REG_SZ", data: "28000.14" },
                        { name: "DisplayVersion", type: "REG_SZ", data: "26H1" },
                        { name: "EditionID", type: "REG_SZ", data: "Professional" },
                        { name: "ProductName", type: "REG_SZ", data: "SparkleOS 11 Pro" },
                        { name: "RegisteredOwner", type: "REG_SZ", data: "Sparkle User" },
                        {
                          name: "DigitalProductId",
                          type: "REG_BINARY",
                          data: "A4 00 00 00 03 00 00 00 32 36 33 33",
                        },
                      ]),
                    ],
                  ),
                ],
              ),
            ],
          ),
          makeKey(
            "SYSTEM",
            [],
            [
              makeKey(
                "CurrentControlSet",
                [],
                [
                  makeKey(
                    "Control",
                    [],
                    [
                      makeKey(
                        "Session Manager",
                        [],
                        [
                          makeKey("Environment", [
                            {
                              name: "ComSpec",
                              type: "REG_EXPAND_SZ",
                              data: "%SystemRoot%\\system32\\cmd.exe",
                            },
                            { name: "NUMBER_OF_PROCESSORS", type: "REG_SZ", data: "8" },
                            { name: "OS", type: "REG_SZ", data: "Windows_NT" },
                            { name: "PROCESSOR_ARCHITECTURE", type: "REG_SZ", data: "AMD64" },
                            { name: "windir", type: "REG_EXPAND_SZ", data: "%SystemRoot%" },
                          ]),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      makeKey(
        "HKEY_USERS",
        [],
        [
          makeKey(
            ".DEFAULT",
            [],
            [
              makeKey(
                "Control Panel",
                [],
                [makeKey("Desktop", [{ name: "Wallpaper", type: "REG_SZ", data: "" }])],
              ),
              makeKey(
                "Software",
                [],
                [
                  makeKey("SparkleOS", [
                    { name: "FirstBootCompleted", type: "REG_DWORD", data: "1" },
                  ]),
                ],
              ),
            ],
          ),
        ],
      ),
      makeKey(
        "HKEY_CURRENT_CONFIG",
        [],
        [
          makeKey(
            "Software",
            [],
            [
              makeKey("Fonts", [
                { name: "FIXEDFON.FON", type: "REG_SZ", data: "vgafix.fon" },
                { name: "FONTS.FON", type: "REG_SZ", data: "vgasys.fon" },
                { name: "LogPixels", type: "REG_DWORD", data: "96" },
              ]),
            ],
          ),
          makeKey(
            "System",
            [],
            [
              makeKey(
                "CurrentControlSet",
                [],
                [
                  makeKey(
                    "Control",
                    [],
                    [
                      makeKey(
                        "VIDEO",
                        [],
                        [
                          makeKey("0000", [
                            {
                              name: "DefaultSettings.XResolution",
                              type: "REG_DWORD",
                              data: "1920",
                            },
                            {
                              name: "DefaultSettings.YResolution",
                              type: "REG_DWORD",
                              data: "1080",
                            },
                          ]),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

export function normalizeRegistryPath(rawPath: string): string {
  const cleaned = rawPath.trim().replace(/\//g, "\\").replace(/\\+$/, "");
  if (!cleaned || cleaned.toLowerCase() === "computer") return "Computer";

  const segments = cleaned.split("\\").filter(Boolean);
  if (segments.length === 0) return "Computer";

  let startIndex = 0;
  if (segments[0]?.toLowerCase() === "computer") {
    startIndex = 1;
  }

  const remaining = segments.slice(startIndex);
  if (remaining.length === 0) return "Computer";

  const firstUpper = remaining[0]!.toUpperCase();
  const expandedHive = HIVE_ALIASES[firstUpper] ?? remaining[0]!;
  remaining[0] = expandedHive;

  return ["Computer", ...remaining].join("\\");
}

export function getPathSegments(path: string): string[] {
  const normalized = normalizeRegistryPath(path);
  return normalized.split("\\").filter(Boolean);
}

export function getParentPath(path: string): string | null {
  const segs = getPathSegments(path);
  if (segs.length <= 1) return null;
  return segs.slice(0, -1).join("\\");
}

export function isProtectedKeyPath(path: string): boolean {
  const segs = getPathSegments(path);
  return segs.length <= 2; // Computer or root hives
}

export function cloneRegistryTree(node: RegKeyNode): RegKeyNode {
  const children: Record<string, RegKeyNode> = {};
  for (const [k, v] of Object.entries(node.children)) {
    children[k] = cloneRegistryTree(v);
  }
  return {
    name: node.name,
    values: node.values.map((v) => ({ ...v })),
    children,
  };
}

export function getNodeByPath(root: RegKeyNode, path: string): RegKeyNode | null {
  const segs = getPathSegments(path);
  if (segs.length === 0) return null;
  if (segs[0] !== root.name) return null;

  let current: RegKeyNode = root;
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) return null;
    const direct = current.children[seg];
    if (direct) {
      current = direct;
      continue;
    }
    const foundKey = Object.keys(current.children).find(
      (k) => k.toLowerCase() === seg.toLowerCase(),
    );
    if (!foundKey || !current.children[foundKey]) return null;
    current = current.children[foundKey]!;
  }
  return current;
}

export function resolveActualPath(root: RegKeyNode, path: string): string | null {
  const segs = getPathSegments(path);
  if (segs.length === 0 || segs[0] !== root.name) return null;

  const actualSegs: string[] = [root.name];
  let current: RegKeyNode = root;
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) return null;
    const foundKey = Object.keys(current.children).find(
      (k) => k.toLowerCase() === seg.toLowerCase(),
    );
    if (!foundKey || !current.children[foundKey]) return null;
    actualSegs.push(foundKey);
    current = current.children[foundKey]!;
  }
  return actualSegs.join("\\");
}

export function getSortedChildNames(node: RegKeyNode): string[] {
  if (node.name === "Computer") {
    const hives: string[] = ROOT_HIVES.filter((h) => Boolean(node.children[h]));
    return hives.concat(
      Object.keys(node.children)
        .filter((k) => !(ROOT_HIVES as readonly string[]).includes(k))
        .sort((a, b) => a.localeCompare(b)),
    );
  }
  return Object.keys(node.children).sort((a, b) => a.localeCompare(b));
}

export function ensureDefaultValue(values: RegValue[]): RegValue[] {
  const defaultVal = values.find((v) => v.name === "");
  const rest = values.filter((v) => v.name !== "").sort((a, b) => a.name.localeCompare(b.name));
  return [defaultVal ?? { name: "", type: "REG_SZ", data: "" }, ...rest];
}

export function formatNumericDisplay(data: string, bits: 32 | 64): string {
  try {
    const clean = data.trim();
    const num = clean === "" ? 0n : BigInt(clean);
    const mask = bits === 32 ? 0xffffffffn : 0xffffffffffffffffn;
    const masked = num & mask;
    const padLen = bits === 32 ? 8 : 16;
    const hex = masked.toString(16).padStart(padLen, "0");
    return `0x${hex} (${masked.toString(10)})`;
  } catch {
    return bits === 32 ? "0x00000000 (0)" : "0x0000000000000000 (0)";
  }
}

export function formatValuePreview(val: RegValue): string {
  if (val.type === "REG_SZ" || val.type === "REG_EXPAND_SZ") {
    if (val.name === "" && val.data === "") return "(value not set)";
    return val.data;
  }
  if (val.type === "REG_MULTI_SZ") {
    return val.data.split(/\r?\n/).filter(Boolean).join(" ");
  }
  if (val.type === "REG_DWORD") {
    return formatNumericDisplay(val.data, 32);
  }
  if (val.type === "REG_QWORD") {
    return formatNumericDisplay(val.data, 64);
  }
  if (val.type === "REG_BINARY") {
    const cleaned = normalizeBinaryHex(val.data);
    return cleaned || "(zero-length binary value)";
  }
  return val.data;
}

export function normalizeBinaryHex(input: string): string {
  const hexOnly = input.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (!hexOnly) return "";
  const pairs: string[] = [];
  for (let i = 0; i < hexOnly.length; i += 2) {
    const chunk = hexOnly.slice(i, i + 2);
    pairs.push(chunk.length === 1 ? `0${chunk}` : chunk);
  }
  return pairs.join(" ");
}

export function binaryHexToAscii(hexStr: string): string {
  const pairs = normalizeBinaryHex(hexStr).split(" ").filter(Boolean);
  return pairs
    .map((pair) => {
      const code = parseInt(pair, 16);
      return code >= 32 && code <= 126 ? String.fromCharCode(code) : ".";
    })
    .join("");
}

export function serializeRegFile(root: RegKeyNode, startPath: string): string {
  const target = getNodeByPath(root, startPath);
  if (!target) return "";
  const lines: string[] = ["Windows Registry Editor Version 5.00", ""];

  const escapeRegString = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const encodeUtf16LeHex = (s: string) => {
    const bytes: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      bytes.push((code & 0xff).toString(16).padStart(2, "0"));
      bytes.push(((code >> 8) & 0xff).toString(16).padStart(2, "0"));
    }
    bytes.push("00", "00");
    return bytes.join(",");
  };

  const walk = (node: RegKeyNode, fullPath: string) => {
    const withoutComputer = fullPath.replace(/^Computer\\?/i, "");
    if (withoutComputer) {
      lines.push(`[${withoutComputer}]`);
      for (const val of ensureDefaultValue(node.values)) {
        if (val.name === "" && val.data === "" && val.type === "REG_SZ") continue;
        const keyLabel = val.name === "" ? "@" : `"${escapeRegString(val.name)}"`;
        if (val.type === "REG_SZ") {
          lines.push(`${keyLabel}="${escapeRegString(val.data)}"`);
        } else if (val.type === "REG_DWORD") {
          const num = (BigInt(val.data || "0") & 0xffffffffn).toString(16).padStart(8, "0");
          lines.push(`${keyLabel}=dword:${num}`);
        } else if (val.type === "REG_QWORD") {
          const num = BigInt(val.data || "0") & 0xffffffffffffffffn;
          const bytes: string[] = [];
          for (let b = 0n; b < 8n; b++) {
            bytes.push(((num >> (b * 8n)) & 0xffn).toString(16).padStart(2, "0"));
          }
          lines.push(`${keyLabel}=hex(b):${bytes.join(",")}`);
        } else if (val.type === "REG_BINARY") {
          const hexPairs = normalizeBinaryHex(val.data).toLowerCase().split(" ").filter(Boolean);
          lines.push(`${keyLabel}=hex:${hexPairs.join(",")}`);
        } else if (val.type === "REG_EXPAND_SZ") {
          lines.push(`${keyLabel}=hex(2):${encodeUtf16LeHex(val.data)}`);
        } else if (val.type === "REG_MULTI_SZ") {
          const multi = val.data.replace(/\r?\n/g, "\0") + "\0";
          lines.push(`${keyLabel}=hex(7):${encodeUtf16LeHex(multi)}`);
        }
      }
      lines.push("");
    }
    for (const childName of getSortedChildNames(node)) {
      const child = node.children[childName];
      if (child) {
        walk(child, `${fullPath}\\${childName}`);
      }
    }
  };

  walk(target, normalizeRegistryPath(startPath));
  return lines.join("\r\n");
}

function decodeUtf16LeHex(hexTokens: string[]): string {
  const bytes = hexTokens.map((h) => parseInt(h, 16)).filter((n) => Number.isFinite(n));
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = (bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8);
    if (code === 0) {
      out += "\n";
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out.replace(/\n+$/, "");
}

export function importRegFileIntoTree(
  root: RegKeyNode,
  content: string,
): { tree: RegKeyNode; importedKeys: number; firstKeyPath: string | null } {
  const next = cloneRegistryTree(root);
  const rawLines = content.replace(/\\\r?\n\s*/g, "").split(/\r?\n/);
  let currentKeyPath: string | null = null;
  let importedKeys = 0;
  let firstKeyPath: string | null = null;

  const ensureKeyAtPath = (fullPath: string): RegKeyNode | null => {
    const segs = getPathSegments(fullPath);
    if (segs.length < 2 || segs[0] !== "Computer") return null;
    let curr = next;
    for (let i = 1; i < segs.length; i++) {
      const seg = segs[i]!;
      const existingName = Object.keys(curr.children).find(
        (k) => k.toLowerCase() === seg.toLowerCase(),
      );
      if (existingName && curr.children[existingName]) {
        curr = curr.children[existingName]!;
      } else {
        const created = makeKey(seg);
        curr.children[seg] = created;
        curr = created;
      }
    }
    return curr;
  };

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith(";") ||
      line.startsWith("Windows Registry Editor") ||
      line === "REGEDIT4"
    ) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      const inner = line.slice(1, -1).trim();
      if (inner.startsWith("-")) continue; // delete syntax skipped safely
      const normalized = normalizeRegistryPath(inner);
      const node = ensureKeyAtPath(normalized);
      if (node) {
        currentKeyPath = normalized;
        importedKeys += 1;
        if (!firstKeyPath) firstKeyPath = normalized;
      }
      continue;
    }
    if (!currentKeyPath) continue;
    const targetNode = getNodeByPath(next, currentKeyPath);
    if (!targetNode) continue;

    let valueName: string | null = null;
    let rhs = "";
    if (line.startsWith("@=")) {
      valueName = "";
      rhs = line.slice(2).trim();
    } else if (line.startsWith('"')) {
      const match = /^"((?:\\.|[^"\\])*)"\s*=\s*(.*)$/.exec(line);
      if (match) {
        valueName = match[1]!.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        rhs = match[2]!.trim();
      }
    }
    if (valueName === null) continue;

    let parsedValue: RegValue | null = null;
    if (rhs.startsWith('"') && rhs.endsWith('"')) {
      const str = rhs.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      parsedValue = { name: valueName, type: "REG_SZ", data: str };
    } else if (rhs.toLowerCase().startsWith("dword:")) {
      const hex = rhs.slice(6).trim();
      try {
        const dec = BigInt(`0x${hex || "0"}`).toString(10);
        parsedValue = { name: valueName, type: "REG_DWORD", data: dec };
      } catch {
        parsedValue = { name: valueName, type: "REG_DWORD", data: "0" };
      }
    } else if (rhs.toLowerCase().startsWith("hex(b):")) {
      const tokens = rhs
        .slice(7)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      let num = 0n;
      for (let i = 0; i < Math.min(tokens.length, 8); i++) {
        const b = BigInt(parseInt(tokens[i]!, 16) || 0);
        num |= b << (BigInt(i) * 8n);
      }
      parsedValue = { name: valueName, type: "REG_QWORD", data: num.toString(10) };
    } else if (rhs.toLowerCase().startsWith("hex(2):")) {
      const tokens = rhs
        .slice(7)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      parsedValue = {
        name: valueName,
        type: "REG_EXPAND_SZ",
        data: decodeUtf16LeHex(tokens),
      };
    } else if (rhs.toLowerCase().startsWith("hex(7):")) {
      const tokens = rhs
        .slice(7)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      parsedValue = {
        name: valueName,
        type: "REG_MULTI_SZ",
        data: decodeUtf16LeHex(tokens),
      };
    } else if (rhs.toLowerCase().startsWith("hex:")) {
      const tokens = rhs
        .slice(4)
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      parsedValue = {
        name: valueName,
        type: "REG_BINARY",
        data: tokens.map((t) => (t.length === 1 ? `0${t}` : t)).join(" "),
      };
    }

    if (parsedValue) {
      const existingIdx = targetNode.values.findIndex(
        (v) => v.name.toLowerCase() === parsedValue!.name.toLowerCase(),
      );
      if (existingIdx >= 0) {
        targetNode.values[existingIdx] = parsedValue;
      } else {
        targetNode.values.push(parsedValue);
      }
      targetNode.values = ensureDefaultValue(targetNode.values);
    }
  }

  return { tree: next, importedKeys, firstKeyPath };
}

export function searchRegistryTree(
  root: RegKeyNode,
  query: string,
  options: {
    searchKeys: boolean;
    searchValues: boolean;
    searchData: boolean;
    matchWhole: boolean;
    startPath?: string | undefined;
    limit?: number | undefined;
  },
): RegSearchResult[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const limit = options.limit ?? 80;
  const results: RegSearchResult[] = [];

  const matches = (candidate: string) => {
    const lower = candidate.toLowerCase();
    return options.matchWhole ? lower === trimmed : lower.includes(trimmed);
  };

  const startNode = options.startPath ? getNodeByPath(root, options.startPath) : root;
  const startBasePath = options.startPath ? normalizeRegistryPath(options.startPath) : root.name;
  if (!startNode) return [];

  const visit = (node: RegKeyNode, fullPath: string) => {
    if (results.length >= limit) return;
    if (fullPath !== "Computer") {
      if (options.searchKeys && matches(node.name)) {
        results.push({
          path: fullPath,
          matchKind: "key",
          preview: fullPath,
        });
      }
      for (const val of node.values) {
        if (results.length >= limit) return;
        const displayName = val.name === "" ? "(Default)" : val.name;
        if (options.searchValues && val.name !== "" && matches(val.name)) {
          results.push({
            path: fullPath,
            matchKind: "value",
            valueName: val.name,
            preview: `${displayName} = ${formatValuePreview(val)}`,
          });
          continue;
        }
        if (options.searchData && (matches(val.data) || matches(formatValuePreview(val)))) {
          results.push({
            path: fullPath,
            matchKind: "data",
            valueName: val.name,
            preview: `${displayName} = ${formatValuePreview(val)}`,
          });
        }
      }
    }
    for (const childName of getSortedChildNames(node)) {
      if (results.length >= limit) return;
      const child = node.children[childName];
      if (child) {
        visit(child, `${fullPath}\\${childName}`);
      }
    }
  };

  visit(startNode, startBasePath);
  return results;
}

export function loadRegistryTreeFromStorage(): RegKeyNode {
  if (typeof window === "undefined") return createInitialRegistryTree();
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RegKeyNode;
      if (parsed && parsed.name === "Computer" && parsed.children) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return createInitialRegistryTree();
}

export function saveRegistryTreeToStorage(tree: RegKeyNode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(tree));
  } catch {
    // ignore quota errors
  }
}

export function loadRegistryFavorites(): string[] {
  if (typeof window === "undefined") return DEFAULT_FAVORITES;
  try {
    const raw = localStorage.getItem(REGISTRY_FAVORITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_FAVORITES;
}

export function saveRegistryFavorites(favorites: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REGISTRY_FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // ignore
  }
}
