import React, { useMemo, useState } from "react";
import { Code2, Home, Layers } from "lucide-react";
import { WinUIRuntimePreview } from "../components/WinUIRuntimePreview";
import { WinUIVisualRuntime } from "../components/WinUIVisualRuntime";
import { useInstalledWinUIApps, type VisualElement } from "../services/installedWinUIAppsStore";
import { DEFAULT_VISUAL_CANVAS, buildWinUIProject } from "../utils/winuiFrameworkEngine";

interface InstalledWinUIAppRunnerProps {
  appId: string;
  navigate?: (route: string, state?: unknown) => void;
}

export const InstalledWinUIAppRunner: React.FC<InstalledWinUIAppRunnerProps> = ({
  appId,
  navigate,
}) => {
  const apps = useInstalledWinUIApps();
  const app = useMemo(() => apps.find((a) => a.id === appId), [apps, appId]);

  const built = useMemo(() => (app ? buildWinUIProject(app.projectSnapshot) : null), [app]);

  const [runtimeState, setRuntimeState] = useState<Record<string, unknown>>(() =>
    built ? { ...built.initialState } : {},
  );

  if (!app || !built) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#f5f6f8] dark:bg-[#1e2127] text-[#18181b] dark:text-[#f4f4f5]">
        <Layers className="w-10 h-10 text-[#0067b8] dark:text-[#4cc2ff] mb-3" />
        <h1 className="text-[17px] font-semibold">App not installed</h1>
        <p className="text-[13px] opacity-65 mt-1 max-w-sm">
          This WinUI app may have been uninstalled or removed from this browser&apos;s storage.
        </p>
        {navigate && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/winui-framework")}
              className="h-8 px-3.5 rounded-[6px] bg-[#0067b8] dark:bg-[#4cc2ff] text-white dark:text-black text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Open WinUI Framework</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="h-8 px-3 rounded-[6px] border border-black/15 dark:border-white/15 text-[12.5px] font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (app.mode === "visual" && app.visualElements) {
    const handleRunHandler = (handlerName: string, _element: VisualElement) => {
      const fn = built.handlers[handlerName.trim()];
      if (!fn) return;
      fn(
        runtimeState,
        (patch) =>
          setRuntimeState((prev) =>
            typeof patch === "function" ? patch(prev) : { ...prev, ...patch },
          ),
        () => {},
      );
    };

    return (
      <div className="w-full h-full overflow-hidden">
        <WinUIVisualRuntime
          appName={app.name}
          canvas={app.visualCanvas ?? DEFAULT_VISUAL_CANVAS}
          elements={app.visualElements}
          fillContainer
          onRunHandler={handleRunHandler}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <WinUIRuntimePreview
        build={built}
        state={runtimeState}
        onUpdateState={(patch) =>
          setRuntimeState((prev) =>
            typeof patch === "function" ? patch(prev) : { ...prev, ...patch },
          )
        }
        onLog={() => {}}
      />
    </div>
  );
};
