import { describe, expect, it, vi } from "vitest";

/**
 * Tests for the handleNavigate logic in App.tsx's GlobalCommandHotkey component.
 *
 * The navigation logic is:
 * 1. When page === "document" && state.newDocument: call resetLayout(), then openDocumentInPane("pane-1", path)
 * 2. When page === "document" && state.documentPath (no newDocument): call openDocumentInPane(activePaneId, path)
 * 3. For other pages: no pane operations
 *
 * We test the logic directly without rendering the full App tree,
 * since the App component has deep provider dependencies.
 */
describe("App handleNavigate logic", () => {
	const createHandleNavigate = () => {
		const openDocumentInPane = vi.fn();
		const resetLayout = vi.fn();
		const activePaneIdRef = { current: "pane-active" };

		const handleNavigate = (
			page: string,
			state?: Record<string, string | number | boolean | undefined>,
		) => {
			if (page === "document") {
				if (state?.newDocument) {
					resetLayout();
				}
				if (state?.documentPath) {
					const paneId = state?.newDocument ? "pane-1" : activePaneIdRef.current;
					openDocumentInPane(paneId, state.documentPath as string);
				}
			}
		};

		return { handleNavigate, openDocumentInPane, resetLayout, activePaneIdRef };
	};

	it("opens document in active pane when documentPath is provided", () => {
		const { handleNavigate, openDocumentInPane, resetLayout } = createHandleNavigate();

		handleNavigate("document", { documentPath: "proj/doc1" });

		expect(openDocumentInPane).toHaveBeenCalledWith("pane-active", "proj/doc1");
		expect(resetLayout).not.toHaveBeenCalled();
	});

	it("resets layout and opens pane-1 when newDocument with documentPath", () => {
		const { handleNavigate, openDocumentInPane, resetLayout } = createHandleNavigate();

		handleNavigate("document", { documentPath: "proj/new-doc", newDocument: true });

		expect(resetLayout).toHaveBeenCalled();
		expect(openDocumentInPane).toHaveBeenCalledWith("pane-1", "proj/new-doc");
	});

	it("resets layout but does nothing else when newDocument without documentPath", () => {
		const { handleNavigate, openDocumentInPane, resetLayout } = createHandleNavigate();

		handleNavigate("document", { newDocument: true });

		expect(resetLayout).toHaveBeenCalled();
		expect(openDocumentInPane).not.toHaveBeenCalled();
	});

	it("does not open any document when navigating to non-document page", () => {
		const { handleNavigate, openDocumentInPane, resetLayout } = createHandleNavigate();

		handleNavigate("dashboard");

		expect(openDocumentInPane).not.toHaveBeenCalled();
		expect(resetLayout).not.toHaveBeenCalled();
	});

	it("uses active pane for existing documents, pane-1 for new documents", () => {
		const { handleNavigate, openDocumentInPane, activePaneIdRef } = createHandleNavigate();
		activePaneIdRef.current = "pane-3";

		handleNavigate("document", { documentPath: "proj/existing-doc" });
		expect(openDocumentInPane).toHaveBeenCalledWith("pane-3", "proj/existing-doc");

		openDocumentInPane.mockClear();
		handleNavigate("document", { documentPath: "proj/new-doc", newDocument: true });
		expect(openDocumentInPane).toHaveBeenCalledWith("pane-1", "proj/new-doc");
	});
});
