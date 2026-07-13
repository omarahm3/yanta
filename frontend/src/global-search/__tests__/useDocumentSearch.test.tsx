import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentSearch } from "../useDocumentSearch";

vi.mock("../../search-index/searchIndex.store", () => ({
	useSearchIndexStore: vi.fn(),
}));

vi.mock("../../shared/services/DocumentService", () => ({
	listRecentDocuments: vi.fn().mockResolvedValue([]),
}));

import { useSearchIndexStore } from "../../search-index/searchIndex.store";

const mockUseSearchIndexStore = vi.mocked(useSearchIndexStore);

function renderHook() {
	let result: ReturnType<typeof useDocumentSearch> | undefined;
	function TestComponent() {
		result = useDocumentSearch();
		return null;
	}
	render(<TestComponent />);
	return result!;
}

describe("useDocumentSearch — MRG-353", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns isError=true when status is error", () => {
		mockUseSearchIndexStore.mockImplementation((selector: (s: unknown) => unknown) => {
			const state = { status: "error", search: vi.fn(), build: vi.fn() };
			return selector(state);
		});
		const { isError, error } = renderHook();
		expect(isError).toBe(true);
		expect(error).toBe("Search index unavailable.");
	});

	it("returns isUpdating=true when status is building", () => {
		mockUseSearchIndexStore.mockImplementation((selector: (s: unknown) => unknown) => {
			const state = { status: "building", search: vi.fn(), build: vi.fn() };
			return selector(state);
		});
		const { isUpdating } = renderHook();
		expect(isUpdating).toBe(true);
	});

	it("rebuild calls the store build function", () => {
		const buildFn = vi.fn().mockResolvedValue(undefined);
		mockUseSearchIndexStore.mockImplementation((selector: (s: unknown) => unknown) => {
			const state = { status: "error", search: vi.fn(), build: buildFn };
			return selector(state);
		});
		const { rebuild } = renderHook();
		rebuild();
		expect(buildFn).toHaveBeenCalled();
	});
});
