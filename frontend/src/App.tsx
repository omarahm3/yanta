import React from "react";
import { Router } from "./components/Router";
import { HelpModal } from "./components/HelpModal";
import { GlobalCommandPalette } from "./components";
import { TitleBar } from "./components/TitleBar";
import {
  HotkeyProvider,
  ProjectProvider,
  DocumentProvider,
  DocumentCountProvider,
  HelpProvider,
  DialogProvider,
} from "./contexts";
import { MantineProvider } from "@mantine/core";
import { Notifications, notifications } from "@mantine/notifications";
import { useHotkey } from "./hooks";
import { useHelp } from "./hooks/useHelp";
import { EventsOn } from "../wailsjs/runtime/runtime";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/tailwind.css";
import "./styles/yanta.css";

const HelpHotkey = () => {
  const { openHelp } = useHelp();

  useHotkey({
    key: "shift+/",
    handler: openHelp,
    allowInInput: false,
    description: "Toggle help",
  });

  return null;
};

const GlobalCommandHotkey = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState<string>("dashboard");
  const [navigationState, setNavigationState] = React.useState<
    Record<string, string | number | boolean | undefined>
  >({});
  const [showArchived, setShowArchived] = React.useState(false);
  const toggleArchivedRef = React.useRef<(() => void) | null>(null);

  const handleNavigate = (
    page: string,
    state?: Record<string, string | number | boolean | undefined>,
  ) => {
    setCurrentPage(page);
    setNavigationState(state || {});
  };

  const handleRegisterToggleArchived = React.useCallback(
    (handler: () => void) => {
      toggleArchivedRef.current = handler;
    },
    [],
  );

  const handleToggleArchived = React.useCallback(() => {
    if (toggleArchivedRef.current) {
      toggleArchivedRef.current();
      setShowArchived((prev) => !prev);
    }
  }, []);

  useHotkey({
    key: "mod+K",
    handler: () => setIsOpen(true),
    allowInInput: false,
    description: "Open command palette",
  });

  return (
    <>
      <GlobalCommandPalette
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNavigate={handleNavigate}
        currentPage={currentPage}
        onToggleArchived={handleToggleArchived}
        showArchived={showArchived}
      />
      <Router
        currentPage={currentPage}
        navigationState={navigationState}
        onNavigate={handleNavigate}
        dashboardProps={{
          onRegisterToggleArchived: handleRegisterToggleArchived,
        }}
      />
    </>
  );
};

function App() {
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("[App] Uncaught error:", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[App] Unhandled promise rejection:", {
        reason: event.reason,
        promise: event.promise,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    console.log("[App] Global error handlers registered");

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  React.useEffect(() => {
    const unsubscribe = EventsOn("yanta/window/hidden", () => {
      notifications.show({
        title: "YANTA is running in background",
        message:
          "Press Ctrl+Shift+Y anywhere to restore, or click the taskbar icon",
        color: "blue",
        autoClose: 5000,
      });
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <MantineProvider
      defaultColorScheme="dark"
      theme={{
        colors: {
          dark: [
            "#f0f6fc",
            "#c9d1d9",
            "#8b949e",
            "#6e7681",
            "#484f58",
            "#30363d",
            "#21262d",
            "#161b22",
            "#0d1117",
            "#010409",
          ],
        },
        primaryColor: "blue",
        defaultRadius: "md",
      }}
    >
      <DialogProvider>
        <HotkeyProvider>
          <HelpProvider>
            <ProjectProvider>
              <DocumentCountProvider>
                <DocumentProvider>
                  <TitleBar />
                  <HelpHotkey />
                  <GlobalCommandHotkey />
                  <Notifications />
                  <HelpModal />
                </DocumentProvider>
              </DocumentCountProvider>
            </ProjectProvider>
          </HelpProvider>
        </HotkeyProvider>
      </DialogProvider>
    </MantineProvider>
  );
}

export default App;
