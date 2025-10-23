import { render, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import React from "react";
import { HelpModal } from "../components/HelpModal";

const closeHelp = vi.fn();

vi.mock("../hooks/useHelp", () => ({
  useHelp: () => ({
    isOpen: true,
    closeHelp,
    pageCommands: [
      { command: "test", description: "Test command" },
    ],
    pageName: "Test Page",
  }),
}));

vi.mock("../contexts/HotkeyContext", () => ({
  useHotkeyContext: () => ({
    getRegisteredHotkeys: () => [
      {
        id: "1",
        key: "mod+s",
        description: "Save",
        handler: vi.fn(),
      },
    ],
  }),
}));

describe("HelpModal hotkeys", () => {
  beforeEach(() => {
    closeHelp.mockClear();
  });

  it("closes with Escape", () => {
    render(<HelpModal />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeHelp).toHaveBeenCalledTimes(1);
  });

  it("closes with ?", () => {
    render(<HelpModal />);

    fireEvent.keyDown(document, { key: "?" });
    expect(closeHelp).toHaveBeenCalledTimes(1);
  });
});
