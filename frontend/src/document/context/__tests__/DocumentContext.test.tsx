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
