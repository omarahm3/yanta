import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentPersistence } from "../hooks/useDocumentPersistence";
import type { Project } from "../types/Project";

vi.mock("../hooks/useDocumentSaver", () => ({
	useAutoDocumentSaver: () => {
		const mockSave = vi.fn(async () => "/path/to/doc");
		return { save: mockSave, isSaving: false };
	},
}));

vi.mock("../hooks/useAutoSave", () => ({
	useAutoSave: ({ onSave }: { onSave: () => void | Promise<void> }) => ({
		saveState: "idle",
		lastSaved: null,
		saveError: null,
		saveNow: onSave,
		hasUnsavedChanges: false,
	}),
}));

describe("useDocumentPersistence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const mockFormData = {
		title: "Test Document",
		blocks: [],
		tags: ["test"],
	};

	const mockProject: Project = {
		id: "test-id",
		alias: "test-project",
		name: "Test Project",
		startDate: "2024-01-01",
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
	};

	describe("Auto-save behavior", () => {
		it("should save automatically without notifications", async () => {
			const mockResetChanges = vi.fn();
			const mockOnAutoSaveComplete = vi.fn();
			const consoleErrorSpy = vi.spyOn(console, "error");

			const { result } = renderHook(() =>
				useDocumentPersistence({
					formData: mockFormData,
					hasChanges: true,
					currentProject: mockProject,
					documentPath: "/test/doc",
					isEditMode: true,
					isLoading: false,
					shouldAutoSave: false,
					resetChanges: mockResetChanges,
					onAutoSaveComplete: mockOnAutoSaveComplete,
				}),
			);

			await act(async () => {
				await result.current.autoSave.saveNow();
			});

			await waitFor(() => {
				expect(mockResetChanges).toHaveBeenCalled();
			});

			expect(consoleErrorSpy).not.toHaveBeenCalled();
			consoleErrorSpy.mockRestore();
		});

		it("should prevent concurrent saves", async () => {
			const mockResetChanges = vi.fn();
			const mockOnAutoSaveComplete = vi.fn();

			const { result } = renderHook(() =>
				useDocumentPersistence({
					formData: mockFormData,
					hasChanges: true,
					currentProject: mockProject,
					documentPath: "/test/doc",
					isEditMode: true,
					isLoading: false,
					shouldAutoSave: false,
					resetChanges: mockResetChanges,
					onAutoSaveComplete: mockOnAutoSaveComplete,
				}),
			);

			const save1 = result.current.autoSave.saveNow();
			const save2 = result.current.autoSave.saveNow();
			const save3 = result.current.autoSave.saveNow();

			await act(async () => {
				await Promise.all([save1, save2, save3]);
			});

			expect(mockResetChanges).toHaveBeenCalled();
		});

		it.skip("should handle errors silently", async () => {
			const mockResetChanges = vi.fn();
			const mockOnAutoSaveComplete = vi.fn();
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			vi.doMock("../hooks/useDocumentSaver", () => ({
				useAutoDocumentSaver: () => ({
					save: vi.fn(async () => {
						throw new Error("Save failed");
					}),
					isSaving: false,
				}),
			}));

			const { result } = renderHook(() =>
				useDocumentPersistence({
					formData: mockFormData,
					hasChanges: true,
					currentProject: mockProject,
					documentPath: "/test/doc",
					isEditMode: true,
					isLoading: false,
					shouldAutoSave: false,
					resetChanges: mockResetChanges,
					onAutoSaveComplete: mockOnAutoSaveComplete,
				}),
			);

			await act(async () => {
				await result.current.autoSave.saveNow();
			});

			expect(consoleErrorSpy).toHaveBeenCalledWith("Save failed:", expect.any(Error));

			consoleErrorSpy.mockRestore();
		});

		it("should not save when project is missing", async () => {
			const mockResetChanges = vi.fn();
			const mockOnAutoSaveComplete = vi.fn();

			const { result } = renderHook(() =>
				useDocumentPersistence({
					formData: mockFormData,
					hasChanges: true,
					currentProject: null,
					documentPath: "/test/doc",
					isEditMode: true,
					isLoading: false,
					shouldAutoSave: false,
					resetChanges: mockResetChanges,
					onAutoSaveComplete: mockOnAutoSaveComplete,
				}),
			);

			await act(async () => {
				await result.current.autoSave.saveNow();
			});

			expect(mockResetChanges).not.toHaveBeenCalled();
		});
	});

	describe("Auto-save trigger", () => {
		it("should trigger auto-save when shouldAutoSave is true", async () => {
			const mockResetChanges = vi.fn();
			const mockOnAutoSaveComplete = vi.fn();

			const { rerender } = renderHook(
				({ shouldAutoSave }) =>
					useDocumentPersistence({
						formData: mockFormData,
						hasChanges: true,
						currentProject: mockProject,
						documentPath: "/test/doc",
						isEditMode: true,
						isLoading: false,
						shouldAutoSave,
						resetChanges: mockResetChanges,
						onAutoSaveComplete: mockOnAutoSaveComplete,
					}),
				{ initialProps: { shouldAutoSave: false } },
			);

			rerender({ shouldAutoSave: true });

			await waitFor(() => {
				expect(mockOnAutoSaveComplete).toHaveBeenCalled();
				expect(mockResetChanges).toHaveBeenCalled();
			});
		});
	});
});
