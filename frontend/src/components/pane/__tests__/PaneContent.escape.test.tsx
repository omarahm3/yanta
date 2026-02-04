import { act, render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClosePane = vi.fn();
const mockSetActivePane = vi.fn();
const mockOpenDocumentInPane = vi.fn();
const mockSwapPaneDocuments = vi.fn();
const mockOnNavigate = vi.fn();

let mockLayout = {
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
};

vi.mock("../../../hooks/usePaneLayout", () => ({
	usePaneLayout: () => ({
		layout: mockLayout,
		activePaneId: mockLayout.activePaneId,
		openDocumentInPane: mockOpenDocumentInPane,
		swapPaneDocuments: mockSwapPaneDocuments,
		setActivePane: mockSetActivePane,
		closePane: mockClosePane,
	}),
}));

vi.mock("../PaneNavigateContext", () => ({
	usePaneNavigateContext: () => mockOnNavigate,
}));

vi.mock("../PaneDocumentView", () => ({
	PaneDocumentView: () => <div data-testid="doc-view" />,
}));

vi.mock("../PaneHeader", () => ({
	PaneHeader: () => <div data-testid="pane-header" />,
}));

vi.mock("../EmptyPane", () => ({
	EmptyPane: () => <div data-testid="empty-pane" />,
}));

import { PaneContent } from "../PaneContent";

describe("PaneContent escape handling", () => {
	beforeEach(() => {
		mockClosePane.mockClear();
		mockOnNavigate.mockClear();
		mockSetActivePane.mockClear();
	});

	it("closes empty pane on ESC when multiple panes exist", () => {
		render(<PaneContent paneId="pane-2" documentPath={null} />);

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

	it("navigates to dashboard on ESC when only one pane exists", () => {
		mockLayout = {
			root: { type: "leaf" as const, id: "pane-1", documentPath: null } as any,
			activePaneId: "pane-1",
		};

		render(<PaneContent paneId="pane-1" documentPath={null} />);

		act(() => {
			const event = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			});
			window.dispatchEvent(event);
		});

		expect(mockOnNavigate).toHaveBeenCalledWith("dashboard");
		expect(mockClosePane).not.toHaveBeenCalled();
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
		};

		render(<PaneContent paneId="pane-2" documentPath={null} />);

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
			root: { type: "leaf" as const, id: "pane-1", documentPath: "proj/doc1" } as any,
			activePaneId: "pane-1",
		};

		render(<PaneContent paneId="pane-1" documentPath="proj/doc1" />);

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
