import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { HotkeyProvider, useHotkeyContext } from "../contexts";
import type { HotkeyContextValue } from "../types/hotkeys";

const onNavigate = vi.fn();
const selectNext = vi.fn();
const selectPrevious = vi.fn();
const loadDocuments = vi.fn();
const setSelectedIndex = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../hooks/useNotification", () => ({
  useNotification: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

vi.mock("../hooks/useHelp", () => ({
  useHelp: () => ({ setPageContext: vi.fn() }),
}));

vi.mock("../hooks/useSidebarSections", () => ({
  __esModule: true,
  useSidebarSections: () => [],
}));

vi.mock("../contexts", async () => {
  const actual =
    await vi.importActual<typeof import("../contexts")>("../contexts");
  return {
    ...actual,
    useProjectContext: () => ({
      currentProject: { alias: "proj", name: "Project" },
      isLoading: false,
    }),
    useDocumentContext: () => ({
      documents: [
        { path: "proj/doc1", title: "Doc 1" },
        { path: "proj/doc2", title: "Doc 2" },
      ],
      loadDocuments,
      isLoading: false,
      selectedIndex: 0,
      setSelectedIndex,
      selectNext,
      selectPrevious,
    }),
  };
});

vi.mock("../components/DocumentList", () => ({
  __esModule: true,
  DocumentList: ({ selectedIndex }: { selectedIndex: number }) => (
    <div data-testid="document-list" data-selected={selectedIndex} />
  ),
}));

vi.mock("../components/StatusBar", () => ({
  __esModule: true,
  StatusBar: () => <div data-testid="status-bar" />, // minimal stub
}));

vi.mock("../../wailsjs/go/commandline/DocumentCommands", () => ({
  ParseWithContext: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../wailsjs/go/models", () => ({
  commandline: {
    DocumentCommand: {
      New: "new",
      Doc: "doc",
      Archive: "archive",
      Unarchive: "unarchive",
      Delete: "delete",
    },
  },
}));

vi.mock("../components/Layout", () => {
  const Layout = ({
    children,
    commandInputRef,
    commandValue,
    onCommandChange,
  }: any) => (
    <div>
      <input
        data-testid="command-input"
        ref={commandInputRef}
        value={commandValue}
        onChange={(e) => onCommandChange?.(e.target.value)}
      />
      {children}
    </div>
  );
  return { __esModule: true, Layout };
});

import { Dashboard } from "../pages/Dashboard";

const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({
  onReady,
}) => {
  const ctx = useHotkeyContext();
  React.useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);
  return null;
};

describe("Dashboard hotkeys", () => {
  beforeEach(() => {
    onNavigate.mockClear();
    selectNext.mockClear();
    selectPrevious.mockClear();
    loadDocuments.mockClear();
    setSelectedIndex.mockClear();
    mockSuccess.mockClear();
    mockError.mockClear();
    vi.useRealTimers();
  });

  const Wrapper: React.FC<{ onContext: (ctx: HotkeyContextValue) => void }> = ({
    onContext,
  }) => (
    <HotkeyProvider>
      <HotkeyProbe onReady={onContext} />
      <Dashboard onNavigate={onNavigate} onRegisterToggleArchived={() => {}} />
    </HotkeyProvider>
  );

  const renderDashboard = async () => {
    let ctx: HotkeyContextValue | null = null;
    render(<Wrapper onContext={(value) => (ctx = value)} />);
    await waitFor(() => expect(ctx).not.toBeNull());
    return ctx!;
  };

  const getHotkey = (ctx: HotkeyContextValue, key: string) => {
    const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === key);
    expect(hotkey).toBeDefined();
    return hotkey!;
  };

  it("navigates to new document with mod+N", async () => {
    const ctx = await renderDashboard();
    const modN = getHotkey(ctx, "mod+N");
    await act(async () => {
      modN.handler(new KeyboardEvent("keydown", { key: "n", ctrlKey: true }));
    });
    expect(onNavigate).toHaveBeenCalledWith("document");
  });

  it("toggles archived view with mod+shift+A", async () => {
    const ctx = await renderDashboard();
    const toggleHotkey = getHotkey(ctx, "mod+shift+A");
    vi.useFakeTimers();
    await act(async () => {
      toggleHotkey.handler(
        new KeyboardEvent("keydown", {
          key: "A",
          ctrlKey: true,
          shiftKey: true,
        }),
      );
    });
    vi.runAllTimers();
    expect(mockSuccess).toHaveBeenLastCalledWith("Showing archived documents");
    vi.useRealTimers();
  });

  it("moves selection down with j", async () => {
    const ctx = await renderDashboard();
    const jHotkey = getHotkey(ctx, "j");
    await act(async () => {
      jHotkey.handler(new KeyboardEvent("keydown", { key: "j" }));
    });
    expect(selectNext).toHaveBeenCalled();
  });

  it("moves selection with arrow keys", async () => {
    const ctx = await renderDashboard();
    const downHotkey = getHotkey(ctx, "ArrowDown");
    const upHotkey = getHotkey(ctx, "ArrowUp");
    await act(async () => {
      downHotkey.handler(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      upHotkey.handler(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(selectNext).toHaveBeenCalled();
    expect(selectPrevious).toHaveBeenCalled();
  });

  it("opens selected document with Enter", async () => {
    const ctx = await renderDashboard();
    const enterHotkey = getHotkey(ctx, "Enter");
    await act(async () => {
      enterHotkey.handler(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(onNavigate).toHaveBeenCalledWith("document", {
      documentPath: "proj/doc1",
    });
  });

  it("prepares archive/unarchive commands", async () => {
    const ctx = await renderDashboard();
    const archiveHotkey = getHotkey(ctx, "mod+A");
    const unarchiveHotkey = getHotkey(ctx, "mod+U");

    const input = screen.getByTestId("command-input") as HTMLInputElement;
    vi.useFakeTimers();
    await act(async () => {
      archiveHotkey.handler(
        new KeyboardEvent("keydown", { key: "a", ctrlKey: true }),
      );
    });
    vi.runAllTimers();
    expect(input.value).toBe("archive ");

    await act(async () => {
      unarchiveHotkey.handler(
        new KeyboardEvent("keydown", { key: "u", ctrlKey: true }),
      );
    });
    expect(input.value).toBe("unarchive ");
    vi.useRealTimers();
  });
});
