import React, { useState, useCallback, useEffect, useRef } from "react";
import { SettingsState, SystemInfo, systemInfoFromModel } from "../types";
import {
  SettingsSection,
  Toggle,
  Input,
  Button,
  ShortcutsTable,
  Shortcut,
} from "../components/ui";
import { Layout } from "../components/Layout";
import { useSidebarSections } from "../hooks/useSidebarSections";
import { useNotification } from "../hooks/useNotification";
import { useHelp } from "../hooks/useHelp";
import {
  GetSystemInfo,
  SetLogLevel,
  GetKeepInBackground,
  SetKeepInBackground,
  GetStartHidden,
  SetStartHidden,
} from "../../wailsjs/go/system/Service";

// Feature flags
const FEATURES = {
  GIT_SYNC: false,
  EXPORT: false,
};

const actualShortcuts: Shortcut[] = [
  {
    id: "help",
    action: "Toggle help (global)",
    defaultKey: "?",
    currentKey: "?",
    editable: false,
  },
  {
    id: "command-palette",
    action: "Open command palette (global)",
    defaultKey: "Ctrl+K",
    currentKey: "Ctrl+K",
    editable: false,
  },
  {
    id: "command-line",
    action: "Focus command line",
    defaultKey: ":",
    currentKey: ":",
    editable: false,
  },
  {
    id: "escape",
    action: "Exit command line",
    defaultKey: "Esc",
    currentKey: "Esc",
    editable: false,
  },
  {
    id: "save-document",
    action: "Save document (Document page)",
    defaultKey: "Ctrl+S",
    currentKey: "Ctrl+S",
    editable: false,
  },
  {
    id: "delete-block",
    action: "Delete block (Document page)",
    defaultKey: "Ctrl+D",
    currentKey: "Ctrl+D",
    editable: false,
  },
  {
    id: "new-document",
    action: "Create new document (Dashboard)",
    defaultKey: "Ctrl+N",
    currentKey: "Ctrl+N",
    editable: false,
  },
  {
    id: "toggle-archived-dashboard",
    action: "Toggle archived (Dashboard)",
    defaultKey: "Ctrl+Shift+A",
    currentKey: "Ctrl+Shift+A",
    editable: false,
  },
  {
    id: "project-next",
    action: "Select next project (Projects page)",
    defaultKey: "j",
    currentKey: "j",
    editable: false,
  },
  {
    id: "project-prev",
    action: "Select previous project (Projects page)",
    defaultKey: "k",
    currentKey: "k",
    editable: false,
  },
  {
    id: "project-open",
    action: "Open selected project (Projects page)",
    defaultKey: "Enter",
    currentKey: "Enter",
    editable: false,
  },
  {
    id: "toggle-archived-projects",
    action: "Toggle show archived (Projects page)",
    defaultKey: "Ctrl+Shift+A",
    currentKey: "Ctrl+Shift+A",
    editable: false,
  },
  {
    id: "search-focus",
    action: "Focus search input (Search page)",
    defaultKey: "/",
    currentKey: "/",
    editable: false,
  },
  {
    id: "search-to-results",
    action: "Move to results (Search page)",
    defaultKey: "Tab",
    currentKey: "Tab",
    editable: false,
  },
  {
    id: "search-next",
    action: "Navigate down results (Search page)",
    defaultKey: "j",
    currentKey: "j",
    editable: false,
  },
  {
    id: "search-prev",
    action: "Navigate up results (Search page)",
    defaultKey: "k",
    currentKey: "k",
    editable: false,
  },
  {
    id: "search-open",
    action: "Open selected result (Search page)",
    defaultKey: "Enter",
    currentKey: "Enter",
    editable: false,
  },
  {
    id: "search-unfocus",
    action: "Unfocus search input (Search page)",
    defaultKey: "Esc",
    currentKey: "Esc",
    editable: false,
  },
];

