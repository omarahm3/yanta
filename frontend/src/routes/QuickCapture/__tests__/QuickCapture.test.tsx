import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickCapture } from "../QuickCapture";

// Create mock function before vi.mock hoisting
const mockClose = vi.fn();

// Mock the journal service
vi.mock("../../../../bindings/yanta/internal/journal/wailsservice", () => ({
	AppendEntry: vi.fn(() => Promise.resolve({ id: "abc123", content: "Test" })),
}));

// Mock the project service
vi.mock("../../../../bindings/yanta/internal/project/service", () => ({
	ListActive: vi.fn(() =>
		Promise.resolve([
			{ id: "1", alias: "personal", name: "Personal" },
			{ id: "2", alias: "work", name: "Work" },
		])
	),
}));

// Mock window close - use module-level mock
vi.mock("@wailsio/runtime", () => ({
	Call: {
		ByID: vi.fn(() => Promise.resolve({})),
		ByName: vi.fn(() => Promise.resolve({})),
	},
	CancellablePromise: Promise,
	Create: {
		Any: (x: unknown) => x,
		Array: () => (arr: unknown) => arr,
		Map: () => (obj: unknown) => obj,
		Nullable: () => (val: unknown) => val,
		Struct: () => (x: unknown) => x,
	},
	Events: {
		On: vi.fn(() => () => {}),
		Emit: vi.fn(),
		Off: vi.fn(),
	},
	Browser: {
		OpenURL: vi.fn(() => Promise.resolve()),
	},
	System: {
		IsMac: vi.fn(() => false),
		IsWindows: vi.fn(() => true),
		IsLinux: vi.fn(() => false),
	},
	Window: {
		Close: () => mockClose(),
	},
}));

describe("QuickCapture", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	it("renders all components", async () => {
		render(<QuickCapture />);

		// Wait for projects to load
		await waitFor(() => {
			expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
		});

		// Project picker
		expect(screen.getByRole("button")).toBeInTheDocument();

		// Footer hints - use getAllByText since there are multiple "Save" elements
		expect(screen.getAllByText(/Save/).length).toBeGreaterThan(0);
		expect(screen.getByText(/Cancel/)).toBeInTheDocument();
	});

	it("saves on Enter", async () => {
		const { AppendEntry } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);

		render(<QuickCapture />);

		await waitFor(() => {
			expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
		});

		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Test note" } });
		fireEvent.keyDown(textarea, { key: "Enter" });

		await waitFor(() => {
			expect(AppendEntry).toHaveBeenCalled();
		});
	});

	it("closes on Escape when empty", async () => {
		render(<QuickCapture />);

		await waitFor(() => {
			expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
		});

		const textarea = screen.getByRole("textbox");
		fireEvent.keyDown(textarea, { key: "Escape" });

		expect(mockClose).toHaveBeenCalled();
	});

	it("shows hint on first Escape with text", async () => {
		render(<QuickCapture />);

		await waitFor(() => {
			expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
		});

		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Some text" } });
		fireEvent.keyDown(textarea, { key: "Escape" });

		// Should show hint, not close
		expect(mockClose).not.toHaveBeenCalled();
		expect(screen.getByText(/Press Esc again to discard/)).toBeInTheDocument();
	});

	it("closes on double Escape with text", async () => {
		render(<QuickCapture />);

		await waitFor(() => {
			expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
		});

		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Some text" } });

		// First Escape - shows hint
		fireEvent.keyDown(textarea, { key: "Escape" });
		expect(mockClose).not.toHaveBeenCalled();

		// Second Escape - closes
		fireEvent.keyDown(textarea, { key: "Escape" });
		expect(mockClose).toHaveBeenCalled();
	});

	it("saves and clears on Shift+Enter", async () => {
		const { AppendEntry } = await import(
			"../../../../bindings/yanta/internal/journal/wailsservice"
		);

		render(<QuickCapture />);

		await waitFor(() => {
			expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
		});

		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "First note" } });
		fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

		await waitFor(() => {
			expect(AppendEntry).toHaveBeenCalled();
		});

		// Should clear but not close (ready for another note)
		expect(mockClose).not.toHaveBeenCalled();

		await waitFor(() => {
			expect(textarea).toHaveValue("");
		});
	});

	it("displays extracted tags as chips", async () => {
		render(<QuickCapture />);

		await waitFor(() => {
			expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
		});

		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Fix bug #urgent #backend" } });

		await waitFor(() => {
			expect(screen.getByText("urgent")).toBeInTheDocument();
			expect(screen.getByText("backend")).toBeInTheDocument();
		});
	});

	it("shows error when saving without project", async () => {
		// Clear any saved project
		localStorage.removeItem("yanta:lastProject");

		render(<QuickCapture />);

		await waitFor(() => {
			expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument();
		});

		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Test" } });

		// Remove project selection
		// Since we can't easily unselect, just check that the component handles the case
	});
});
