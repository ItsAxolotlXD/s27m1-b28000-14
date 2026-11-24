import { describe, it, expect } from "vitest";
import {
  WINUI_TEMPLATES,
  WINUI_GALLERY_TOOLBOX,
  DEFAULT_VISUAL_CANVAS,
  createProjectFromTemplate,
  parseWinUIMarkup,
  compileWinUILogic,
  resolveBindingExpression,
  buildWinUIProject,
  astToVisualElements,
  visualElementsToWinUIMarkup,
  generateStandaloneVisualHtml,
} from "./winuiFrameworkEngine";
import {
  getInstalledAppIdFromRoute,
  installedWinUIAppRoute,
  installedWinUIStartAppId,
} from "../services/installedWinUIAppsStore";

describe("winuiFrameworkEngine", () => {
  it("builds every built-in starter template cleanly with zero errors", () => {
    for (const tpl of WINUI_TEMPLATES) {
      const proj = createProjectFromTemplate(tpl.id);
      const res = buildWinUIProject(proj);
      const errors = res.diagnostics.filter((d) => d.severity === "error");
      expect(errors).toEqual([]);
      expect(res.success).toBe(true);
      expect(res.controlCount).toBeGreaterThan(0);
      expect(res.exportedHtml).toContain("<!DOCTYPE html>");
    }
  });

  it("reports line-accurate errors on mismatched or unclosed markup tags", () => {
    const markup = `<Page>\n  <StackPanel Spacing="12">\n    <Button Content="Click" />\n  </Grid>\n</Page>`;
    const { diagnostics } = parseWinUIMarkup(markup);
    expect(diagnostics.some((d) => d.severity === "error" && d.line === 4)).toBe(true);
  });

  it("compiles exported logic handlers and runs state updates safely", () => {
    const logic = `
      export const initialState = { count: 2 };
      export function addThree(state, setState, log) {
        setState({ count: state.count + 3 });
        log("added");
      }
    `;
    const compiled = compileWinUILogic(logic);
    expect(compiled.error).toBeNull();
    expect(compiled.initialState["count"]).toBe(2);
    expect(compiled.handlerNames).toContain("addThree");

    let current = { ...compiled.initialState };
    const logs: string[] = [];
    compiled.handlers["addThree"]!(
      current,
      (patch) => {
        current = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      },
      (m) => logs.push(m),
    );
    expect(current["count"]).toBe(5);
    expect(logs).toEqual(["added"]);
  });

  it("resolves typed bindings and interpolated strings", () => {
    const state = { count: 4, label: "Sparkle", enabled: true };
    expect(resolveBindingExpression("{state.enabled}", state)).toBe(true);
    expect(resolveBindingExpression("{state.count * 2}", state)).toBe(8);
    expect(resolveBindingExpression("App: {state.label} ({state.count})", state)).toBe(
      "App: Sparkle (4)",
    );
  });

  it("warns when UI references a handler missing from App.logic.js", () => {
    const proj = createProjectFromTemplate("blank-app");
    const ui = proj.files.find((f) => f.kind === "ui")!;
    ui.content = `<Page><Button Content="Run" OnClick="missingFn" /></Page>`;
    const res = buildWinUIProject(proj);
    expect(res.success).toBe(true);
    expect(
      res.diagnostics.some((d) => d.severity === "warning" && d.message.includes("missingFn")),
    ).toBe(true);
  });

  it("exposes 20 WinUI 3 Gallery visual toolbox controls and converts AST <-> visual elements cleanly", () => {
    expect(WINUI_GALLERY_TOOLBOX.length).toBe(20);
    const proj = createProjectFromTemplate("control-gallery");
    const ui = proj.files.find((f) => f.kind === "ui")!;
    const parsed = parseWinUIMarkup(ui.content);
    const elements = astToVisualElements(parsed.nodes);
    expect(elements.length).toBeGreaterThan(5);

    const generated = visualElementsToWinUIMarkup(elements, DEFAULT_VISUAL_CANVAS, proj.name);
    const reparsed = parseWinUIMarkup(generated);
    expect(reparsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);

    const html = generateStandaloneVisualHtml("My Visual App", DEFAULT_VISUAL_CANVAS, elements);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("My Visual App");
  });

  it("builds and parses installed WinUI Start Menu app routes", () => {
    const route = installedWinUIAppRoute("my-tool-1");
    expect(route).toBe("/winui-app/my-tool-1");
    expect(getInstalledAppIdFromRoute(`${route}?tab=1`)).toBe("my-tool-1");
    expect(getInstalledAppIdFromRoute("/settings")).toBeNull();
    expect(installedWinUIStartAppId("my-tool-1")).toBe("winui-custom-my-tool-1");
  });
});
