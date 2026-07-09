import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();

vi.mock("../../../shared/services/DocumentService", () => ({
	DocumentServiceWrapper: {
		get: (path: string) => mockGet(path),
	},
}));

import { useDocumentLoader } from "../useDocumentLoader";

describe("useDocumentLoader (MRG-328)", () => {
	it("returns error string when load fails", async () => {
		mockGet.mockRejectedValueOnce(new Error("document not found"));

		const { result } = renderHook(() => useDocumentLoader("/path/to/doc"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.error).toBe("document not found");
		expect(result.current.data).toBeNull();
	});

	it("reload() re-triggers the fetch after an error", async () => {
		mockGet
			.mockRejectedValueOnce(new Error("document file corrupted"))
			.mockResolvedValueOnce({ id: "1", title: "Doc", path: "/path", blocks: [], tags: [] });

		const { result } = renderHook(() => useDocumentLoader("/path/to/doc"));

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.error).toBe("document file corrupted");

		await act(async () => {
			result.current.reload();
		});

		await waitFor(() => expect(result.current.error).toBeNull());
		expect(result.current.data).toEqual({
			id: "1",
			title: "Doc",
			path: "/path",
			blocks: [],
			tags: [],
		});
	});

	it("reload() re-triggers the fetch after a successful load", async () => {
		const doc1 = { id: "1", title: "V1", path: "/path", blocks: [], tags: [] };
		const doc2 = { id: "1", title: "V2", path: "/path", blocks: [], tags: [] };
		mockGet.mockResolvedValueOnce(doc1).mockResolvedValueOnce(doc2);

		const { result } = renderHook(() => useDocumentLoader("/path/to/doc"));

		await waitFor(() => expect(result.current.data).toEqual(doc1));

		await act(async () => {
			result.current.reload();
		});

		await waitFor(() => expect(result.current.data).toEqual(doc2));
	});
});
