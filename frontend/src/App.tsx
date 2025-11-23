import { Events } from "@wailsio/runtime";
import React from "react";
import {
  BackgroundQuit,
  ForceQuit,
} from "../bindings/yanta/internal/system/service";
import { GlobalCommandPalette } from "./components";
import { Router } from "./components/Router";
import { HelpModal, ResizeHandles, TitleBar, ToastProvider, useToast } from "./components/ui";
import {
  DialogProvider,
  DocumentCountProvider,
  DocumentProvider,
  HelpProvider,
  HotkeyProvider,
  ProjectProvider,
  TitleBarProvider,
} from "./contexts";
import { useHotkey } from "./hooks";
import { useHelp } from "./hooks/useHelp";

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

const QuitHotkeys = () => {
  useHotkey({
    key: "ctrl+q",
    handler: (e) => {
      e.preventDefault();
      BackgroundQuit();
    },
    allowInInput: true,
    description: "Quit (background if enabled)",
  });

  useHotkey({
    key: "ctrl+shift+q",
    handler: (e) => {
      e.preventDefault();
      ForceQuit();
    },
    allowInInput: true,
    description: "Force quit application",
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

  const handleNavigate = React.useCallback(
    (
      page: string,
      state?: Record<string, string | number | boolean | undefined>
    ) => {
      setCurrentPage(page);
      setNavigationState(state || {});
    },
    []
  );

  const handleRegisterToggleArchived = React.useCallback(
    (handler: () => void) => {
      toggleArchivedRef.current = handler;
    },
    []
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

const WindowEventListener = () => {
  const toast = useToast();

  React.useEffect(() => {
    const unsubscribe = Events.On("yanta/window/hidden", () => {
      toast.info(
        "YANTA is running in background. Press Ctrl+Shift+Y anywhere to restore, or click the taskbar icon",
        { duration: 5000 }
      );
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [toast]);

  return null;
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
        handleUnhandledRejection
      );
    };
  }, []);

  return (
    <ToastProvider>
      <TitleBarProvider>
        <DialogProvider>
          <HotkeyProvider>
            <HelpProvider>
              <ProjectProvider>
                <DocumentCountProvider>
                  <DocumentProvider>
                    <ResizeHandles />
                    <TitleBar />
                    <HelpHotkey />
                    <QuitHotkeys />
                    <GlobalCommandHotkey />
                    <WindowEventListener />
                    <HelpModal />
                  </DocumentProvider>
                </DocumentCountProvider>
              </ProjectProvider>
            </HelpProvider>
          </HotkeyProvider>
        </DialogProvider>
      </TitleBarProvider>
    </ToastProvider>
  );
}

export default App;