interface SettingsProps {
  onNavigate?: (page: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate }) => {
  const [settings, setSettings] = useState<SettingsState>({
    gitSync: {
      enabled: false,
      repositoryPath: "",
      remoteUrl: "",
      syncFrequency: "daily",
    },
    export: {
      defaultFormat: "md",
      includeTimestamps: true,
      includeProjectContext: true,
      includeSyntaxHighlighting: false,
    },
    shortcuts: {},
  });

  const [shortcuts] = useState<Shortcut[]>(actualShortcuts);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [keepInBackground, setKeepInBackground] = useState(false);
  const [startHidden, setStartHidden] = useState(false);
  const { success, error} = useNotification();
  const { setPageContext } = useHelp();

  // Refs for each section
  const generalRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const loggingRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageContext([], "Settings");
  }, [setPageContext]);

  useEffect(() => {
    GetSystemInfo()
      .then((model) => setSystemInfo(systemInfoFromModel(model)))
      .catch((err) => console.error("Failed to fetch system info:", err));

    GetKeepInBackground()
      .then((value) => setKeepInBackground(value))
      .catch((err) =>
        console.error("Failed to fetch keep in background setting:", err),
      );

    GetStartHidden()
      .then((value) => setStartHidden(value))
      .catch((err) =>
        console.error("Failed to fetch start hidden setting:", err),
      );
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const refMap: Record<string, React.RefObject<HTMLDivElement>> = {
      general: generalRef,
      shortcuts: shortcutsRef,
      logging: loggingRef,
      sync: syncRef,
      export: exportRef,
      about: aboutRef,
    };

    const ref = refMap[sectionId];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleGitSyncToggle = useCallback(
    (enabled: boolean) => {
      setSettings((prev) => ({
        ...prev,
        gitSync: { ...prev.gitSync, enabled },
      }));
      success(enabled ? "Git sync enabled" : "Git sync disabled");
    },
    [success],
  );

  const handleExportToggle = useCallback(
    (key: keyof SettingsState["export"], value: boolean) => {
      setSettings((prev) => ({
        ...prev,
        export: { ...prev.export, [key]: value },
      }));
      success("Export settings updated");
    },
    [success],
  );

  const handleLogLevelChange = useCallback(
    async (level: string) => {
      try {
        await SetLogLevel(level);
        setNeedsRestart(true);
        success(`Log level set to ${level}. Please restart the application.`);

        const model = await GetSystemInfo();
        setSystemInfo(systemInfoFromModel(model));
      } catch (err) {
        error(`Failed to set log level: ${err}`);
      }
    },
    [success, error],
  );

  const handleKeepInBackgroundToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await SetKeepInBackground(enabled);
        setKeepInBackground(enabled);
        // If disabling keep_in_background, also disable start_hidden
        if (!enabled) {
          setStartHidden(false);
        }
        success(
          enabled
            ? "Window will hide to background when closed"
            : "Window will quit when closed",
        );
      } catch (err) {
        error(`Failed to update setting: ${err}`);
      }
    },
    [success, error],
  );

  const handleStartHiddenToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await SetStartHidden(enabled);
        setStartHidden(enabled);
        success(
          enabled
            ? "App will start hidden in background"
            : "App will start with window visible",
        );
      } catch (err) {
        error(`Failed to update setting: ${err}`);
      }
    },
    [success, error],
  );

  const settingsItems = [
    {
      id: "general",
      label: "general",
      onClick: () => scrollToSection("general"),
    },
    {
      id: "shortcuts",
      label: "shortcuts",
      onClick: () => scrollToSection("shortcuts"),
    },
    {
      id: "logging",
      label: "logging",
      onClick: () => scrollToSection("logging"),
    },
    ...(FEATURES.GIT_SYNC
      ? [{ id: "sync", label: "sync", onClick: () => scrollToSection("sync") }]
      : []),
    ...(FEATURES.EXPORT
      ? [
        {
          id: "export",
          label: "export",
          onClick: () => scrollToSection("export"),
        },
      ]
      : []),
    { id: "about", label: "about", onClick: () => scrollToSection("about") },
  ];

  const sidebarSections = useSidebarSections({
    currentPage: "settings",
    onNavigate,
    additionalSections: [
      {
        id: "settings",
        title: "SETTINGS",
        items: settingsItems,
      },
    ],
  });

  return (
    <Layout
      sidebarSections={sidebarSections}
      currentPage="settings"
      headerShortcuts={[{ key: "?", label: "help" }]}
      showCommandLine={false}
    >
      <div className="overflow-y-auto h-full p-5">
        <div className="max-w-4xl mx-auto">
          {needsRestart && (
            <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded">
              <div className="text-yellow-400 font-medium mb-1">
                Restart Required
              </div>
              <div className="text-yellow-300 text-sm">
                Please restart the application for the log level changes to take
                effect.
              </div>
            </div>
          )}

          {/* General Settings */}
          <div ref={generalRef}>
            <SettingsSection
              title="General"
              subtitle="Application behavior settings"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text">
                      Keep running in background when closed
                    </div>
                    <div className="text-xs text-text-dim">
                      When enabled, closing the window will hide YANTA instead
                      of quitting. Press Ctrl+Shift+Y anywhere to restore the
                      window.
                    </div>
                  </div>
                  <Toggle
                    checked={keepInBackground}
                    onChange={handleKeepInBackgroundToggle}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text">
                      Start hidden in background
                    </div>
                    <div className="text-xs text-text-dim">
                      When enabled, YANTA will start hidden. Press Ctrl+Shift+Y
                      to show it. Requires "Keep running in background" to be
                      enabled.
                    </div>
                  </div>
                  <Toggle
                    checked={startHidden}
                    onChange={handleStartHiddenToggle}
                    disabled={!keepInBackground}
                  />
                </div>
              </div>
            </SettingsSection>
          </div>

          {/* Keyboard Shortcuts */}
          <div ref={shortcutsRef}>
            <SettingsSection
              title="Keyboard Shortcuts"
              subtitle="All available keyboard shortcuts in Yanta"
            >
              <ShortcutsTable shortcuts={shortcuts} />
            </SettingsSection>
          </div>

          {/* Logging Settings */}
          <div ref={loggingRef}>
            <SettingsSection
              title="Logging"
              subtitle="Configure application logging level"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs tracking-wider uppercase text-text-dim">
                    Log Level
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded bg-bg border-border text-text focus:outline-none focus:border-accent"
                    value={systemInfo?.app.logLevel || "info"}
                    onChange={(e) => handleLogLevelChange(e.target.value)}
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </select>
                  <div className="text-xs text-text-dim">
                    Current level:{" "}
                    <span className="font-mono text-accent">
                      {systemInfo?.app.logLevel || "info"}
                    </span>
                  </div>
                </div>
              </div>
            </SettingsSection>
          </div>

          {/* Git Sync Settings */}
          {FEATURES.GIT_SYNC && (
            <div ref={syncRef}>
              <SettingsSection
                title="Git Sync"
                subtitle="Sync your entries with a Git repository"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-text">Enable Git Sync</div>
                      <div className="text-xs text-text-dim">
                        Automatically sync entries to a Git repository
                      </div>
                    </div>
                    <Toggle
                      checked={settings.gitSync.enabled}
                      onChange={handleGitSyncToggle}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs tracking-wider uppercase text-text-dim">
                      Repository Path
                    </label>
                    <div className="flex gap-2">
                      <Input
                        variant="default"
                        placeholder="/Users/username/Documents/yanta-backup"
                        value={settings.gitSync.repositoryPath}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            gitSync: {
                              ...prev.gitSync,
                              repositoryPath: e.target.value,
                            },
                          }))
                        }
                      />
                      <Button variant="secondary" size="sm">
                        Browse
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs tracking-wider uppercase text-text-dim">
                      Remote URL
                    </label>
                    <Input
                      variant="default"
                      placeholder="git@github.com:username/yanta-backup.git"
                      value={settings.gitSync.remoteUrl}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          gitSync: {
                            ...prev.gitSync,
                            remoteUrl: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs tracking-wider uppercase text-text-dim">
                      Sync Frequency
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm border rounded bg-bg border-border text-text focus:outline-none focus:border-accent"
                      value={settings.gitSync.syncFrequency}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          gitSync: {
                            ...prev.gitSync,
                            syncFrequency: e.target.value as any,
                          },
                        }))
                      }
                    >
                      <option value="realtime">
                        Real-time (on every save)
                      </option>
                      <option value="hourly">Every hour</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="manual">Manual only</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="sm">
                      Test Connection
                    </Button>
                    <Button variant="secondary" size="sm">
                      Sync Now
                    </Button>
                    <span className="text-xs text-text-dim">
                      Not configured
                    </span>
                  </div>

                  <div className="text-xs text-text-dim">Last sync: Never</div>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* Export Settings */}
          {FEATURES.EXPORT && (
            <div ref={exportRef}>
              <SettingsSection
                title="Export Options"
                subtitle="Configure default export formats"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs tracking-wider uppercase text-text-dim">
                      Default Export Format
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm border rounded bg-bg border-border text-text focus:outline-none focus:border-accent"
                      value={settings.export.defaultFormat}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          export: {
                            ...prev.export,
                            defaultFormat: e.target.value as any,
                          },
                        }))
                      }
                    >
                      <option value="md">Markdown (.md)</option>
                      <option value="json">JSON (.json)</option>
                      <option value="html">HTML (.html)</option>
                      <option value="txt">Plain Text (.txt)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text">
                      Include timestamps in exports
                    </div>
                    <Toggle
                      checked={settings.export.includeTimestamps}
                      onChange={(checked) =>
                        handleExportToggle("includeTimestamps", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text">
                      Include project context
                    </div>
                    <Toggle
                      checked={settings.export.includeProjectContext}
                      onChange={(checked) =>
                        handleExportToggle("includeProjectContext", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text">
                      Export code blocks with syntax highlighting
                    </div>
                    <Toggle
                      checked={settings.export.includeSyntaxHighlighting}
                      onChange={(checked) =>
                        handleExportToggle("includeSyntaxHighlighting", checked)
                      }
                    />
                  </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* Version Info */}
          <div ref={aboutRef}>
            <SettingsSection
              title="About Yanta"
              subtitle="Version and system information"
            >
              {systemInfo ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Version
                    </div>
                    <div className="font-mono text-sm text-text">
                      {systemInfo.app.version}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Build Commit
                    </div>
                    <div className="font-mono text-sm text-cyan">
                      {systemInfo.app.buildCommit || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Build Date
                    </div>
                    <div className="font-mono text-sm text-text">
                      {systemInfo.app.buildDate || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Platform
                    </div>
                    <div className="font-mono text-sm text-text">
                      {systemInfo.app.platform}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Go Version
                    </div>
                    <div className="font-mono text-sm text-text">
                      {systemInfo.app.goVersion}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Documents
                    </div>
                    <div className="font-mono text-sm text-text">
                      {systemInfo.database.entriesCount}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Projects
                    </div>
                    <div className="font-mono text-sm text-text">
                      {systemInfo.database.projectsCount}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Tags
                    </div>
                    <div className="font-mono text-sm text-text">
                      {systemInfo.database.tagsCount}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs tracking-wider uppercase text-text-dim">
                      Storage Used
                    </div>
                    <div className="font-mono text-sm text-text">
                      {systemInfo.database.storageUsed}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-text-dim">
                  Loading system information...
                </div>
              )}
            </SettingsSection>
          </div>
        </div>
      </div>
    </Layout>
  );
};
