import React from "react";
import {
  Calculator,
  CheckSquare,
  Clock,
  Compass,
  Layers,
  Monitor,
  Package,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Star,
  Terminal,
} from "lucide-react";
import {
  useInstalledWinUIApps,
  getInstalledAppIdFromRoute,
  type WinUIAppIconKey,
} from "../services/installedWinUIAppsStore";

function renderGlyph(iconKey: WinUIAppIconKey): React.ReactNode {
  const cls = "w-[56%] h-[56%] text-white drop-shadow-xs";
  switch (iconKey) {
    case "sparkles":
      return <Sparkles className={cls} />;
    case "check":
      return <CheckSquare className={cls} />;
    case "sliders":
      return <SlidersHorizontal className={cls} />;
    case "monitor":
      return <Monitor className={cls} />;
    case "palette":
      return <Palette className={cls} />;
    case "terminal":
      return <Terminal className={cls} />;
    case "compass":
      return <Compass className={cls} />;
    case "clock":
      return <Clock className={cls} />;
    case "star":
      return <Star className={cls} />;
    case "package":
      return <Package className={cls} />;
    case "calculator":
      return <Calculator className={cls} />;
    case "layers":
    default:
      return <Layers className={cls} />;
  }
}

export const InstalledWinUIAppBadge: React.FC<{
  iconKey: WinUIAppIconKey;
  accentColor: string;
  className?: string;
}> = ({ iconKey, accentColor, className = "w-8 h-8" }) => {
  const safeColor = accentColor || "#0067b8";
  return (
    <div
      style={{
        background: `linear-gradient(145deg, ${safeColor}, color-mix(in srgb, ${safeColor} 68%, #090d16))`,
      }}
      className={`${className} rounded-[24%] shrink-0 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.22)] ring-1 ring-inset ring-white/25 relative overflow-hidden`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/15 pointer-events-none"
      />
      <span className="relative z-10 w-full h-full flex items-center justify-center">
        {renderGlyph(iconKey)}
      </span>
    </div>
  );
};

export const InstalledWinUIAppRouteIcon: React.FC<{
  route: string;
  className?: string;
}> = ({ route, className = "w-6 h-6 shrink-0" }) => {
  const apps = useInstalledWinUIApps();
  const appId = getInstalledAppIdFromRoute(route);
  const app = appId ? apps.find((a) => a.id === appId) : undefined;
  return (
    <InstalledWinUIAppBadge
      iconKey={app?.iconKey ?? "layers"}
      accentColor={app?.accentColor ?? "#0067b8"}
      className={className}
    />
  );
};
