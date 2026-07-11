import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorSection } from "../EditorSection";
import { GeneralSection } from "../GeneralSection";

vi.mock("../../shared/ui/Toast", () => ({
	ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	useToast: () => ({
		show: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		dismiss: vi.fn(),
		dismissAll: vi.fn(),
	}),
}));

describe("EditorSection (MRG-363)", () => {
	const mockOnChange = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders editor settings controls", () => {
		render(<EditorSection editorPrefs={{}} onEditorPrefsChange={mockOnChange} />);

		expect(screen.getByText("Font Size")).toBeInTheDocument();
		expect(screen.getByText("Font Family")).toBeInTheDocument();
		expect(screen.getByText("Line Width")).toBeInTheDocument();
		expect(screen.getByText("Spellcheck")).toBeInTheDocument();
	});

	it("renders with default values", () => {
		render(<EditorSection editorPrefs={{}} onEditorPrefsChange={mockOnChange} />);

		expect(screen.getByText("Font Size")).toBeInTheDocument();
		expect(screen.getByText("Font Family")).toBeInTheDocument();
		expect(screen.getByText("Line Width")).toBeInTheDocument();
		expect(screen.getByText("Spellcheck")).toBeInTheDocument();
	});

	it("calls onEditorPrefsChange when spellcheck is toggled", () => {
		render(<EditorSection editorPrefs={{ spellcheck: true }} onEditorPrefsChange={mockOnChange} />);

		const spellcheckToggle = screen.getByRole("switch");
		fireEvent.click(spellcheckToggle);

		expect(mockOnChange).toHaveBeenCalledWith(
			expect.objectContaining({ spellcheck: false }),
		);
	});
});

describe("GeneralSection launch at startup (MRG-363)", () => {
	const mockLaunchToggle = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders launch at startup toggle on all platforms", () => {
		render(
			<GeneralSection
				systemInfo={{ app: { platform: "darwin" } } as never}
				keepInBackground={false}
				startHidden={false}
				linuxWindowMode="normal"
				launchAtStartup={false}
				onKeepInBackgroundToggle={vi.fn()}
				onStartHiddenToggle={vi.fn()}
				onLinuxWindowModeToggle={vi.fn()}
				onLaunchAtStartupToggle={mockLaunchToggle}
			/>,
		);

		expect(screen.getByText("Launch at startup")).toBeInTheDocument();
	});

	it("calls onLaunchAtStartupToggle when toggled", () => {
		render(
			<GeneralSection
				systemInfo={{ app: { platform: "darwin" } } as never}
				keepInBackground={false}
				startHidden={false}
				linuxWindowMode="normal"
				launchAtStartup={false}
				onKeepInBackgroundToggle={vi.fn()}
				onStartHiddenToggle={vi.fn()}
				onLinuxWindowModeToggle={vi.fn()}
				onLaunchAtStartupToggle={mockLaunchToggle}
			/>,
		);

		const toggle = screen.getByRole("switch");
		fireEvent.click(toggle);

		expect(mockLaunchToggle).toHaveBeenCalledWith(true);
	});

	it("shows platform-specific description for macOS", () => {
		render(
			<GeneralSection
				systemInfo={{ app: { platform: "darwin" } } as never}
				keepInBackground={false}
				startHidden={false}
				linuxWindowMode="normal"
				launchAtStartup={false}
				onKeepInBackgroundToggle={vi.fn()}
				onStartHiddenToggle={vi.fn()}
				onLinuxWindowModeToggle={vi.fn()}
				onLaunchAtStartupToggle={vi.fn()}
			/>,
		);

		expect(screen.getByText(/Automatically start YANTA when you log in to your Mac/)).toBeInTheDocument();
	});
});
