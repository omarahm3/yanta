import React, { useRef, useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";
import { HotkeyProvider, DialogProvider, useHotkeyContext } from "../contexts";
import type { HotkeyContextValue } from "../types/hotkeys";

const executeGlobalCommand = vi.fn();

vi.mock("../hooks/useGlobalCommand", () => ({
  useGlobalCommand: () => ({
    executeGlobalCommand: async (command: string) => {
      executeGlobalCommand(command);
      return { handled: false };
    },
  }),
}));

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../hooks/useNotification", () => ({
  useNotification: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

vi.mock("../contexts", async () => {
  const actual =
    await vi.importActual<typeof import("../contexts")>("../contexts");
  return {
    ...actual,
    useProjectContext: () => ({
      currentProject: { name: "Test Project" },
    }),
  };
});

vi.mock("../components/ui", () => ({
  __esModule: true,
  HeaderBar: ({ currentPage }: { currentPage: string }) => (
    <div data-testid="header">{currentPage}</div>
  ),
  Sidebar: ({ title }: { title?: string }) => (
    <div data-testid="sidebar">{title ?? "Sidebar"}</div>
  ),
}));

import { Layout } from "../components/Layout";

const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({
  onReady,
}) => {
  const ctx = useHotkeyContext();
  React.useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);
  return null;
};

describe("Layout hotkeys", () => {
  beforeEach(() => {
    executeGlobalCommand.mockClear();
    mockSuccess.mockClear();
    mockError.mockClear();
  });

  const Wrapper: React.FC<{
    onContext: (ctx: HotkeyContextValue) => void;
  }> = ({ onContext }) => {
    const [value, setValue] = useState("");
    const commandInputRef = useRef<HTMLInputElement>(null);

    return (
      <DialogProvider>
      <HotkeyProvider>
        <HotkeyProbe onReady={onContext} />
        <Layout
          sidebarTitle="Test Sidebar"
          currentPage="dashboard"
          showCommandLine
          commandContext="test"
          commandPlaceholder="command"
          commandValue={value}
          onCommandChange={setValue}
          onCommandSubmit={vi.fn()}
          commandInputRef={commandInputRef}
        >
          <div data-testid="content">content</div>
        </Layout>
      </HotkeyProvider>
    </DialogProvider>
    );
  };

  const setup = async () => {
    let context: HotkeyContextValue | null = null;
    render(<Wrapper onContext={(ctx) => (context = ctx)} />);
    await waitFor(() => expect(context).not.toBeNull());
    return context!;
  };

  it("toggles sidebar with ctrl+b", async () => {
    const ctx = await setup();
    const root = screen.getByTestId("layout-root");
    expect(root).toHaveAttribute("data-sidebar-visible", "true");

    const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "ctrl+b");
    expect(hotkey).toBeDefined();

    await act(async () => {
      hotkey!.handler(
        new KeyboardEvent("keydown", { key: "b", ctrlKey: true, code: "KeyB" }),
      );
    });

    await waitFor(() =>
      expect(root).toHaveAttribute("data-sidebar-visible", "false"),
    );

    const toggleSidebar = ctx
      .getRegisteredHotkeys()
      .find((h) => h.key === "mod+e");
    expect(toggleSidebar).toBeDefined();

    await act(async () => {
      toggleSidebar!.handler(
        new KeyboardEvent("keydown", { key: "e", ctrlKey: true, code: "KeyE" }),
      );
    });

    await waitFor(() =>
      expect(root).toHaveAttribute("data-sidebar-visible", "true"),
    );
  });

  it("focuses command line with shift+;", async () => {
    const ctx = await setup();
    const commandInput = screen.getByPlaceholderText("command");

    const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "shift+;");
    expect(hotkey).toBeDefined();

    await act(async () => {
      hotkey!.handler(
        new KeyboardEvent("keydown", {
          key: ":",
          shiftKey: true,
          code: "Semicolon",
        }),
      );
    });

    await waitFor(() => expect(commandInput).toHaveFocus());
  });

  it("blurs command line and clears value on Escape", async () => {
    const ctx = await setup();
    const commandInput = screen.getByPlaceholderText(
      "command",
    ) as HTMLInputElement;

    commandInput.focus();
    fireEvent.change(commandInput, { target: { value: "something" } });

    const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === "Escape");
    expect(hotkey).toBeDefined();

    await act(async () => {
      hotkey!.handler(
        new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }),
      );
    });

    await waitFor(() => expect(commandInput).not.toHaveFocus());
    expect(commandInput.value).toBe("");
  });
});
