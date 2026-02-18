import { act, render } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaneLayoutState } from "../../../pane/types";

const mockClosePane = vi.fn();
const mockSetActivePane = vi.fn();
const mockOpenDocumentInPane = vi.fn();
const mockSwapPaneDocuments = vi.fn();
const mockOnNavigate = vi.fn();

let mockLayout: PaneLayoutState = {
	root: {
		type: "split" as const,
		id: "split-1",
		direction: "horizontal" as const,
		children: [
			{ type: "leaf" as const, id: "pane-1", documentPath: "proj/doc1" },
			{ type: "leaf" as const, id: "pane-2", documentPath: null },
		],
		sizes: [50, 50] as [number, number],
	},
	activePaneId: "pane-2",
	primaryDocumentPath: "proj/doc1" as string | null,
};

vi.mock("../../../pane", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../pane")>();
	return {
		...actual,
		usePaneLayout: () => ({
			layout: mockLayout,
			activePaneId: mockLayout.activePaneId,
			openDocumentInPane: mockOpenDocumentInPane,
			swapPaneDocuments: mockSwapPaneDocuments,
			setActivePane: mockSetActivePane,
			closePane: mockClosePane,
		}),
	};
});

vi.mock("../PaneNavigateContext", () => ({
	usePaneNavigateContext: () => mockOnNavigate,
}));

vi.mock("../PaneDocumentView", () => ({
	PaneDocumentView: () => <div data-testid="doc-view" />,
}));

vi.mock("../PaneHeader", () => ({
	PaneHeader: () => <div data-testid="pane-header" />,
}));

vi.mock("../EmptyPaneDocumentPicker", () => ({
	EmptyPaneDocumentPicker: () => <div data-testid="empty-pane-picker" />,
}));

vi.mock("../../../hotkeys", () => ({
	useHotkey: () => {},
}));

import { DialogProvider } from "../../../app/context";
import { PaneContent } from "../PaneContent";

const renderPaneContent = (props: React.ComponentProps<typeof PaneContent>) =>
	render(
		<DialogProvider>
			<PaneContent {...props} />
		</DialogProvider>,
	);

describe("PaneContent escape handling", () => {
	beforeEach(() => {
		mockClosePane.mockClear();
		mockOnNavigate.mockClear();
		mockSetActivePane.mockClear();
	});

	it("closes empty pane on ESC when multiple panes exist", () => {
		renderPaneContent({ paneId: "pane-2", documentPath: null });

		act(() => {
			const event = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			});
			window.dispatchEvent(event);
		});

		expect(mockClosePane).toHaveBeenCalledWith("pane-2");
		expect(mockOnNavigate).not.toHaveBeenCalled();
	});

	it("navigates to dashboard on ESC when only one empty pane exists", () => {
		mockLayout = {
			root: { type: "leaf", id: "pane-1", documentPath: null },
			activePaneId: "pane-1",
			primaryDocumentPath: null,
		};

		renderPaneContent({ paneId: "pane-1", documentPath: null });

		act(() => {
			const event = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			});
			window.dispatchEvent(event);
		});

		expect(mockClosePane).not.toHaveBeenCalled();
		expect(mockOnNavigate).toHaveBeenCalledWith("dashboard");
	});

	it("does not handle ESC when pane is not active", () => {
		mockLayout = {
			root: {
				type: "split" as const,
				id: "split-1",
				direction: "horizontal" as const,
				children: [
					{ type: "leaf" as const, id: "pane-1", documentPath: null },
					{ type: "leaf" as const, id: "pane-2", documentPath: null },
				],
				sizes: [50, 50] as [number, number],
			},
			activePaneId: "pane-1",
			primaryDocumentPath: null,
		};

		renderPaneContent({ paneId: "pane-2", documentPath: null });

		act(() => {
			const event = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			});
			window.dispatchEvent(event);
		});

		expect(mockClosePane).not.toHaveBeenCalled();
		expect(mockOnNavigate).not.toHaveBeenCalled();
	});

	it("does not handle ESC for panes with a document loaded", () => {
		mockLayout = {
			root: { type: "leaf", id: "pane-1", documentPath: "proj/doc1" },
			activePaneId: "pane-1",
			primaryDocumentPath: "proj/doc1",
		};

		renderPaneContent({ paneId: "pane-1", documentPath: "proj/doc1" });

		act(() => {
			const event = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			});
			window.dispatchEvent(event);
		});

		// With a document loaded, PaneContent's own ESC listener is inactive;
		// escape is handled by PaneDocumentView instead
		expect(mockClosePane).not.toHaveBeenCalled();
		expect(mockOnNavigate).not.toHaveBeenCalled();
	});
});
