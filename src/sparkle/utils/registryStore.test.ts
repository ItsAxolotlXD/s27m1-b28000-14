import { describe, expect, it } from "vitest";
import {
  createInitialRegistryTree,
  formatValuePreview,
  getNodeByPath,
  importRegFileIntoTree,
  normalizeRegistryPath,
  searchRegistryTree,
  serializeRegFile,
} from "./registryStore";

describe("registryStore", () => {
  it("normalizes hive aliases and slashes", () => {
    expect(normalizeRegistryPath("HKCU/Software/SparkleOS/")).toBe(
      "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS",
    );
    expect(normalizeRegistryPath("hklm\\SOFTWARE\\Microsoft")).toBe(
      "Computer\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft",
    );
    expect(normalizeRegistryPath("")).toBe("Computer");
  });

  it("formats DWORD and QWORD values cleanly", () => {
    expect(formatValuePreview({ name: "AppsUseLightTheme", type: "REG_DWORD", data: "1" })).toBe(
      "0x00000001 (1)",
    );
    expect(formatValuePreview({ name: "TestQword", type: "REG_QWORD", data: "255" })).toBe(
      "0x00000000000000ff (255)",
    );
  });

  it("exports and re-imports .reg files across types", () => {
    const tree = createInitialRegistryTree();
    const targetPath = "Computer\\HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion\\Desktop";
    const exported = serializeRegFile(tree, targetPath);
    expect(exported).toContain("Windows Registry Editor Version 5.00");
    expect(exported).toContain("[HKEY_CURRENT_USER\\Software\\SparkleOS\\CurrentVersion\\Desktop]");
    expect(exported).toContain('"WindowsMode"=dword:00000001');

    const { tree: imported, importedKeys } = importRegFileIntoTree(
      createInitialRegistryTree(),
      [
        "Windows Registry Editor Version 5.00",
        "",
        "[HKEY_CURRENT_USER\\Software\\CustomTest]",
        '@="DefaultText"',
        '"Count"=dword:0000002a',
        '"Flag"=hex:0a,ff,12',
      ].join("\r\n"),
    );

    expect(importedKeys).toBe(1);
    const node = getNodeByPath(imported, "HKCU\\Software\\CustomTest");
    expect(node).not.toBeNull();
    expect(node?.values.find((v) => v.name === "")?.data).toBe("DefaultText");
    expect(node?.values.find((v) => v.name === "Count")?.data).toBe("42");
    expect(node?.values.find((v) => v.name === "Flag")?.data).toBe("0A FF 12");
  });

  it("searches across keys, values, and data", () => {
    const tree = createInitialRegistryTree();
    const results = searchRegistryTree(tree, "AppsUseLightTheme", {
      searchKeys: true,
      searchValues: true,
      searchData: true,
      matchWhole: false,
    });
    expect(results.some((r) => r.valueName === "AppsUseLightTheme")).toBe(true);
  });
});
