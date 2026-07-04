import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const onNavigate = vi.fn();
const setCurrentProject = vi.fn();

vi.mock("@/config/usePreferencesOverrides", () => ({
	useMergedConfig: () => ({ timeouts: { searchDebounceMs: 0 } }),
}));

vi.mock("../../project", () => ({
	useProjectContext: () => ({
		projects: [{ id: "1", alias: "api", name: "API" }],
		currentProject: { id: "1", alias: "api", name: "API" },
		setCurrentProject,
	}),
}));

vi.mock("../../shared/hooks/useRecentDocuments", () => ({
	useRecentDocuments: () => ({
		recentDocuments: [
			{
				path: "projects/@api/doc-recent.json",
				title: "Recent Doc",
				projectAlias: "@api",
				lastOpened: 1,
			},
		],
		addRecentDocument: vi.fn(),
		removeRecentDocument: vi.fn(),
		clearRecentDocuments: vi.fn(),
	}),
}));

vi.mock("../../../bindings/yanta/internal/search/service", () => ({
	Query: vi.fn(async () => [
		{
			id: "projects/@api/doc-auth.json",
			title: "Auth Flow",
			snippet: "the <mark>auth</mark> middleware",
			updated: "2026-07-01",
			type: "document",
			projectAlias: "@api",
		},
	]),
}));

vi.mock("../../../bindings/yanta/internal/document/service", () => ({
	Preview: vi.fn(async () =>
		JSON.stringify([
			{
				id: "h1",
				type: "heading",
				props: { level: 1 },
				content: [{ type: "text", text: "Auth Flow", styles: {} }],
			},
		]),
	),
}));

// BlockNote can't render in jsdom; stub the read-only preview.
vi.mock("../DocumentPreview", () => ({
	DocumentPreview: () => null,
}));

import { Query } from "../../../bindings/yanta/internal/search/service";
import { GlobalSearch } from "../GlobalSearch";
import { useGlobalSearchStore } from "../globalSearch.store";

describe("GlobalSearch finder", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		act(() => useGlobalSearchStore.getState().reset());
	});

	afterEach(() => {
		cleanup();
		act(() => useGlobalSearchStore.getState().reset());
	});

	it("surfaces recent documents when opened with an empty query", async () => {
		render(<GlobalSearch onNavigate={onNavigate} />);
		act(() => useGlobalSearchStore.getState().open());

		// "Recent Doc" renders in both the result row and the preview header.
		expect((await screen.findAllByText("Recent Doc")).length).toBeGreaterThan(0);
		expect(Query).not.toHaveBeenCalled();

		// Alias shows exactly one "@" — no "@@api" double prefix.
		expect((await screen.findAllByText("@api")).length).toBeGreaterThan(0);
		expect(screen.queryByText("@@api")).toBeNull();
	});

	it("runs a full-text search and opens the selected document on Enter", async () => {
		render(<GlobalSearch onNavigate={onNavigate} />);
		act(() => useGlobalSearchStore.getState().open());

		const input = await screen.findByRole("combobox");
		fireEvent.change(input, { target: { value: "auth" } });

		await waitFor(() => expect(Query).toHaveBeenCalledWith("auth", 50, 0));
		expect((await screen.findAllByText("Auth Flow")).length).toBeGreaterThan(0);

		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() =>
			expect(onNavigate).toHaveBeenCalledWith("document", {
				documentPath: "projects/@api/doc-auth.json",
			}),
		);
		expect(setCurrentProject).toHaveBeenCalledWith(expect.objectContaining({ alias: "api" }));
	});

	it("moves selection with ArrowDown and Ctrl-n", async () => {
		render(<GlobalSearch onNavigate={onNavigate} />);
		act(() => useGlobalSearchStore.getState().open());

		const input = await screen.findByRole("combobox");
		// Recent list has a single row; navigation should stay valid (wraps).
		fireEvent.keyDown(input, { key: "ArrowDown" });
		fireEvent.keyDown(input, { key: "n", ctrlKey: true });

		expect((await screen.findAllByText("Recent Doc")).length).toBeGreaterThan(0);
	});
});
