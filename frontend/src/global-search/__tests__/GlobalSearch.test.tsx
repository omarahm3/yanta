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

// The finder now searches an in-memory MiniSearch index (searchIndex.store)
// instead of round-tripping to the backend. Mock the store so this component
// test stays focused on rendering, selection and open behaviour.
vi.mock("../../search-index/searchIndex.store", () => {
	const authItem = {
		key: "projects/@api/doc-auth.json",
		type: "document" as const,
		title: "Auth Flow",
		projectAlias: "@api",
		path: "projects/@api/doc-auth.json",
		updated: "2026-07-01",
		snippets: ["the <mark>auth</mark> middleware"],
		matchCount: 1,
	};
	const state = {
		status: "ready" as const,
		search: (q: string) => (q.toLowerCase().includes("auth") ? [authItem] : []),
	};
	return {
		useSearchIndexStore: (selector: (s: typeof state) => unknown) => selector(state),
	};
});

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
	// The finder's empty-query state lists recent documents from the vault.
	ListRecent: vi.fn(async () => [
		{
			path: "projects/@api/doc-recent.json",
			project_alias: "@api",
			title: "Recent Doc",
			created_at: "2026-07-01",
			updated_at: "2026-07-01",
			deleted_at: "",
			tags: [],
			has_code: false,
			has_images: false,
			has_links: false,
		},
	]),
}));

// BlockNote can't render in jsdom; stub the read-only preview.
vi.mock("../DocumentPreview", () => ({
	DocumentPreview: () => null,
}));

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

		// Alias shows exactly one "@" — no "@@api" double prefix.
		expect((await screen.findAllByText("@api")).length).toBeGreaterThan(0);
		expect(screen.queryByText("@@api")).toBeNull();
	});

	it("runs a full-text search and opens the selected document on Enter", async () => {
		render(<GlobalSearch onNavigate={onNavigate} />);
		act(() => useGlobalSearchStore.getState().open());

		const input = await screen.findByRole("combobox");
		fireEvent.change(input, { target: { value: "auth" } });

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
