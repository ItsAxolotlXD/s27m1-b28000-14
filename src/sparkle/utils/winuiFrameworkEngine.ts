import type {
  VisualAction,
  VisualCanvasConfig,
  VisualElement,
  VisualElementProps,
  VisualElementType,
} from "../services/installedWinUIAppsStore";

export type WinUIFileKind = "ui" | "logic" | "manifest";

export interface WinUIProjectFile {
  id: string;
  name: string;
  kind: WinUIFileKind;
  content: string;
}

export interface WinUIManifest {
  name: string;
  version: string;
  publisher: string;
  targetBuild: string;
  theme: "system" | "light" | "dark";
  backdrop: "mica" | "acrylic" | "solid";
  windowTitle: string;
}

export interface WinUIProject {
  id: string;
  name: string;
  description: string;
  templateId: string;
  files: WinUIProjectFile[];
  visualDesign?: {
    canvas: VisualCanvasConfig;
    elements: VisualElement[];
  };
  updatedAt: number;
}

export interface WinUINode {
  tag: string;
  props: Record<string, string>;
  children: WinUINode[];
  textContent: string;
  line: number;
  column: number;
}

export interface BuildDiagnostic {
  id: string;
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  message: string;
}

export type WinUILogFn = (message: string) => void;
export type WinUISetStateFn = (
  patch: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>),
) => void;
export type WinUIHandlerFn = (
  state: Record<string, unknown>,
  setState: WinUISetStateFn,
  log: WinUILogFn,
  payload?: unknown,
) => void;

export interface BuildResult {
  success: boolean;
  timestamp: number;
  durationMs: number;
  controlCount: number;
  bundleSizeBytes: number;
  ast: WinUINode[];
  manifest: WinUIManifest;
  initialState: Record<string, unknown>;
  handlers: Record<string, WinUIHandlerFn>;
  handlerNames: string[];
  diagnostics: BuildDiagnostic[];
  exportedHtml: string;
}

export interface WinUITemplate {
  id: string;
  name: string;
  category: "Workspace" | "Showcase" | "Utility" | "Starter";
  description: string;
  files: WinUIProjectFile[];
}

export interface WinUIControlDoc {
  tag: string;
  category: "Navigation" | "Layout" | "Input" | "Status" | "Collections";
  summary: string;
  props: string[];
  snippet: string;
}

export const SUPPORTED_WINUI_TAGS = new Set([
  "Page",
  "NavigationView",
  "NavigationViewItem",
  "StackPanel",
  "Grid",
  "Card",
  "Expander",
  "TextBlock",
  "Button",
  "HyperlinkButton",
  "ToggleSwitch",
  "Slider",
  "TextBox",
  "NumberBox",
  "CheckBox",
  "ComboBox",
  "InfoBar",
  "ProgressRing",
  "ProgressBar",
  "ListView",
  "Divider",
  "Badge",
  "RatingControl",
  "CalendarDatePicker",
  "ImageCard",
]);

const EVENT_ATTRS = new Set(["OnClick", "OnToggled", "OnChanged", "OnItemClick", "OnSubmit"]);

export const WINUI_CONTROL_DOCS: WinUIControlDoc[] = [
  {
    tag: "NavigationView",
    category: "Navigation",
    summary: "WinUI 3 hamburger sidebar shell with collapsible menu items and active indicator.",
    props: ["Title", "SelectedTag", "OnSelectTag"],
    snippet: `<NavigationView Title="My App" SelectedTag="{state.tab}" OnSelectTag="setTab">
  <NavigationViewItem Icon="Home" Label="Overview" Tag="overview" />
  <NavigationViewItem Icon="Settings" Label="Settings" Tag="settings" />
  <StackPanel Spacing="12" Padding="16">
    <TextBlock Text="Active section: {state.tab}" Style="Subtitle" />
  </StackPanel>
</NavigationView>`,
  },
  {
    tag: "Button",
    category: "Input",
    summary: "Fluent action button supporting Accent, Standard, Subtle, and Danger styles.",
    props: ["Content", "Style", "OnClick", "Disabled"],
    snippet: `<StackPanel Orientation="Horizontal" Spacing="8">
  <Button Content="Primary Action" Style="Accent" OnClick="handleAction" />
  <Button Content="Secondary" Style="Standard" OnClick="handleReset" />
</StackPanel>`,
  },
  {
    tag: "ToggleSwitch",
    category: "Input",
    summary: "Two-state Fluent switch bound directly to boolean state and toggle handler.",
    props: ["Header", "IsOn", "OnContent", "OffContent", "OnToggled"],
    snippet: `<ToggleSwitch Header="Enable Mica Surface" IsOn="{state.enableMica}" OnContent="Enabled" OffContent="Disabled" OnToggled="toggleMica" />`,
  },
  {
    tag: "Slider",
    category: "Input",
    summary: "Continuous range control with live numeric readout and change callback.",
    props: ["Header", "Minimum", "Maximum", "Value", "OnChanged"],
    snippet: `<Slider Header="Render Quality" Minimum="0" Maximum="100" Value="{state.quality}" OnChanged="updateQuality" />`,
  },
  {
    tag: "TextBox",
    category: "Input",
    summary: "Single-line WinUI text field with bottom accent focus bar and enter submit.",
    props: ["Header", "PlaceholderText", "Text", "OnChanged", "OnSubmit"],
    snippet: `<TextBox Header="Workspace Name" PlaceholderText="Enter project name..." Text="{state.title}" OnChanged="updateTitle" />`,
  },
  {
    tag: "ComboBox",
    category: "Input",
    summary: "Fluent dropdown selector populated from a comma-separated list or state array.",
    props: ["Header", "Items", "Selected", "OnChanged"],
    snippet: `<ComboBox Header="Deployment Channel" Items="Canary,Dev,Beta,Release" Selected="{state.channel}" OnChanged="updateChannel" />`,
  },
  {
    tag: "InfoBar",
    category: "Status",
    summary: "Contextual notification banner for Informational, Success, Warning, or Error states.",
    props: ["Severity", "Title", "Message", "IsOpen"],
    snippet: `<InfoBar Severity="Success" Title="Build Verified" Message="{state.statusMessage}" IsOpen="true" />`,
  },
  {
    tag: "ProgressBar",
    category: "Status",
    summary: "Determinate or indeterminate progress indicator paired with ProgressRing.",
    props: ["Value", "Maximum", "Label"],
    snippet: `<StackPanel Spacing="10">
  <ProgressBar Label="Completion" Value="{state.progress}" Maximum="100" />
  <ProgressRing IsActive="true" Size="28" Label="Syncing workspace..." />
</StackPanel>`,
  },
  {
    tag: "Expander",
    category: "Layout",
    summary: "Collapsible WinUI settings card that reveals secondary options on click.",
    props: ["Header", "Subtitle", "IsExpanded"],
    snippet: `<Expander Header="Advanced Diagnostics" Subtitle="Configure runtime telemetry and trace levels" IsExpanded="true">
  <CheckBox Content="Capture click events" IsChecked="{state.traceClicks}" OnChanged="toggleTrace" />
</Expander>`,
  },
  {
    tag: "ListView",
    category: "Collections",
    summary: "Interactive list bound to state arrays supporting selection and item actions.",
    props: ["Items", "EmptyText", "OnItemClick"],
    snippet: `<ListView Items="{state.tasks}" EmptyText="No items yet" OnItemClick="toggleTask" />`,
  },
  {
    tag: "Card",
    category: "Layout",
    summary: "Elevated Fluent surface container for grouping controls cleanly.",
    props: ["Title", "Subtitle", "Padding"],
    snippet: `<Card Title="Summary" Subtitle="Real-time WinUI 3 surface" Padding="16">
  <TextBlock Text="All systems nominal." Style="Body" />
</Card>`,
  },
  {
    tag: "Grid",
    category: "Layout",
    summary: "Responsive multi-column CSS grid layout for metric tiles and split panels.",
    props: ["Columns", "Gap"],
    snippet: `<Grid Columns="2" Gap="12">
  <Card Title="Active Tasks"><TextBlock Text="{state.tasks.length}" Style="Title" /></Card>
  <Card Title="Build Target"><TextBlock Text="28000.14" Style="Title" /></Card>
</Grid>`,
  },
];

