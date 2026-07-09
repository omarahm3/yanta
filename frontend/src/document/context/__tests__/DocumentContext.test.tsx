import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentProvider, useDocumentContext } from "../DocumentContext";

const listByProject = vi.fn(() => Promise.resolve([]));

vi.mock("../../../shared/services/DocumentService", () => ({
	DocumentServiceWrapper: {
		listByProject: (alias: string, includeArchived?: boolean) =>
			listByProject(alias, includeArchived),
	},
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<DocumentProvider>{children}</DocumentProvider>
);

describe("DocumentContext refresh", () => {
	beforeEach(() => {
		listByProject.mockClear();
	});

	it("refreshDocuments preserves the archived filter from the last load", async () => {
		const { result } = renderHook(() => useDocumentContext(), { wrapper });

		// Enter the archived view.
		await act(async () => {
			await result.current.loadDocuments("proj", true);
		});
		expect(listByProject).toHaveBeenLastCalledWith("proj", true);

		// An event-driven refresh must keep includeArchived=true, not drop to active-only.
		listByProject.mockClear();
		await act(async () => {
			await result.current.refreshDocuments();
		});
		await waitFor(() => expect(listByProject).toHaveBeenCalledWith("proj", true));
	});

	it("refreshDocuments uses active-only after leaving the archived view", async () => {
		const { result } = renderHook(() => useDocumentContext(), { wrapper });

		await act(async () => {
			await result.current.loadDocuments("proj", true);
		});
		await act(async () => {
			await result.current.loadDocuments("proj", false);
		});

		listByProject.mockClear();
		await act(async () => {
			await result.current.refreshDocuments();
		});
		await waitFor(() => expect(listByProject).toHaveBeenCalledWith("proj", false));
	});
});

describe("DocumentContext race guard (MRG-378)", () => {
	beforeEach(() => {
		listByProject.mockClear();
	});

	it("discards stale responses when project-switch calls overlap", async () => {
		const docA = [{ id: "a", title: "Doc A", path: "/a", createdAt: "", updatedAt: "" }];
		const docB = [{ id: "b", title: "Doc B", path: "/b", createdAt: "", updatedAt: "" }];

		let resolveA: (docs: typeof docA) => void;
		let resolveB: (docs: typeof docB) => void;
		const promiseA = new Promise<typeof docA>((r) => {
			resolveA = r;
		});
		const promiseB = new Promise<typeof docB>((r) => {
			resolveB = r;
		});

		listByProject.mockReturnValueOnce(promiseA).mockReturnValueOnce(promiseB);

		const { result } = renderHook(() => useDocumentContext(), { wrapper });

		// Fire two loads without awaiting — simulates rapid project switching.
		let loadAPromise: Promise<void> = Promise.resolve();
		let loadBPromise: Promise<void> = Promise.resolve();
		await act(async () => {
			loadAPromise = result.current.loadDocuments("projA", false);
			loadBPromise = result.current.loadDocuments("projB", false);
		});

		// Resolve B (latest) first, then A (stale).
		await act(async () => {
			resolveB?.(docB);
			await loadBPromise;
		});
		expect(result.current.documents).toEqual(docB);

		await act(async () => {
			resolveA?.(docA);
			await loadAPromise;
		});
		// A's response must be discarded — B's docs should still be shown.
		expect(result.current.documents).toEqual(docB);
	});
});
