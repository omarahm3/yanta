import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEPRECATED_COMMAND_MAPPINGS, useCommandDeprecation } from "../useCommandDeprecation";

const mockInfo = vi.fn();

vi.mock("../useNotification", () => ({
	useNotification: () => ({
		success: vi.fn(),
		error: vi.fn(),
		info: mockInfo,
		warning: vi.fn(),
		dismiss: vi.fn(),
		dismissAll: vi.fn(),
	}),
}));

describe("useCommandDeprecation", () => {
	const originalSessionStorage = window.sessionStorage;
	const originalLocalStorage = window.localStorage;

	let sessionStorageStore: Record<string, string> = {};
	let localStorageStore: Record<string, string> = {};

	beforeEach(() => {
		mockInfo.mockReset();
		sessionStorageStore = {};
		localStorageStore = {};

		// Mock sessionStorage
		Object.defineProperty(window, "sessionStorage", {
			value: {
				getItem: (key: string) => sessionStorageStore[key] ?? null,
				setItem: (key: string, value: string) => {
					sessionStorageStore[key] = value;
				},
				removeItem: (key: string) => {
					delete sessionStorageStore[key];
				},
				clear: () => {
					sessionStorageStore = {};
				},
			},
			writable: true,
		});

		// Mock localStorage
		Object.defineProperty(window, "localStorage", {
			value: {
				getItem: (key: string) => localStorageStore[key] ?? null,
				setItem: (key: string, value: string) => {
					localStorageStore[key] = value;
				},
				removeItem: (key: string) => {
					delete localStorageStore[key];
				},
				clear: () => {
					localStorageStore = {};
				},
			},
			writable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(window, "sessionStorage", { value: originalSessionStorage });
		Object.defineProperty(window, "localStorage", { value: originalLocalStorage });
	});

	describe("DEPRECATED_COMMAND_MAPPINGS", () => {
		it("contains mappings for common commands", () => {
			expect(DEPRECATED_COMMAND_MAPPINGS.sync).toEqual({
				paletteAction: "Git Sync",
				shortcut: "Ctrl+K",
			});
			expect(DEPRECATED_COMMAND_MAPPINGS.new).toEqual({
				paletteAction: "New Document",
				shortcut: "Ctrl+N",
			});
			expect(DEPRECATED_COMMAND_MAPPINGS.help).toEqual({
				paletteAction: "Show Help",
				shortcut: "?",
			});
		});
	});

	describe("checkAndWarnDeprecation", () => {
		it("returns false for commands not starting with :", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const warned = result.current.checkAndWarnDeprecation("sync");

			expect(warned).toBe(false);
			expect(mockInfo).not.toHaveBeenCalled();
		});

		it("returns false for empty command", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const warned = result.current.checkAndWarnDeprecation("");

			expect(warned).toBe(false);
			expect(mockInfo).not.toHaveBeenCalled();
		});

		it("returns false for just colon without command", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const warned = result.current.checkAndWarnDeprecation(":");

			expect(warned).toBe(false);
			expect(mockInfo).not.toHaveBeenCalled();
		});

		it("shows full deprecation warning on first use with known command", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const warned = result.current.checkAndWarnDeprecation(":sync");

			expect(warned).toBe(true);
			expect(mockInfo).toHaveBeenCalledWith(
				"Tip: Use Ctrl+K → Git Sync instead. The :command syntax will be removed in a future update.",
				{ duration: 6000 },
			);
		});

		it("shows full deprecation warning on first use with unknown command", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const warned = result.current.checkAndWarnDeprecation(":unknown-command");

			expect(warned).toBe(true);
			expect(mockInfo).toHaveBeenCalledWith(
				"Tip: Use Ctrl+K to access commands. The :command syntax will be removed in a future update.",
				{ duration: 6000 },
			);
		});

		it("shows shorter reminder after first warning in same session", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			// First warning
			result.current.checkAndWarnDeprecation(":sync");
			mockInfo.mockClear();

			// Second warning with different command
			const warned = result.current.checkAndWarnDeprecation(":new");

			expect(warned).toBe(true);
			expect(mockInfo).toHaveBeenCalledWith("Tip: Try Ctrl+N → New Document", { duration: 3000 });
		});

		it("shows shorter reminder when user has seen warning in previous session", () => {
			// Simulate previous session warning
			localStorageStore.yanta_command_line_deprecation_warned = "true";
			sessionStorageStore.yanta_command_line_deprecation_session = "shown";

			const { result } = renderHook(() => useCommandDeprecation());

			const warned = result.current.checkAndWarnDeprecation(":sync");

			expect(warned).toBe(true);
			expect(mockInfo).toHaveBeenCalledWith("Tip: Try Ctrl+K → Git Sync", { duration: 3000 });
		});

		it("handles command with arguments correctly", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const warned = result.current.checkAndWarnDeprecation(":new my-document-title");

			expect(warned).toBe(true);
			expect(mockInfo).toHaveBeenCalledWith(
				"Tip: Use Ctrl+K → New Document instead. The :command syntax will be removed in a future update.",
				{ duration: 6000 },
			);
		});

		it("handles command with extra whitespace correctly", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const warned = result.current.checkAndWarnDeprecation("  :sync  ");

			expect(warned).toBe(true);
			expect(mockInfo).toHaveBeenCalled();
		});

		it("does not repeat warning for the same command", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			// First call
			result.current.checkAndWarnDeprecation(":sync");
			mockInfo.mockClear();

			// Second call with same command - should not show another notification
			const warned = result.current.checkAndWarnDeprecation(":sync");

			expect(warned).toBe(true);
			expect(mockInfo).not.toHaveBeenCalled();
		});

		it("sets localStorage after showing warning", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			result.current.checkAndWarnDeprecation(":sync");

			expect(localStorageStore.yanta_command_line_deprecation_warned).toBe("true");
		});

		it("sets sessionStorage after showing warning", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			result.current.checkAndWarnDeprecation(":sync");

			expect(sessionStorageStore.yanta_command_line_deprecation_session).toBe("shown");
		});
	});

	describe("getPaletteEquivalent", () => {
		it("returns mapping for known :command", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const mapping = result.current.getPaletteEquivalent(":sync");

			expect(mapping).toEqual({
				paletteAction: "Git Sync",
				shortcut: "Ctrl+K",
			});
		});

		it("returns mapping for command with arguments", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const mapping = result.current.getPaletteEquivalent(":new my-document");

			expect(mapping).toEqual({
				paletteAction: "New Document",
				shortcut: "Ctrl+N",
			});
		});

		it("returns undefined for unknown command", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const mapping = result.current.getPaletteEquivalent(":unknown-cmd");

			expect(mapping).toBeUndefined();
		});

		it("returns undefined for command without colon prefix", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const mapping = result.current.getPaletteEquivalent("sync");

			expect(mapping).toBeUndefined();
		});

		it("returns undefined for empty string", () => {
			const { result } = renderHook(() => useCommandDeprecation());

			const mapping = result.current.getPaletteEquivalent("");

			expect(mapping).toBeUndefined();
		});
	});
});
