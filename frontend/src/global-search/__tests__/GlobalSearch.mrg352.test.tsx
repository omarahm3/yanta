import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FinderItem } from "../types";

vi.mock("../../project", () => ({
	useProjectContext: () => ({
		projects: [],
		setCurrentProject: vi.fn(),
	}),
}));

vi.mock("../../shared/stores/documentCommand.store", () => ({
	useDocumentCommandStore: {
		getState: () => ({
			requestFind: vi.fn(),
		}),
	},
}));

vi.mock("../../shared/hooks/useNotification", () => ({
	useNotification: () => ({
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		dismiss: vi.fn(),
		dismissAll: vi.fn(),
		show: vi.fn(),
	}),
}));

const mockUseDocumentSearch = vi.fn();

vi.mock("../useDocumentSearch", () => ({
	useDocumentSearch: () => mockUseDocumentSearch(),
}));

vi.mock("../globalSearch.store", () => ({
	useGlobalSearchStore: (selector?: (s: Record<string, unknown>) => unknown) => {
		const state = {
			isOpen: true,
			close: vi.fn(),
			lastQuery: "",
			setLastQuery: vi.fn(),
		};
		return selector ? selector(state) : state;
	},
}));

vi.mock("../GlobalSearchPreview", () => ({
	GlobalSearchPreview: () => <div>preview</div>,
}));

vi.mock("../../shared/ui/dialog", () => ({
	Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogDescription: () => null,
	DialogTitle: () => null,
}));

vi.mock("../../shared/ui/Kbd", () => ({
	Kbd: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { GlobalSearch } from "../GlobalSearch";

describe("GlobalSearch — MRG-352", () => {
	it("shows match count with label", () => {
		const item: FinderItem = {
			key: "test-doc",
			type: "document",
			title: "Test Document",
			projectAlias: "@work",
			path: "projects/@work/test.json",
			updated: "2026-07-01",
			snippets: [],
			matchCount: 3,
		};

		mockUseDocumentSearch.mockReturnValue({
			query: "test",
			setQuery: vi.fn(),
			items: [item],
			isLoading: false,
			error: null,
			hasQuery: true,
			isUpdating: false,
			isError: false,
			rebuild: vi.fn(),
			retryRecent: vi.fn(),
			recentError: null,
		});

		render(<GlobalSearch onNavigate={vi.fn()} />);

		expect(screen.getByText("3 matches")).toBeInTheDocument();
	});

	it("shows singular match label for count of 1", () => {
		const item: FinderItem = {
			key: "test-doc",
			type: "document",
			title: "Test Document",
			projectAlias: "@work",
			path: "projects/@work/test.json",
			updated: "2026-07-01",
			snippets: [],
			matchCount: 1,
		};

		mockUseDocumentSearch.mockReturnValue({
			query: "test",
			setQuery: vi.fn(),
			items: [item],
			isLoading: false,
			error: null,
			hasQuery: true,
			isUpdating: false,
			isError: false,
			rebuild: vi.fn(),
			retryRecent: vi.fn(),
			recentError: null,
		});

		render(<GlobalSearch onNavigate={vi.fn()} />);

		expect(screen.getByText("1 match")).toBeInTheDocument();
	});
});