export const WINUI_TEMPLATES: WinUITemplate[] = [
  {
    id: "task-hub",
    name: "Fluent Task Hub",
    category: "Workspace",
    description:
      "Multi-page NavigationView application with interactive task list, progress bar, and live settings.",
    files: [
      {
        id: "ui",
        name: "App.winui",
        kind: "ui",
        content: `<Page>
  <NavigationView Title="Fluent Task Hub" SelectedTag="{state.activeTab}" OnSelectTag="switchTab">
    <NavigationViewItem Icon="Home" Label="Overview" Tag="overview" />
    <NavigationViewItem Icon="Check" Label="Tasks" Tag="tasks" />
    <NavigationViewItem Icon="Settings" Label="Preferences" Tag="settings" />

    <StackPanel Spacing="16" Padding="20">
      <InfoBar
        Severity="{state.bannerSeverity}"
        Title="Workspace Status"
        Message="{state.statusMessage}"
        IsOpen="true"
      />

      <Grid Columns="3" Gap="12">
        <Card Title="Open Tasks" Subtitle="Remaining items">
          <TextBlock Text="{state.remainingCount}" Style="Title" />
        </Card>
        <Card Title="Completed" Subtitle="Finished items">
          <TextBlock Text="{state.completedCount}" Style="Title" />
        </Card>
        <Card Title="Progress" Subtitle="Sprint velocity">
          <ProgressBar Value="{state.completionPct}" Maximum="100" />
        </Card>
      </Grid>

      <Card Title="Quick Task Entry" Subtitle="Add items directly into the WinUI ListView">
        <StackPanel Spacing="12">
          <StackPanel Orientation="Horizontal" Spacing="8">
            <TextBox
              PlaceholderText="Type a new task title..."
              Text="{state.draftTask}"
              OnChanged="updateDraftTask"
              OnSubmit="addTask"
            />
            <Button Content="Add Task" Style="Accent" OnClick="addTask" />
            <Button Content="Clear Done" Style="Standard" OnClick="clearCompleted" />
          </StackPanel>
          <ListView Items="{state.tasks}" EmptyText="All tasks cleared." OnItemClick="toggleTask" />
        </StackPanel>
      </Card>

      <Expander Header="Runtime Appearance" Subtitle="Adjust live WinUI surface parameters" IsExpanded="true">
        <StackPanel Spacing="12">
          <ToggleSwitch
            Header="Highlight Priority Items"
            IsOn="{state.highlightMode}"
            OnContent="Active"
            OffContent="Standard"
            OnToggled="toggleHighlight"
          />
          <Slider
            Header="Surface Density"
            Minimum="20"
            Maximum="100"
            Value="{state.density}"
            OnChanged="updateDensity"
          />
        </StackPanel>
      </Expander>
    </StackPanel>
  </NavigationView>
</Page>`,
      },
      {
        id: "logic",
        name: "App.logic.js",
        kind: "logic",
        content: `export const initialState = {
  activeTab: "overview",
  bannerSeverity: "Informational",
  statusMessage: "Fluent Task Hub compiled on SparkleOS Build 28000.14",
  draftTask: "",
  highlightMode: true,
  density: 80,
  tasks: [
    { id: "t1", label: "Design NavigationView shell", done: true },
    { id: "t2", label: "Connect live state handlers", done: false },
    { id: "t3", label: "Package standalone WinUI app", done: false },
  ],
  remainingCount: 2,
  completedCount: 1,
  completionPct: 33,
};

function recomputeStats(tasks) {
  const completedCount = tasks.filter((t) => t.done).length;
  const remainingCount = tasks.length - completedCount;
  const completionPct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  return { remainingCount, completedCount, completionPct };
}

export function switchTab(state, setState, log, tag) {
  setState({
    activeTab: tag,
    statusMessage: "Switched NavigationView section to " + tag,
  });
  log("NavigationView -> " + tag);
}

export function updateDraftTask(state, setState, _log, value) {
  setState({ draftTask: value });
}

export function addTask(state, setState, log) {
  const title = String(state.draftTask || "").trim();
  if (!title) {
    setState({
      bannerSeverity: "Warning",
      statusMessage: "Enter a task title before adding.",
    });
    return;
  }
  const nextTasks = [
    ...state.tasks,
    { id: "t-" + Date.now(), label: title, done: false },
  ];
  setState({
    tasks: nextTasks,
    draftTask: "",
    bannerSeverity: "Success",
    statusMessage: "Added task: " + title,
    ...recomputeStats(nextTasks),
  });
  log("Added task: " + title);
}

export function toggleTask(state, setState, log, item) {
  const nextTasks = state.tasks.map((t) =>
    t.id === item.id ? { ...t, done: !t.done } : t,
  );
  setState({
    tasks: nextTasks,
    bannerSeverity: "Informational",
    statusMessage: "Updated task: " + item.label,
    ...recomputeStats(nextTasks),
  });
  log("Toggled task: " + item.label);
}

export function clearCompleted(state, setState, log) {
  const nextTasks = state.tasks.filter((t) => !t.done);
  setState({
    tasks: nextTasks,
    bannerSeverity: "Success",
    statusMessage: "Cleared completed tasks.",
    ...recomputeStats(nextTasks),
  });
  log("Cleared completed tasks");
}

export function toggleHighlight(state, setState, log, nextVal) {
  setState({
    highlightMode: nextVal,
    statusMessage: nextVal ? "Priority highlight enabled" : "Standard list rendering",
  });
  log("Highlight mode: " + nextVal);
}

export function updateDensity(state, setState, _log, nextVal) {
  setState({ density: Number(nextVal) });
}`,
      },
      {
        id: "manifest",
        name: "App.manifest.json",
        kind: "manifest",
        content: JSON.stringify(
          {
            name: "Fluent Task Hub",
            version: "1.0.0",
            publisher: "SparkleOS Developer",
            targetBuild: "28000.14",
            theme: "system",
            backdrop: "mica",
            windowTitle: "Fluent Task Hub — WinUI 3",
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    id: "control-playground",
    name: "WinUI 3 Control Lab",
    category: "Showcase",
    description:
      "Interactive playground combining Buttons, Sliders, ComboBox, ProgressRing, and InfoBar.",
    files: [
      {
        id: "ui",
        name: "App.winui",
        kind: "ui",
        content: `<Page>
  <NavigationView Title="Control Lab" SelectedTag="{state.section}" OnSelectTag="selectSection">
    <NavigationViewItem Icon="Layers" Label="Controls" Tag="controls" />
    <NavigationViewItem Icon="Sliders" Label="Feedback" Tag="feedback" />

    <StackPanel Spacing="16" Padding="20">
      <TextBlock Text="WinUI 3 Control Composition" Style="Title" />
      <TextBlock Text="Test interactive Fluent states and bind controls directly to App.logic.js." Style="Caption" />

      <Grid Columns="2" Gap="12">
        <Card Title="Interactive Counter" Subtitle="Trigger Accent & Subtle actions">
          <StackPanel Spacing="12">
            <TextBlock Text="{state.countLabel}" Style="Subtitle" />
            <StackPanel Orientation="Horizontal" Spacing="8">
              <Button Content="Increment +1" Style="Accent" OnClick="increment" />
              <Button Content="Double x2" Style="Standard" OnClick="doubleCount" />
              <Button Content="Reset" Style="Subtle" OnClick="resetCount" />
            </StackPanel>
          </StackPanel>
        </Card>

        <Card Title="System Progress" Subtitle="Live ProgressRing & ProgressBar">
          <StackPanel Spacing="12">
            <ProgressBar Label="Build Pipeline" Value="{state.progress}" Maximum="100" />
            <StackPanel Orientation="Horizontal" Spacing="12">
              <ProgressRing IsActive="{state.spinnerActive}" Size="28" Label="{state.spinnerText}" />
              <ToggleSwitch Header="Spinner" IsOn="{state.spinnerActive}" OnToggled="toggleSpinner" />
            </StackPanel>
          </StackPanel>
        </Card>
      </Grid>

      <Card Title="Form & Selection Controls" Subtitle="ComboBox, Slider, CheckBox & TextBox">
        <StackPanel Spacing="12">
          <Grid Columns="2" Gap="12">
            <TextBox Header="App Greeting" PlaceholderText="Enter greeting..." Text="{state.greeting}" OnChanged="updateGreeting" />
            <ComboBox Header="Release Ring" Items="Canary,Dev,Beta,Retail" Selected="{state.ring}" OnChanged="updateRing" />
          </Grid>
          <Slider Header="Progress Percentage" Minimum="0" Maximum="100" Value="{state.progress}" OnChanged="updateProgress" />
          <CheckBox Content="Include telemetry verification" IsChecked="{state.telemetry}" OnChanged="toggleTelemetry" />
        </StackPanel>
      </Card>

      <InfoBar Severity="Success" Title="{state.ring}" Message="{state.greeting}" IsOpen="true" />
    </StackPanel>
  </NavigationView>
</Page>`,
      },
      {
        id: "logic",
        name: "App.logic.js",
        kind: "logic",
        content: `export const initialState = {
  section: "controls",
  count: 1,
  countLabel: "Current count: 1",
  progress: 65,
  spinnerActive: true,
  spinnerText: "Running async worker",
  greeting: "Welcome to WinUI 3 Control Lab",
  ring: "Dev",
  telemetry: true,
};

export function selectSection(_state, setState, log, tag) {
  setState({ section: tag });
  log("Selected section: " + tag);
}

export function increment(state, setState, log) {
  const next = state.count + 1;
  setState({ count: next, countLabel: "Current count: " + next });
  log("Count incremented -> " + next);
}

export function doubleCount(state, setState, log) {
  const next = state.count * 2;
  setState({ count: next, countLabel: "Current count: " + next });
  log("Count doubled -> " + next);
}

export function resetCount(_state, setState, log) {
  setState({ count: 0, countLabel: "Current count: 0" });
  log("Count reset");
}

export function toggleSpinner(_state, setState, log, val) {
  setState({
    spinnerActive: val,
    spinnerText: val ? "Running async worker" : "Worker paused",
  });
  log("Spinner active: " + val);
}

export function updateGreeting(_state, setState, _log, val) {
  setState({ greeting: val });
}

export function updateRing(_state, setState, log, val) {
  setState({ ring: val });
  log("Release ring -> " + val);
}

export function updateProgress(_state, setState, _log, val) {
  setState({ progress: Number(val) });
}

export function toggleTelemetry(_state, setState, log, val) {
  setState({ telemetry: val });
  log("Telemetry: " + val);
}`,
      },
      {
        id: "manifest",
        name: "App.manifest.json",
        kind: "manifest",
        content: JSON.stringify(
          {
            name: "WinUI 3 Control Lab",
            version: "2.1.0",
            publisher: "Sparkle UI Studio",
            targetBuild: "28000.14",
            theme: "system",
            backdrop: "mica",
            windowTitle: "Control Lab — WinUI Framework",
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    id: "settings-app",
    name: "System Settings App",
    category: "Utility",
    description:
      "Windows 11 Settings-style layout with NavigationView sections, Expanders, and Toggles.",
    files: [
      {
        id: "ui",
        name: "App.winui",
        kind: "ui",
        content: `<Page>
  <NavigationView Title="Device Settings" SelectedTag="{state.category}" OnSelectTag="selectCategory">
    <NavigationViewItem Icon="Monitor" Label="Display" Tag="display" />
    <NavigationViewItem Icon="Shield" Label="Security" Tag="security" />
    <NavigationViewItem Icon="Sparkles" Label="Personalization" Tag="personalization" />

    <StackPanel Spacing="14" Padding="20">
      <TextBlock Text="System & Display Configuration" Style="Title" />
      <InfoBar Severity="Informational" Title="Active Profile" Message="{state.profileSummary}" IsOpen="true" />

      <Expander Header="Display Brightness & Scale" Subtitle="Adjust output luminance and DPI scale" IsExpanded="true">
        <StackPanel Spacing="12">
          <Slider Header="Brightness" Minimum="10" Maximum="100" Value="{state.brightness}" OnChanged="setBrightness" />
          <ComboBox Header="UI Scale" Items="100%,125%,150%,175%" Selected="{state.scale}" OnChanged="setScale" />
          <ToggleSwitch Header="Night Light Filter" IsOn="{state.nightLight}" OnToggled="toggleNightLight" />
        </StackPanel>
      </Expander>

      <Expander Header="Privacy & Protection" Subtitle="Manage firewall and automatic updates" IsExpanded="true">
        <StackPanel Spacing="10">
          <CheckBox Content="Enable automatic Windows security updates" IsChecked="{state.autoUpdate}" OnChanged="toggleAutoUpdate" />
          <CheckBox Content="Require passkey on sign-in" IsChecked="{state.passkey}" OnChanged="togglePasskey" />
          <StackPanel Orientation="Horizontal" Spacing="8">
            <Button Content="Apply Settings" Style="Accent" OnClick="applyConfig" />
            <Button Content="Restore Defaults" Style="Standard" OnClick="restoreDefaults" />
          </StackPanel>
        </StackPanel>
      </Expander>
    </StackPanel>
  </NavigationView>
</Page>`,
      },
      {
        id: "logic",
        name: "App.logic.js",
        kind: "logic",
        content: `export const initialState = {
  category: "display",
  brightness: 85,
  scale: "125%",
  nightLight: false,
  autoUpdate: true,
  passkey: true,
  profileSummary: "Display: 85% brightness at 125% scale",
};

export function selectCategory(_state, setState, log, tag) {
  setState({ category: tag });
  log("Category -> " + tag);
}

export function setBrightness(state, setState, _log, val) {
  const num = Number(val);
  setState({
    brightness: num,
    profileSummary: "Display: " + num + "% brightness at " + state.scale + " scale",
  });
}

export function setScale(state, setState, log, val) {
  setState({
    scale: val,
    profileSummary: "Display: " + state.brightness + "% brightness at " + val + " scale",
  });
  log("Scale -> " + val);
}

export function toggleNightLight(_state, setState, log, val) {
  setState({ nightLight: val });
  log("Night Light: " + val);
}

export function toggleAutoUpdate(_state, setState, _log, val) {
  setState({ autoUpdate: val });
}

export function togglePasskey(_state, setState, _log, val) {
  setState({ passkey: val });
}

export function applyConfig(state, setState, log) {
  setState({
    profileSummary: "Saved profile (" + state.brightness + "%, " + state.scale + ")",
  });
  log("Configuration applied");
}

export function restoreDefaults(_state, setState, log) {
  setState({
    brightness: 85,
    scale: "125%",
    nightLight: false,
    autoUpdate: true,
    passkey: true,
    profileSummary: "Restored default system settings",
  });
  log("Defaults restored");
}`,
      },
      {
        id: "manifest",
        name: "App.manifest.json",
        kind: "manifest",
        content: JSON.stringify(
          {
            name: "Device Settings App",
            version: "1.2.0",
            publisher: "SparkleOS Shell",
            targetBuild: "28000.14",
            theme: "system",
            backdrop: "mica",
            windowTitle: "Device Settings",
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    id: "system-monitor",
    name: "Resource Diagnostics",
    category: "Utility",
    description:
      "Developer diagnostics panel featuring grid metrics, workload sliders, and build status.",
    files: [
      {
        id: "ui",
        name: "App.winui",
        kind: "ui",
        content: `<Page>
  <StackPanel Spacing="16" Padding="20">
    <TextBlock Text="Resource Diagnostics" Style="Title" />
    <TextBlock Text="Simulate workload spikes and verify WinUI reactive data bindings." Style="Caption" />

    <Grid Columns="3" Gap="12">
      <Card Title="CPU Load" Subtitle="Logical cores">
        <StackPanel Spacing="8">
          <TextBlock Text="{state.cpuLabel}" Style="Subtitle" />
          <ProgressBar Value="{state.cpu}" Maximum="100" />
        </StackPanel>
      </Card>
      <Card Title="Memory" Subtitle="Committed pool">
        <StackPanel Spacing="8">
          <TextBlock Text="{state.memLabel}" Style="Subtitle" />
          <ProgressBar Value="{state.memory}" Maximum="100" />
        </StackPanel>
      </Card>
      <Card Title="Health Status" Subtitle="Diagnostics agent">
        <StackPanel Orientation="Horizontal" Spacing="10">
          <ProgressRing IsActive="{state.scanning}" Size="26" />
          <TextBlock Text="{state.healthText}" Style="Body" />
        </StackPanel>
      </Card>
    </Grid>

    <Card Title="Simulation Controls" Subtitle="Tune load thresholds">
      <StackPanel Spacing="12">
        <Slider Header="Simulated CPU %" Minimum="5" Maximum="100" Value="{state.cpu}" OnChanged="updateCpu" />
        <Slider Header="Simulated Memory %" Minimum="10" Maximum="100" Value="{state.memory}" OnChanged="updateMem" />
        <StackPanel Orientation="Horizontal" Spacing="8">
          <Button Content="Run Stress Spike" Style="Accent" OnClick="spikeLoad" />
          <Button Content="Normalize" Style="Standard" OnClick="normalizeLoad" />
        </StackPanel>
      </StackPanel>
    </Card>

    <InfoBar Severity="{state.alertSeverity}" Title="Threshold Monitor" Message="{state.alertMessage}" IsOpen="true" />
  </StackPanel>
</Page>`,
      },
      {
        id: "logic",
        name: "App.logic.js",
        kind: "logic",
        content: `export const initialState = {
  cpu: 28,
  memory: 44,
  cpuLabel: "28%",
  memLabel: "44%",
  scanning: true,
  healthText: "Nominal",
  alertSeverity: "Success",
  alertMessage: "All subsystems operating within safe thermal limits.",
};

function evaluate(cpu, memory) {
  const high = cpu > 80 || memory > 85;
  return {
    cpuLabel: cpu + "%",
    memLabel: memory + "%",
    healthText: high ? "Elevated" : "Nominal",
    alertSeverity: high ? "Warning" : "Success",
    alertMessage: high
      ? "High resource pressure detected (" + cpu + "% CPU / " + memory + "% RAM)"
      : "All subsystems operating within safe thermal limits.",
  };
}

export function updateCpu(state, setState, _log, val) {
  const cpu = Number(val);
  setState({ cpu, ...evaluate(cpu, state.memory) });
}

export function updateMem(state, setState, _log, val) {
  const memory = Number(val);
  setState({ memory, ...evaluate(state.cpu, memory) });
}

export function spikeLoad(_state, setState, log) {
  setState({ cpu: 92, memory: 88, ...evaluate(92, 88) });
  log("Triggered stress spike (92% CPU)");
}

export function normalizeLoad(_state, setState, log) {
  setState({ cpu: 24, memory: 40, ...evaluate(24, 40) });
  log("Normalized system load");
}`,
      },
      {
        id: "manifest",
        name: "App.manifest.json",
        kind: "manifest",
        content: JSON.stringify(
          {
            name: "Resource Diagnostics",
            version: "1.0.4",
            publisher: "Sparkle Systems",
            targetBuild: "28000.14",
            theme: "system",
            backdrop: "mica",
            windowTitle: "Resource Diagnostics",
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    id: "blank-app",
    name: "Blank WinUI 3 Window",
    category: "Starter",
    description:
      "Clean minimal starter with NavigationView, Card, and Button ready for custom code.",
    files: [
      {
        id: "ui",
        name: "App.winui",
        kind: "ui",
        content: `<Page>
  <NavigationView Title="Blank App" SelectedTag="{state.page}" OnSelectTag="setPage">
    <NavigationViewItem Icon="Home" Label="Home" Tag="home" />
    <StackPanel Spacing="16" Padding="24">
      <Card Title="Hello, WinUI Framework" Subtitle="Edit App.winui and click Build App">
        <StackPanel Spacing="12">
          <TextBlock Text="{state.message}" Style="Body" />
          <Button Content="Say Hello" Style="Accent" OnClick="sayHello" />
        </StackPanel>
      </Card>
    </StackPanel>
  </NavigationView>
</Page>`,
      },
      {
        id: "logic",
        name: "App.logic.js",
        kind: "logic",
        content: `export const initialState = {
  page: "home",
  clicks: 0,
  message: "Start editing markup or logic to build your custom WinUI 3 app.",
};

export function setPage(_state, setState, _log, tag) {
  setState({ page: tag });
}

export function sayHello(state, setState, log) {
  const next = state.clicks + 1;
  setState({
    clicks: next,
    message: "Built and clicked " + next + " time(s)!",
  });
  log("sayHello triggered (" + next + ")");
}`,
      },
      {
        id: "manifest",
        name: "App.manifest.json",
        kind: "manifest",
        content: JSON.stringify(
          {
            name: "My WinUI App",
            version: "0.1.0",
            publisher: "Developer",
            targetBuild: "28000.14",
            theme: "system",
            backdrop: "mica",
            windowTitle: "My WinUI App",
          },
          null,
          2,
        ),
      },
    ],
  },
];

export function createProjectFromTemplate(templateId: string, customName?: string): WinUIProject {
  const tpl = WINUI_TEMPLATES.find((t) => t.id === templateId) ?? WINUI_TEMPLATES[0]!;
  return {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: customName?.trim() || tpl.name,
    description: tpl.description,
    templateId: tpl.id,
    files: tpl.files.map((f) => ({ ...f })),
    updatedAt: Date.now(),
  };
}

export function parseWinUIMarkup(source: string): {
  nodes: WinUINode[];
  diagnostics: BuildDiagnostic[];
} {
  const diagnostics: BuildDiagnostic[] = [];
  const rootChildren: WinUINode[] = [];
  const stack: WinUINode[] = [];

  let i = 0;
  let line = 1;
  let lineStart = 0;
  const len = source.length;

  const currentCol = (pos: number) => pos - lineStart + 1;

  const advance = (count = 1) => {
    for (let k = 0; k < count && i < len; k++) {
      if (source[i] === "\n") {
        line++;
        lineStart = i + 1;
      }
      i++;
    }
  };

  while (i < len) {
    if (source[i] === "<") {
      // Comment <!-- ... -->
      if (source.startsWith("<!--", i)) {
        const endComment = source.indexOf("-->", i + 4);
        if (endComment === -1) {
          diagnostics.push({
            id: `diag-comment-${line}`,
            severity: "error",
            file: "App.winui",
            line,
            message: "Unclosed HTML/XAML comment '<!--'.",
          });
          break;
        }
        advance(endComment + 3 - i);
        continue;
      }

      const tagLine = line;
      const tagCol = currentCol(i);
      advance(1); // consume '<'

      // Skip whitespace
      while (i < len && /\s/.test(source[i]!)) advance(1);

      const isClosing = source[i] === "/";
      if (isClosing) {
        advance(1);
        while (i < len && /\s/.test(source[i]!)) advance(1);
      }

      const nameStart = i;
      while (i < len && /[A-Za-z0-9_.-]/.test(source[i]!)) advance(1);
      const tagName = source.slice(nameStart, i);

      if (!tagName) {
        diagnostics.push({
          id: `diag-empty-tag-${tagLine}-${tagCol}`,
          severity: "error",
          file: "App.winui",
          line: tagLine,
          message: `Expected tag name at column ${tagCol}.`,
        });
        continue;
      }

      if (isClosing) {
        while (i < len && source[i] !== ">") advance(1);
        if (i < len && source[i] === ">") advance(1);

        const top = stack[stack.length - 1];
        if (!top) {
          diagnostics.push({
            id: `diag-extra-close-${tagLine}-${tagCol}`,
            severity: "error",
            file: "App.winui",
            line: tagLine,
            message: `Unexpected closing tag </${tagName}> with no matching opening tag.`,
          });
        } else if (top.tag !== tagName) {
          diagnostics.push({
            id: `diag-mismatch-${tagLine}-${tagCol}`,
            severity: "error",
            file: "App.winui",
            line: tagLine,
            message: `Mismatched closing tag </${tagName}>; expected </${top.tag}> (opened on line ${top.line}).`,
          });
          stack.pop();
        } else {
          stack.pop();
        }
        continue;
      }

      // Parse attributes
      const props: Record<string, string> = {};
      let selfClosing = false;
      let closedTag = false;

      while (i < len) {
        while (i < len && /\s/.test(source[i]!)) advance(1);
        if (i >= len) break;

        if (source[i] === "/" && source[i + 1] === ">") {
          selfClosing = true;
          closedTag = true;
          advance(2);
          break;
        }
        if (source[i] === ">") {
          closedTag = true;
          advance(1);
          break;
        }

        const attrStart = i;
        while (i < len && /[A-Za-z0-9_:-]/.test(source[i]!)) advance(1);
        const attrName = source.slice(attrStart, i);

        if (!attrName) {
          diagnostics.push({
            id: `diag-attr-${line}-${currentCol(i)}`,
            severity: "error",
            file: "App.winui",
            line,
            message: `Unexpected character '${source[i]}' inside <${tagName}>.`,
          });
          advance(1);
          continue;
        }

        while (i < len && /\s/.test(source[i]!)) advance(1);

        if (source[i] === "=") {
          advance(1);
          while (i < len && /\s/.test(source[i]!)) advance(1);
          const quote = source[i];
          if (quote === '"' || quote === "'") {
            advance(1);
            const valStart = i;
            while (i < len && source[i] !== quote) advance(1);
            const attrVal = source.slice(valStart, i);
            if (source[i] === quote) {
              advance(1);
            } else {
              diagnostics.push({
                id: `diag-unclosed-quote-${line}`,
                severity: "error",
                file: "App.winui",
                line,
                message: `Unclosed string literal for attribute '${attrName}' on <${tagName}>.`,
              });
            }
            props[attrName] = attrVal;
          } else {
            const valStart = i;
            while (i < len && !/[\s>]/.test(source[i]!)) advance(1);
            props[attrName] = source.slice(valStart, i);
          }
        } else {
          props[attrName] = "true";
        }
      }

      if (!closedTag) {
        diagnostics.push({
          id: `diag-unclosed-open-${tagLine}`,
          severity: "error",
          file: "App.winui",
          line: tagLine,
          message: `Unclosed tag <${tagName}>.`,
        });
      }

      if (!SUPPORTED_WINUI_TAGS.has(tagName)) {
        diagnostics.push({
          id: `diag-unknown-tag-${tagLine}-${tagCol}`,
          severity: "warning",
          file: "App.winui",
          line: tagLine,
          message: `Unknown WinUI control <${tagName}>; it will render as a generic container.`,
        });
      }

      const node: WinUINode = {
        tag: tagName,
        props,
        children: [],
        textContent: "",
        line: tagLine,
        column: tagCol,
      };

      const parent = stack[stack.length - 1];
      if (parent) {
        parent.children.push(node);
      } else {
        rootChildren.push(node);
      }

      if (!selfClosing && closedTag) {
        stack.push(node);
      }
    } else {
      const textStart = i;
      while (i < len && source[i] !== "<") advance(1);
      const rawText = source.slice(textStart, i).trim();
      if (rawText && stack.length > 0) {
        const current = stack[stack.length - 1]!;
        current.textContent = current.textContent ? `${current.textContent} ${rawText}` : rawText;
      }
    }
  }

  for (const unclosed of stack) {
    diagnostics.push({
      id: `diag-unclosed-${unclosed.tag}-${unclosed.line}`,
      severity: "error",
      file: "App.winui",
      line: unclosed.line,
      message: `Tag <${unclosed.tag}> opened on line ${unclosed.line} is missing a closing </${unclosed.tag}>.`,
    });
  }

  return { nodes: rootChildren, diagnostics };
}

export function compileWinUILogic(source: string): {
  initialState: Record<string, unknown>;
  handlers: Record<string, WinUIHandlerFn>;
  handlerNames: string[];
  error: string | null;
} {
  try {
    // Convert simple ES module exports into local declarations and capture them
    const transformed = source
      .replace(/^\s*export\s+default\s+/gm, "const __defaultExport = ")
      .replace(/^\s*export\s+(const|let|var)\s+/gm, "$1 ")
      .replace(/^\s*export\s+(async\s+)?function\s+/gm, "$1function ");

    // Find top-level function declarations and exported variables
    const fnMatches = Array.from(transformed.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)).map(
      (m) => m[1]!,
    );
    const arrowMatches = Array.from(
      transformed.matchAll(
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
      ),
    ).map((m) => m[1]!);

    const candidateNames = Array.from(new Set([...fnMatches, ...arrowMatches])).filter(
      (n) => n !== "initialState" && n !== "__defaultExport",
    );

    const returnObj = `
      return {
        initialState: typeof initialState !== "undefined" ? initialState : {},
        handlers: {
          ${candidateNames.map((n) => `${n}: typeof ${n} === "function" ? ${n} : undefined`).join(",\n          ")}
        }
      };
    `;

    // Shadow browser globals for sandbox hygiene
    const runner = new Function(
      "window",
      "document",
      "globalThis",
      "fetch",
      "localStorage",
      `"use strict";\n${transformed}\n${returnObj}`,
    );

    const result = runner(undefined, undefined, undefined, undefined, undefined) as {
      initialState?: Record<string, unknown>;
      handlers?: Record<string, WinUIHandlerFn | undefined>;
    };

    const cleanHandlers: Record<string, WinUIHandlerFn> = {};
    for (const [key, fn] of Object.entries(result.handlers ?? {})) {
      if (typeof fn === "function") {
        cleanHandlers[key] = fn;
      }
    }

    const initState =
      result.initialState && typeof result.initialState === "object" ? result.initialState : {};

    return {
      initialState: initState,
      handlers: cleanHandlers,
      handlerNames: Object.keys(cleanHandlers),
      error: null,
    };
  } catch (err) {
    return {
      initialState: {},
      handlers: {},
      handlerNames: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function resolveBindingExpression(
  template: string,
  state: Record<string, unknown>,
): unknown {
  const trimmed = template.trim();
  // Direct single expression "{...}" returns typed value (boolean/number/array/object/string)
  if (trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.indexOf("{", 1) === -1) {
    const expr = trimmed.slice(1, -1).trim();
    return evaluateSingleExpression(expr, state);
  }
  // Interpolated string
  return template.replace(/\{([^}]+)\}/g, (_match, expr: string) => {
    const val = evaluateSingleExpression(expr.trim(), state);
    return val === undefined || val === null ? "" : String(val);
  });
}

function evaluateSingleExpression(expr: string, state: Record<string, unknown>): unknown {
  if (!expr) return "";
  try {
    const fn = new Function("state", `"use strict"; return (${expr});`);
    return fn(state);
  } catch {
    return "";
  }
}

function countControls(nodes: WinUINode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1 + countControls(n.children);
  }
  return count;
}

function collectReferencedHandlers(
  nodes: WinUINode[],
  out: Array<{ name: string; line: number; tag: string }>,
) {
  for (const n of nodes) {
    for (const [k, v] of Object.entries(n.props)) {
      if ((EVENT_ATTRS.has(k) || k === "OnSelectTag") && v.trim()) {
        out.push({ name: v.trim(), line: n.line, tag: n.tag });
      }
    }
    collectReferencedHandlers(n.children, out);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateStandaloneHtml(
  project: WinUIProject,
  manifest: WinUIManifest,
  ast: WinUINode[],
  logicSource: string,
): string {
  const safeTitle = escapeHtml(manifest.windowTitle || manifest.name || project.name);
  const astJson = JSON.stringify(ast);
  const manifestJson = JSON.stringify(manifest);
  const cleanLogic = logicSource
    .replace(/^\s*export\s+default\s+/gm, "const __defaultExport = ")
    .replace(/^\s*export\s+(const|let|var)\s+/gm, "$1 ")
    .replace(/^\s*export\s+(async\s+)?function\s+/gm, "$1function ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    :root {
      --bg: #f3f3f3;
      --surface: rgba(255,255,255,0.88);
      --border: rgba(0,0,0,0.08);
      --text: #18181b;
      --muted: #6b7280;
      --accent: #0067b8;
      --accent-fg: #ffffff;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1e2126;
        --surface: rgba(44,48,55,0.9);
        --border: rgba(255,255,255,0.09);
        --text: #f4f4f5;
        --muted: #9ca3af;
        --accent: #4cc2ff;
        --accent-fg: #000000;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 20px;
    }
    .winui-shell {
      max-width: 1060px;
      margin: 0 auto;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      overflow: hidden;
      box-shadow: 0 14px 40px rgba(0,0,0,0.16);
    }
    .winui-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
      font-weight: 600;
    }
    .winui-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      background: rgba(128,128,128,0.05);
    }
    .winui-btn {
      height: 32px;
      padding: 0 14px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: rgba(128,128,128,0.08);
      color: var(--text);
      font: 600 12.5px/1 inherit;
      cursor: pointer;
    }
    .winui-btn.accent {
      border-color: transparent;
      background: var(--accent);
      color: var(--accent-fg);
    }
    input[type="text"] {
      height: 34px;
      padding: 0 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      font: inherit;
    }
  </style>
</head>
<body>
  <div class="winui-shell">
    <div class="winui-titlebar">
      <span>${safeTitle}</span>
      <span style="font-size:11px;color:var(--muted)">WinUI Framework · Build ${escapeHtml(manifest.targetBuild || "28000.14")}</span>
    </div>
    <div id="winui-root"></div>
  </div>
  <script>
    const __AST = ${astJson};
    const __MANIFEST = ${manifestJson};
    ${cleanLogic}
    let state = typeof initialState !== "undefined" ? structuredClone(initialState) : {};
    function setState(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = Object.assign({}, state, next);
      render();
    }
    function log(msg) { console.log("[WinUI]", msg); }
    function resolveExpr(tpl) {
      if (typeof tpl !== "string") return tpl;
      const t = tpl.trim();
      if (t.startsWith("{") && t.endsWith("}") && t.indexOf("{", 1) === -1) {
        try { return Function("state", "return (" + t.slice(1,-1) + ")")(state); } catch { return ""; }
      }
      return tpl.replace(/\\{([^}]+)\\}/g, (_, e) => {
        try { const v = Function("state", "return (" + e + ")")(state); return v ?? ""; } catch { return ""; }
      });
    }
    function callHandler(name, payload) {
      if (!name) return;
      try {
        const fn = eval(name);
        if (typeof fn === "function") fn(state, setState, log, payload);
      } catch (e) { console.error(e); }
    }
    function renderNode(node) {
      const p = node.props || {};
      if (node.tag === "TextBlock") {
        const el = document.createElement("div");
        el.textContent = String(resolveExpr(p.Text || node.textContent || ""));
        el.style.fontSize = p.Style === "Title" ? "20px" : p.Style === "Subtitle" ? "15px" : p.Style === "Caption" ? "12px" : "13.5px";
        el.style.fontWeight = p.Style === "Title" || p.Style === "Subtitle" ? "600" : "400";
        if (p.Style === "Caption") el.style.color = "var(--muted)";
        return el;
      }
      if (node.tag === "Button") {
        const btn = document.createElement("button");
        btn.className = "winui-btn " + (p.Style === "Accent" ? "accent" : "");
        btn.textContent = String(resolveExpr(p.Content || node.textContent || "Button"));
        btn.onclick = () => callHandler(p.OnClick);
        return btn;
      }
      if (node.tag === "TextBox") {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.placeholder = p.PlaceholderText || "";
        inp.value = String(resolveExpr(p.Text || ""));
        inp.oninput = (e) => callHandler(p.OnChanged, e.target.value);
        return inp;
      }
      if (node.tag === "Card" || node.tag === "Expander") {
        const box = document.createElement("div");
        box.className = "winui-card";
        if (p.Title || p.Header) {
          const h = document.createElement("div");
          h.style.fontWeight = "600";
          h.style.marginBottom = "8px";
          h.textContent = String(resolveExpr(p.Title || p.Header));
          box.appendChild(h);
        }
        (node.children || []).forEach((c) => box.appendChild(renderNode(c)));
        return box;
      }
      const wrap = document.createElement("div");
      if (node.tag === "StackPanel") {
        wrap.style.display = "flex";
        wrap.style.flexDirection = p.Orientation === "Horizontal" ? "row" : "column";
        wrap.style.gap = (p.Spacing || 12) + "px";
        if (p.Padding) wrap.style.padding = p.Padding + "px";
      } else if (node.tag === "Grid") {
        wrap.style.display = "grid";
        wrap.style.gridTemplateColumns = "repeat(" + (p.Columns || 2) + ", minmax(0,1fr))";
        wrap.style.gap = (p.Gap || 12) + "px";
      }
      (node.children || []).forEach((c) => wrap.appendChild(renderNode(c)));
      return wrap;
    }
    function render() {
      const root = document.getElementById("winui-root");
      root.innerHTML = "";
      __AST.forEach((n) => root.appendChild(renderNode(n)));
    }
    render();
  </script>
</body>
</html>`;
}

export function buildWinUIProject(project: WinUIProject): BuildResult {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const diagnostics: BuildDiagnostic[] = [];

  const uiFile = project.files.find((f) => f.kind === "ui");
  const logicFile = project.files.find((f) => f.kind === "logic");
  const manifestFile = project.files.find((f) => f.kind === "manifest");

  let manifest: WinUIManifest = {
    name: project.name,
    version: "1.0.0",
    publisher: "SparkleOS Developer",
    targetBuild: "28000.14",
    theme: "system",
    backdrop: "mica",
    windowTitle: project.name,
  };

  if (manifestFile) {
    try {
      const parsed = JSON.parse(manifestFile.content) as Partial<WinUIManifest>;
      if (!parsed.name || !parsed.version) {
        diagnostics.push({
          id: "diag-manifest-fields",
          severity: "warning",
          file: manifestFile.name,
          line: 1,
          message: "Manifest should specify both 'name' and 'version'.",
        });
      }
      manifest = {
        ...manifest,
        ...parsed,
        name: parsed.name || project.name,
        version: parsed.version || "1.0.0",
        targetBuild: parsed.targetBuild || "28000.14",
        theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : "system",
        backdrop:
          parsed.backdrop === "acrylic" || parsed.backdrop === "solid" ? parsed.backdrop : "mica",
        windowTitle: parsed.windowTitle || parsed.name || project.name,
      };
    } catch (err) {
      diagnostics.push({
        id: "diag-manifest-json",
        severity: "error",
        file: manifestFile.name,
        line: 1,
        message: `Invalid JSON in ${manifestFile.name}: ${err instanceof Error ? err.message : "Parse error"}`,
      });
    }
  }

  const logicCompile = compileWinUILogic(logicFile?.content ?? "export const initialState = {};");
  if (logicCompile.error) {
    diagnostics.push({
      id: "diag-logic-syntax",
      severity: "error",
      file: logicFile?.name ?? "App.logic.js",
      line: 1,
      message: `JavaScript compile error: ${logicCompile.error}`,
    });
  }

  const markup = parseWinUIMarkup(uiFile?.content ?? "");
  diagnostics.push(...markup.diagnostics);

  if (markup.nodes.length === 0 && !markup.diagnostics.some((d) => d.severity === "error")) {
    diagnostics.push({
      id: "diag-empty-ui",
      severity: "warning",
      file: uiFile?.name ?? "App.winui",
      line: 1,
      message: "App.winui contains no root WinUI controls.",
    });
  }

  // Verify UI event handler references exist in logic
  const referenced: Array<{ name: string; line: number; tag: string }> = [];
  collectReferencedHandlers(markup.nodes, referenced);
  for (const ref of referenced) {
    if (!logicCompile.handlers[ref.name]) {
      diagnostics.push({
        id: `diag-missing-handler-${ref.name}-${ref.line}`,
        severity: "warning",
        file: uiFile?.name ?? "App.winui",
        line: ref.line,
        message: `Handler '${ref.name}' referenced on <${ref.tag}> is not defined in App.logic.js.`,
      });
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  const controlCount = countControls(markup.nodes);
  const exportedHtml = hasErrors
    ? ""
    : generateStandaloneHtml(project, manifest, markup.nodes, logicFile?.content ?? "");

  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  const durationMs = Math.max(1, Math.round(end - start));

  if (!hasErrors) {
    diagnostics.push({
      id: "diag-build-ok",
      severity: "info",
      file: manifest.name,
      line: 1,
      message: `Build succeeded (${controlCount} controls, ${logicCompile.handlerNames.length} handlers) in ${durationMs} ms.`,
    });
  }

  return {
    success: !hasErrors,
    timestamp: Date.now(),
    durationMs,
    controlCount,
    bundleSizeBytes: new Blob([exportedHtml]).size,
    ast: markup.nodes,
    manifest,
    initialState: logicCompile.initialState,
    handlers: logicCompile.handlers,
    handlerNames: logicCompile.handlerNames,
    diagnostics,
    exportedHtml,
  };
}

export interface WinUIGalleryToolboxItem {
  type: VisualElementType;
  label: string;
  category:
    | "Basic Input"
    | "Text & Display"
    | "Status & Progress"
    | "Layout & Containers"
    | "Collections & Pickers";
  summary: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultProps: VisualElementProps;
  defaultAction?: VisualAction;
}

export const DEFAULT_VISUAL_CANVAS: VisualCanvasConfig = {
  width: 840,
  height: 540,
  surface: "mica",
  snapGrid: true,
};

export const WINUI_GALLERY_TOOLBOX: WinUIGalleryToolboxItem[] = [
  {
    type: "TextBlock",
    label: "TextBlock",
    category: "Text & Display",
    summary: "Fluent typography block for titles, subtitles, body copy, and captions.",
    defaultWidth: 280,
    defaultHeight: 44,
    defaultProps: {
      text: "WinUI 3 Heading",
      styleVariant: "Title",
      radius: 4,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "Button",
    label: "Button",
    category: "Basic Input",
    summary: "Standard, Accent, Subtle, or Danger push button with no-code action.",
    defaultWidth: 160,
    defaultHeight: 40,
    defaultProps: {
      text: "Primary Action",
      styleVariant: "Accent",
      radius: 6,
      opacity: 100,
      visible: true,
    },
    defaultAction: {
      kind: "toast",
      message: "Action triggered!",
    },
  },
  {
    type: "HyperlinkButton",
    label: "HyperlinkButton",
    category: "Basic Input",
    summary: "Accent link button for inline navigation or secondary actions.",
    defaultWidth: 176,
    defaultHeight: 36,
    defaultProps: {
      text: "Learn more about WinUI",
      styleVariant: "Accent",
      radius: 6,
      opacity: 100,
      visible: true,
    },
    defaultAction: {
      kind: "toast",
      message: "Opened link action",
    },
  },
  {
    type: "ToggleSwitch",
    label: "ToggleSwitch",
    category: "Basic Input",
    summary: "Fluent on/off switch with customizable header.",
    defaultWidth: 230,
    defaultHeight: 56,
    defaultProps: {
      header: "Enable Fluent Effects",
      isOn: true,
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "CheckBox",
    label: "CheckBox",
    category: "Basic Input",
    summary: "Selection checkbox with label.",
    defaultWidth: 220,
    defaultHeight: 38,
    defaultProps: {
      text: "Remember preferences",
      isChecked: true,
      radius: 4,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "Slider",
    label: "Slider",
    category: "Basic Input",
    summary: "Continuous range slider with live numeric readout.",
    defaultWidth: 260,
    defaultHeight: 62,
    defaultProps: {
      header: "Intensity",
      min: 0,
      max: 100,
      value: 64,
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "TextBox",
    label: "TextBox",
    category: "Basic Input",
    summary: "Single-line Fluent text input with accent focus underline.",
    defaultWidth: 260,
    defaultHeight: 64,
    defaultProps: {
      header: "Input Field",
      placeholder: "Type something...",
      text: "",
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "NumberBox",
    label: "NumberBox",
    category: "Basic Input",
    summary: "Numeric stepper input with +/- controls and min/max clamping.",
    defaultWidth: 200,
    defaultHeight: 64,
    defaultProps: {
      header: "Quantity",
      min: 0,
      max: 999,
      value: 12,
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "ComboBox",
    label: "ComboBox",
    category: "Collections & Pickers",
    summary: "Dropdown selector populated from comma-separated options.",
    defaultWidth: 230,
    defaultHeight: 64,
    defaultProps: {
      header: "Release Channel",
      items: "Canary,Dev,Beta,Release",
      selected: "Beta",
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "RatingControl",
    label: "RatingControl",
    category: "Basic Input",
    summary: "Interactive 5-star WinUI rating selector.",
    defaultWidth: 210,
    defaultHeight: 54,
    defaultProps: {
      header: "User Rating",
      value: 4,
      max: 5,
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "CalendarDatePicker",
    label: "CalendarDatePicker",
    category: "Collections & Pickers",
    summary: "Fluent date picker field.",
    defaultWidth: 220,
    defaultHeight: 64,
    defaultProps: {
      header: "Target Date",
      text: "2026-11-24",
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "InfoBar",
    label: "InfoBar",
    category: "Status & Progress",
    summary: "Informational, Success, Warning, or Error status banner.",
    defaultWidth: 360,
    defaultHeight: 72,
    defaultProps: {
      header: "System Ready",
      text: "All WinUI 3 visual bindings are connected.",
      severity: "info",
      radius: 8,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "ProgressBar",
    label: "ProgressBar",
    category: "Status & Progress",
    summary: "Determinate Fluent progress bar with percentage value.",
    defaultWidth: 280,
    defaultHeight: 52,
    defaultProps: {
      header: "Completion",
      value: 72,
      max: 100,
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "ProgressRing",
    label: "ProgressRing",
    category: "Status & Progress",
    summary: "Animated WinUI busy spinner ring with optional status label.",
    defaultWidth: 180,
    defaultHeight: 56,
    defaultProps: {
      text: "Syncing...",
      isOn: true,
      radius: 8,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "Badge",
    label: "InfoBadge",
    category: "Status & Progress",
    summary: "Compact status indicator chip for counts or states.",
    defaultWidth: 132,
    defaultHeight: 34,
    defaultProps: {
      text: "Build 28000",
      severity: "info",
      radius: 6,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "Card",
    label: "Card",
    category: "Layout & Containers",
    summary: "Elevated Mica/Acrylic surface card with title and subtitle.",
    defaultWidth: 300,
    defaultHeight: 150,
    defaultProps: {
      header: "Summary Card",
      subtitle: "Elevated Fluent surface container",
      text: "Drop controls on top or customize this surface.",
      radius: 8,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "Expander",
    label: "Expander",
    category: "Layout & Containers",
    summary: "Collapsible settings card with expandable details.",
    defaultWidth: 320,
    defaultHeight: 130,
    defaultProps: {
      header: "Advanced Options",
      subtitle: "Click header to expand or collapse",
      text: "Configure optional runtime flags here.",
      isExpanded: true,
      radius: 8,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "ListView",
    label: "ListView",
    category: "Collections & Pickers",
    summary: "Interactive task/item list with check-off and quick add.",
    defaultWidth: 320,
    defaultHeight: 196,
    defaultProps: {
      header: "Items",
      items: "Design app shell,Configure visual actions,Pin to Start Menu",
      radius: 8,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "ImageCard",
    label: "AcrylicTile",
    category: "Text & Display",
    summary: "Hero graphic tile with title, subtitle, and customizable accent gradient.",
    defaultWidth: 300,
    defaultHeight: 148,
    defaultProps: {
      header: "Featured Workspace",
      subtitle: "Fluent Design · WinUI 3",
      accentColor: "#0067b8",
      radius: 10,
      opacity: 100,
      visible: true,
    },
  },
  {
    type: "Divider",
    label: "Divider",
    category: "Layout & Containers",
    summary: "Subtle horizontal separator line for grouping visual sections.",
    defaultWidth: 340,
    defaultHeight: 18,
    defaultProps: {
      opacity: 100,
      visible: true,
    },
  },
];

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function visualElementsToWinUIMarkup(
  elements: VisualElement[],
  canvas: VisualCanvasConfig,
  appName: string,
): string {
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: string[] = [
    `<Page>`,
    `  <!-- Visual Canvas: ${canvas.width}x${canvas.height} (${canvas.surface}) -->`,
    `  <NavigationView Title="${escapeXmlAttr(appName || "WinUI App")}" SelectedTag="design">`,
    `    <NavigationViewItem Icon="Home" Label="Main View" Tag="design" />`,
    `    <StackPanel Spacing="12" Padding="20">`,
  ];

  for (const el of sorted) {
    const p = el.props;
    const handlerAttr =
      el.action && el.action.kind === "handler" && el.action.handlerName
        ? ` OnClick="${escapeXmlAttr(el.action.handlerName)}"`
        : "";

    switch (el.type) {
      case "TextBlock":
        lines.push(
          `      <TextBlock Text="${escapeXmlAttr(p.text ?? el.name)}" Style="${escapeXmlAttr(p.styleVariant ?? "Body")}" />`,
        );
        break;
      case "Button":
        lines.push(
          `      <Button Content="${escapeXmlAttr(p.text ?? "Button")}" Style="${escapeXmlAttr(p.styleVariant ?? "Accent")}"${handlerAttr} />`,
        );
        break;
      case "HyperlinkButton":
        lines.push(
          `      <HyperlinkButton Content="${escapeXmlAttr(p.text ?? "Link")}"${handlerAttr} />`,
        );
        break;
      case "ToggleSwitch":
        lines.push(
          `      <ToggleSwitch Header="${escapeXmlAttr(p.header ?? "Toggle")}" IsOn="${p.isOn ? "true" : "false"}" />`,
        );
        break;
      case "CheckBox":
        lines.push(
          `      <CheckBox Content="${escapeXmlAttr(p.text ?? "CheckBox")}" IsChecked="${p.isChecked ? "true" : "false"}" />`,
        );
        break;
      case "Slider":
        lines.push(
          `      <Slider Header="${escapeXmlAttr(p.header ?? "Slider")}" Minimum="${p.min ?? 0}" Maximum="${p.max ?? 100}" Value="${p.value ?? 50}" />`,
        );
        break;
      case "TextBox":
        lines.push(
          `      <TextBox Header="${escapeXmlAttr(p.header ?? "")}" PlaceholderText="${escapeXmlAttr(p.placeholder ?? "")}" Text="${escapeXmlAttr(p.text ?? "")}" />`,
        );
        break;
      case "NumberBox":
        lines.push(
          `      <NumberBox Header="${escapeXmlAttr(p.header ?? "Number")}" Minimum="${p.min ?? 0}" Maximum="${p.max ?? 100}" Value="${p.value ?? 0}" />`,
        );
        break;
      case "ComboBox":
        lines.push(
          `      <ComboBox Header="${escapeXmlAttr(p.header ?? "Select")}" Items="${escapeXmlAttr(p.items ?? "One,Two,Three")}" Selected="${escapeXmlAttr(p.selected ?? "")}" />`,
        );
        break;
      case "InfoBar": {
        const sevMap: Record<string, string> = {
          info: "Informational",
          success: "Success",
          warning: "Warning",
          error: "Error",
        };
        const sev = sevMap[p.severity ?? "info"] ?? "Informational";
        lines.push(
          `      <InfoBar Severity="${sev}" Title="${escapeXmlAttr(p.header ?? "Notice")}" Message="${escapeXmlAttr(p.text ?? "")}" IsOpen="true" />`,
        );
        break;
      }
      case "ProgressBar":
        lines.push(
          `      <ProgressBar Label="${escapeXmlAttr(p.header ?? "Progress")}" Value="${p.value ?? 50}" Maximum="${p.max ?? 100}" />`,
        );
        break;
      case "ProgressRing":
        lines.push(
          `      <ProgressRing IsActive="${p.isOn === false ? "false" : "true"}" Label="${escapeXmlAttr(p.text ?? "Loading...")}" />`,
        );
        break;
      case "Card":
        lines.push(
          `      <Card Title="${escapeXmlAttr(p.header ?? "Card")}" Subtitle="${escapeXmlAttr(p.subtitle ?? "")}">`,
        );
        if (p.text) {
          lines.push(`        <TextBlock Text="${escapeXmlAttr(p.text)}" Style="Body" />`);
        }
        lines.push(`      </Card>`);
        break;
      case "Expander":
        lines.push(
          `      <Expander Header="${escapeXmlAttr(p.header ?? "Expander")}" Subtitle="${escapeXmlAttr(p.subtitle ?? "")}" IsExpanded="${p.isExpanded === false ? "false" : "true"}">`,
        );
        if (p.text) {
          lines.push(`        <TextBlock Text="${escapeXmlAttr(p.text)}" Style="Body" />`);
        }
        lines.push(`      </Expander>`);
        break;
      case "ListView":
        lines.push(
          `      <ListView Items="${escapeXmlAttr(p.items ?? "")}" EmptyText="No items yet" />`,
        );
        break;
      case "Badge":
        lines.push(
          `      <Badge Text="${escapeXmlAttr(p.text ?? "Badge")}" Variant="${escapeXmlAttr(p.severity ?? "info")}" />`,
        );
        break;
      case "Divider":
        lines.push(`      <Divider />`);
        break;
      case "RatingControl":
        lines.push(
          `      <RatingControl Header="${escapeXmlAttr(p.header ?? "Rating")}" Value="${p.value ?? 4}" />`,
        );
        break;
      case "CalendarDatePicker":
        lines.push(
          `      <CalendarDatePicker Header="${escapeXmlAttr(p.header ?? "Date")}" Date="${escapeXmlAttr(p.text ?? "")}" />`,
        );
        break;
      case "ImageCard":
        lines.push(
          `      <ImageCard Title="${escapeXmlAttr(p.header ?? "Featured")}" Subtitle="${escapeXmlAttr(p.subtitle ?? "")}" />`,
        );
        break;
    }
  }

  lines.push(`    </StackPanel>`);
  lines.push(`  </NavigationView>`);
  lines.push(`</Page>`);
  return lines.join("\n");
}

function cleanBindingFallback(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  if (val.includes("{") && val.includes("}")) return fallback;
  return val;
}

export function astToVisualElements(astNodes: WinUINode[]): VisualElement[] {
  const elements: VisualElement[] = [];
  let cursorY = 24;
  let seq = 1;

  const toolboxByType = new Map<VisualElementType, WinUIGalleryToolboxItem>(
    WINUI_GALLERY_TOOLBOX.map((item) => [item.type, item]),
  );

  const pushEl = (
    type: VisualElementType,
    propsPatch: Partial<VisualElementProps>,
    action?: VisualAction,
    widthOverride?: number,
    heightOverride?: number,
  ) => {
    const def = toolboxByType.get(type);
    const width = widthOverride ?? def?.defaultWidth ?? 260;
    const height = heightOverride ?? def?.defaultHeight ?? 52;
    elements.push({
      id: `vis-${seq}-${type.toLowerCase()}`,
      type,
      name: `${type} ${seq}`,
      x: 24,
      y: cursorY,
      width,
      height,
      zIndex: seq,
      props: {
        ...(def?.defaultProps ?? {}),
        ...propsPatch,
      },
      ...(action ? { action } : def?.defaultAction ? { action: { ...def.defaultAction } } : {}),
    });
    seq += 1;
    cursorY += height + 12;
  };

  const walk = (node: WinUINode) => {
    const p = node.props;
    const tag = node.tag;

    if (tag === "Page" || tag === "NavigationView" || tag === "StackPanel" || tag === "Grid") {
      for (const child of node.children) walk(child);
      return;
    }
    if (tag === "NavigationViewItem") {
      return;
    }

    switch (tag) {
      case "TextBlock":
        pushEl("TextBlock", {
          text: cleanBindingFallback(p["Text"] || node.textContent, "Label"),
          styleVariant: (p["Style"] as VisualElementProps["styleVariant"]) || "Body",
        });
        break;
      case "Button":
        pushEl(
          "Button",
          {
            text: cleanBindingFallback(p["Content"] || node.textContent, "Button"),
            styleVariant: (p["Style"] as VisualElementProps["styleVariant"]) || "Accent",
          },
          p["OnClick"]
            ? { kind: "handler", handlerName: p["OnClick"] }
            : { kind: "toast", message: "Button clicked" },
        );
        break;
      case "HyperlinkButton":
        pushEl("HyperlinkButton", {
          text: cleanBindingFallback(p["Content"] || node.textContent, "Hyperlink"),
        });
        break;
      case "ToggleSwitch":
        pushEl("ToggleSwitch", {
          header: cleanBindingFallback(p["Header"], "Toggle Switch"),
          isOn: p["IsOn"] !== "false",
        });
        break;
      case "CheckBox":
        pushEl("CheckBox", {
          text: cleanBindingFallback(p["Content"], "Option"),
          isChecked: p["IsChecked"] !== "false",
        });
        break;
      case "Slider":
        pushEl("Slider", {
          header: cleanBindingFallback(p["Header"], "Slider"),
          min: Number(p["Minimum"] ?? 0) || 0,
          max: Number(p["Maximum"] ?? 100) || 100,
          value: Number(p["Value"] ?? 50) || 50,
        });
        break;
      case "TextBox":
        pushEl("TextBox", {
          header: cleanBindingFallback(p["Header"], "Text Input"),
          placeholder: p["PlaceholderText"] ?? "Enter value...",
          text: cleanBindingFallback(p["Text"], ""),
        });
        break;
      case "NumberBox":
        pushEl("NumberBox", {
          header: cleanBindingFallback(p["Header"], "Value"),
          value: Number(p["Value"] ?? 10) || 10,
        });
        break;
      case "ComboBox":
        pushEl("ComboBox", {
          header: cleanBindingFallback(p["Header"], "Selector"),
          items: cleanBindingFallback(p["Items"], "Option 1,Option 2,Option 3"),
          selected: cleanBindingFallback(p["Selected"], "Option 1"),
        });
        break;
      case "InfoBar": {
        const rawSev = (p["Severity"] || "info").toLowerCase();
        const sev: VisualElementProps["severity"] = rawSev.includes("succ")
          ? "success"
          : rawSev.includes("warn")
            ? "warning"
            : rawSev.includes("err")
              ? "error"
              : "info";
        pushEl("InfoBar", {
          header: cleanBindingFallback(p["Title"], "Status"),
          text: cleanBindingFallback(p["Message"], "Ready on WinUI 3."),
          severity: sev,
        });
        break;
      }
      case "ProgressBar":
        pushEl("ProgressBar", {
          header: cleanBindingFallback(p["Label"], "Progress"),
          value: Number(p["Value"] ?? 65) || 65,
          max: Number(p["Maximum"] ?? 100) || 100,
        });
        break;
      case "ProgressRing":
        pushEl("ProgressRing", {
          text: cleanBindingFallback(p["Label"], "Working..."),
          isOn: p["IsActive"] !== "false",
        });
        break;
      case "Card":
        pushEl("Card", {
          header: cleanBindingFallback(p["Title"], "Card"),
          subtitle: cleanBindingFallback(p["Subtitle"], ""),
          text: cleanBindingFallback(
            node.children.find((c) => c.tag === "TextBlock")?.props["Text"],
            "",
          ),
        });
        break;
      case "Expander":
        pushEl("Expander", {
          header: cleanBindingFallback(p["Header"], "Expander"),
          subtitle: cleanBindingFallback(p["Subtitle"], ""),
          isExpanded: p["IsExpanded"] !== "false",
        });
        break;
      case "ListView":
        pushEl("ListView", {
          header: "List Items",
          items: "Item 1,Item 2,Item 3",
        });
        break;
      case "Badge":
        pushEl("Badge", {
          text: cleanBindingFallback(p["Text"], "Badge"),
        });
        break;
      case "Divider":
        pushEl("Divider", {});
        break;
      case "RatingControl":
        pushEl("RatingControl", {
          header: cleanBindingFallback(p["Header"], "Rating"),
          value: Number(p["Value"] ?? 4) || 4,
        });
        break;
      case "CalendarDatePicker":
        pushEl("CalendarDatePicker", {
          header: cleanBindingFallback(p["Header"], "Date"),
          text: cleanBindingFallback(p["Date"], "2026-11-24"),
        });
        break;
      case "ImageCard":
        pushEl("ImageCard", {
          header: cleanBindingFallback(p["Title"], "Featured"),
          subtitle: cleanBindingFallback(p["Subtitle"], ""),
        });
        break;
      default:
        break;
    }
  };

  for (const n of astNodes) {
    walk(n);
  }
  return elements;
}

export function generateStandaloneVisualHtml(
  appName: string,
  canvas: VisualCanvasConfig,
  elements: VisualElement[],
): string {
  const safeTitle = escapeHtml(appName || "WinUI Visual App");
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const bodyItems = sorted
    .filter((el) => el.props.visible !== false)
    .map((el) => {
      const p = el.props;
      const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;border-radius:${p.radius ?? 6}px;opacity:${(p.opacity ?? 100) / 100};`;
      if (el.type === "Button") {
        const isAccent = p.styleVariant !== "Standard" && p.styleVariant !== "Subtle";
        const msg = escapeHtml(el.action?.message || p.text || "Clicked!");
        return `<button onclick="alert('${msg}')" style="${style}border:1px solid rgba(0,0,0,0.12);background:${isAccent ? "#0067b8" : "rgba(255,255,255,0.85)"};color:${isAccent ? "#fff" : "inherit"};font:600 13px inherit;cursor:pointer;">${escapeHtml(p.text ?? "Button")}</button>`;
      }
      if (el.type === "TextBlock") {
        const fs =
          p.styleVariant === "Title"
            ? "20px"
            : p.styleVariant === "Subtitle"
              ? "15px"
              : p.styleVariant === "Caption"
                ? "12px"
                : "13.5px";
        const fw = p.styleVariant === "Title" || p.styleVariant === "Subtitle" ? "600" : "400";
        return `<div style="${style}font-size:${fs};font-weight:${fw};display:flex;align-items:center;">${escapeHtml(p.text ?? "")}</div>`;
      }
      if (el.type === "Card" || el.type === "Expander") {
        return `<div style="${style}padding:12px 14px;border:1px solid rgba(128,128,128,0.2);background:rgba(255,255,255,0.75);"><div style="font-weight:600;font-size:13.5px">${escapeHtml(p.header ?? el.type)}</div><div style="font-size:12px;opacity:.7;margin-top:4px">${escapeHtml(p.text ?? p.subtitle ?? "")}</div></div>`;
      }
      return `<div style="${style}padding:8px 12px;border:1px solid rgba(128,128,128,0.18);background:rgba(255,255,255,0.65);font-size:12.5px;">${escapeHtml(p.header ?? p.text ?? el.name)}</div>`;
    })
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: "Segoe UI Variable", "Segoe UI", system-ui, sans-serif; background: #eef1f6; color: #18181b; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .canvas { position: relative; width: ${canvas.width}px; height: ${canvas.height}px; max-width: 100%; border-radius: 12px; border: 1px solid rgba(0,0,0,0.12); background: rgba(255,255,255,0.9); box-shadow: 0 18px 44px rgba(0,0,0,0.14); overflow: auto; }
  </style>
</head>
<body>
  <div class="canvas">
      ${bodyItems}
  </div>
</body>
</html>`;
}
