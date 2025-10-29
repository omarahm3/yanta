import React, { useRef, useCallback } from "react";
import { ShortcutsTable, Shortcut } from "../components/ui";
import { Layout } from "../components/Layout";
import { useSidebarSections } from "../hooks/useSidebarSections";
import { useHelp } from "../hooks/useHelp";
import { useHotkeys } from "../hooks";
import { useSettingsController } from "./settings/useSettingsController";
import { GeneralSection } from "./settings/GeneralSection";
import { LoggingSection } from "./settings/LoggingSection";
import { GitSyncSection } from "./settings/GitSyncSection";
import { AboutSection } from "./settings/AboutSection";

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
  const controller = useSettingsController();
  const { setPageContext } = useHelp();

  const generalRef = useRef<HTMLDivElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const loggingRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  const [currentSectionIndex, setCurrentSectionIndex] = React.useState(0);

  const sectionIds = ["general", "shortcuts", "logging", "sync", "about"];

  React.useEffect(() => {
    setPageContext([], "Settings");
  }, [setPageContext]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      const refMap: Record<string, React.RefObject<HTMLDivElement>> = {
        general: generalRef,
        shortcuts: shortcutsRef,
        logging: loggingRef,
        sync: syncRef,
        about: aboutRef,
      };

      const ref = refMap[sectionId];
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      const index = sectionIds.indexOf(sectionId);
      if (index !== -1) {
        setCurrentSectionIndex(index);
      }
    },
    [sectionIds],
  );

  const handleNextSection = useCallback(() => {
    const nextIndex = Math.min(currentSectionIndex + 1, sectionIds.length - 1);
    setCurrentSectionIndex(nextIndex);
    scrollToSection(sectionIds[nextIndex]);
  }, [currentSectionIndex, sectionIds, scrollToSection]);

  const handlePreviousSection = useCallback(() => {
    const prevIndex = Math.max(currentSectionIndex - 1, 0);
    setCurrentSectionIndex(prevIndex);
    scrollToSection(sectionIds[prevIndex]);
  }, [currentSectionIndex, sectionIds, scrollToSection]);

  const hotkeys = React.useMemo(
    () => [
      {
        key: "j",
        handler: handleNextSection,
        allowInInput: false,
        description: "Navigate to next section",
      },
      {
        key: "k",
        handler: handlePreviousSection,
        allowInInput: false,
        description: "Navigate to previous section",
      },
    ],
    [handleNextSection, handlePreviousSection],
  );

  useHotkeys(hotkeys);

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
    {
      id: "sync",
      label: "sync",
      onClick: () => scrollToSection("sync"),
    },
    {
      id: "about",
      label: "about",
      onClick: () => scrollToSection("about"),
    },
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
      <div className="h-full p-5 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {controller.needsRestart && (
            <div className="p-4 mb-6 border border-yellow-700 rounded bg-yellow-900/30">
              <div className="mb-1 font-medium text-yellow-400">
                Restart Required
              </div>
              <div className="text-sm text-yellow-300">
                Please restart the application for the log level changes to take
                effect.
              </div>
            </div>
          )}

          <GeneralSection
            ref={generalRef}
            systemInfo={controller.systemInfo}
            keepInBackground={controller.keepInBackground}
            startHidden={controller.startHidden}
            onKeepInBackgroundToggle={
              controller.handlers.handleKeepInBackgroundToggle
            }
            onStartHiddenToggle={controller.handlers.handleStartHiddenToggle}
          />

          <div ref={shortcutsRef}>
            <div className="mt-8">
              <div className="mb-6">
                <h2 className="text-base font-medium text-text-bright">
                  Keyboard Shortcuts
                </h2>
                <p className="text-sm text-text-dim">
                  All available keyboard shortcuts in Yanta
                </p>
              </div>
              <ShortcutsTable shortcuts={actualShortcuts} />
            </div>
          </div>

          <LoggingSection
            ref={loggingRef}
            systemInfo={controller.systemInfo}
            logLevelOptions={controller.logLevelOptions}
            onLogLevelChange={controller.handlers.handleLogLevelChange}
          />

          <GitSyncSection
            ref={syncRef}
            gitInstalled={controller.gitInstalled}
            currentDataDir={controller.currentDataDir}
            migrationTarget={controller.migrationTarget}
            setMigrationTarget={controller.setMigrationTarget}
            isMigrating={controller.isMigrating}
            migrationProgress={controller.migrationProgress}
            gitSyncEnabled={controller.gitSync.enabled}
            syncFrequency={controller.gitSync.syncFrequency}
            autoPush={controller.gitSync.autoPush}
            syncFrequencyOptions={controller.syncFrequencyOptions}
            onGitSyncToggle={controller.handlers.handleGitSyncToggle}
            onSyncFrequencyChange={
              controller.handlers.handleSyncFrequencyChange
            }
            onAutoPushToggle={controller.handlers.handleAutoPushToggle}
            onPickDirectory={controller.handlers.handlePickDirectory}
            onMigration={controller.handlers.handleMigration}
            onSyncNow={controller.handlers.handleSyncNow}
          />

          <AboutSection ref={aboutRef} systemInfo={controller.systemInfo} />
        </div>
      </div>
    </Layout>
  );
};
