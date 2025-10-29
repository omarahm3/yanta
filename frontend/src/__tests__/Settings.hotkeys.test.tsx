import { render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import React from "react";
import { HotkeyProvider, useHotkeyContext, DialogProvider } from "../contexts";
import type { HotkeyContextValue } from "../types/hotkeys";
import { Settings } from "../pages/Settings";

vi.mock("../hooks/useHelp", () => ({
  useHelp: () => ({ setPageContext: vi.fn() }),
}));

vi.mock("../hooks/useSidebarSections", () => ({
  useSidebarSections: () => [],
}));

vi.mock("../pages/settings/useSettingsController", () => ({
  useSettingsController: () => ({
    systemInfo: null,
    needsRestart: false,
    keepInBackground: false,
    startHidden: false,
    gitInstalled: true,
    currentDataDir: "/test/dir",
    migrationTarget: "",
    setMigrationTarget: vi.fn(),
    isMigrating: false,
    migrationProgress: "",
    gitSync: {
      enabled: false,
      repositoryPath: "",
      remoteUrl: "",
      syncFrequency: "manual",
      autoPush: true,
    },
    logLevelOptions: [],
    syncFrequencyOptions: [],
    handlers: {
      handleLogLevelChange: vi.fn(),
      handleKeepInBackgroundToggle: vi.fn(),
      handleStartHiddenToggle: vi.fn(),
      handleGitSyncToggle: vi.fn(),
      handleSyncFrequencyChange: vi.fn(),
      handleRemoteUrlChange: vi.fn(),
      handleAutoPushToggle: vi.fn(),
      handlePickDirectory: vi.fn(),
      handleMigration: vi.fn(),
      handleSyncNow: vi.fn(),
    },
  }),
}));

const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({
  onReady,
}) => {
  const ctx = useHotkeyContext();
  React.useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);
  return null;
};

const renderSettings = async () => {
  let context: HotkeyContextValue | null = null;

  const result = render(
    <DialogProvider>
      <HotkeyProvider>
        <HotkeyProbe onReady={(ctx) => (context = ctx)} />
        <Settings onNavigate={vi.fn()} />
      </HotkeyProvider>
    </DialogProvider>,
  );

  await waitFor(() => {
    expect(context).not.toBeNull();
  });

  return { context: context!, ...result };
};

describe("Settings hotkeys", () => {
  it("registers j and k hotkeys", async () => {
    const { context } = await renderSettings();

    const registeredHotkeys = context.getRegisteredHotkeys();
    const hotkeyKeys = registeredHotkeys.map((h) => h.key);

    expect(hotkeyKeys).toContain("j");
    expect(hotkeyKeys).toContain("k");
  });

  it("j hotkey navigates to next section", async () => {
    const { context } = await renderSettings();

    const jHotkey = context.getRegisteredHotkeys().find((h) => h.key === "j");
    expect(jHotkey).toBeDefined();
    expect(jHotkey?.description).toBe("Navigate to next section");
    expect(jHotkey?.allowInInput).toBe(false);
  });

  it("k hotkey navigates to previous section", async () => {
    const { context } = await renderSettings();

    const kHotkey = context.getRegisteredHotkeys().find((h) => h.key === "k");
    expect(kHotkey).toBeDefined();
    expect(kHotkey?.description).toBe("Navigate to previous section");
    expect(kHotkey?.allowInInput).toBe(false);
  });
});
