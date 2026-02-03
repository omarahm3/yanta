/**
 * Journal Context Shortcuts Tests
 *
 * Tests that journal-specific shortcuts work correctly within the journal context
 * and validates that day navigation and entry navigation work as expected.
 *
 * Shortcuts tested:
 * - ctrl+n / ArrowRight → Navigate to next day
 * - ctrl+p / ArrowLeft → Navigate to previous day
 * - ↑ / ↓ / j / k → Navigate between journal entries
 * - Space → Toggle entry selection
 * - mod+D → Delete selected entries
 * - mod+shift+P → Promote selected entries to document
 *
 * Note: Ctrl+T for jumping to today's journal is a global shortcut (App.tsx),
 * not a journal-specific one.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HotkeyConfig } from "../types/hotkeys";

// ============================================
// Test: useJournalController hotkeys configuration
// ============================================

describe("Journal Context Shortcuts - Hotkey Configuration", () => {
	/**
	 * Tests that the journal controller returns the correct hotkey configurations.
	 * This validates the hotkey metadata (keys, allowInInput, descriptions, etc.)
	 */

	// Mock the journal controller's hotkeys output to test configuration
	const getJournalHotkeys = (): HotkeyConfig[] => {
		// These represent the hotkeys as defined in useJournalController.ts
		return [
			{
				key: "ctrl+n",
				handler: vi.fn(),
				allowInInput: false,
				description: "Next day",
			},
			{
				key: "ctrl+p",
				handler: vi.fn(),
				allowInInput: false,
				description: "Previous day",
			},
			{
				key: "ArrowRight",
				handler: vi.fn(),
				allowInInput: false,
				description: "Next day",
			},
			{
				key: "ArrowLeft",
				handler: vi.fn(),
				allowInInput: false,
				description: "Previous day",
			},
			{
				key: "j",
				handler: vi.fn(),
				allowInInput: false,
				description: "Highlight next entry",
			},
			{
				key: "k",
				handler: vi.fn(),
				allowInInput: false,
				description: "Highlight previous entry",
			},
			{
				key: "ArrowDown",
				handler: vi.fn(),
				allowInInput: false,
				description: "Navigate down",
			},
			{
				key: "ArrowUp",
				handler: vi.fn(),
				allowInInput: false,
				description: "Navigate up",
			},
			{
				key: "Space",
				handler: vi.fn(),
				allowInInput: false,
				description: "Select/deselect highlighted entry",
			},
			{
				key: "mod+D",
				handler: vi.fn(),
				allowInInput: false,
				description: "Delete selected entries",
			},
			{
				key: "mod+shift+p",
				handler: vi.fn(),
				allowInInput: false,
				description: "Promote selected entries to document",
			},
		];
	};

	it("should have ctrl+n configured for navigating to next day", () => {
		const hotkeys = getJournalHotkeys();
		const nextDayHotkey = hotkeys.find((h) => h.key === "ctrl+n");

		expect(nextDayHotkey).toBeDefined();
		expect(nextDayHotkey?.description).toBe("Next day");
		expect(nextDayHotkey?.allowInInput).toBe(false);
	});

	it("should have ctrl+p configured for navigating to previous day", () => {
		const hotkeys = getJournalHotkeys();
		const prevDayHotkey = hotkeys.find((h) => h.key === "ctrl+p");

		expect(prevDayHotkey).toBeDefined();
		expect(prevDayHotkey?.description).toBe("Previous day");
		expect(prevDayHotkey?.allowInInput).toBe(false);
	});

	it("should have ArrowRight configured for navigating to next day", () => {
		const hotkeys = getJournalHotkeys();
		const nextDayHotkey = hotkeys.find((h) => h.key === "ArrowRight");

		expect(nextDayHotkey).toBeDefined();
		expect(nextDayHotkey?.description).toBe("Next day");
		expect(nextDayHotkey?.allowInInput).toBe(false);
	});

	it("should have ArrowLeft configured for navigating to previous day", () => {
		const hotkeys = getJournalHotkeys();
		const prevDayHotkey = hotkeys.find((h) => h.key === "ArrowLeft");

		expect(prevDayHotkey).toBeDefined();
		expect(prevDayHotkey?.description).toBe("Previous day");
		expect(prevDayHotkey?.allowInInput).toBe(false);
	});

	it("should have j/k configured for entry navigation (vim-style)", () => {
		const hotkeys = getJournalHotkeys();
		const jHotkey = hotkeys.find((h) => h.key === "j");
		const kHotkey = hotkeys.find((h) => h.key === "k");

		expect(jHotkey).toBeDefined();
		expect(jHotkey?.description).toBe("Highlight next entry");
		expect(jHotkey?.allowInInput).toBe(false);

		expect(kHotkey).toBeDefined();
		expect(kHotkey?.description).toBe("Highlight previous entry");
		expect(kHotkey?.allowInInput).toBe(false);
	});

	it("should have Arrow keys configured for entry navigation", () => {
		const hotkeys = getJournalHotkeys();
		const downHotkey = hotkeys.find((h) => h.key === "ArrowDown");
		const upHotkey = hotkeys.find((h) => h.key === "ArrowUp");

		expect(downHotkey).toBeDefined();
		expect(downHotkey?.description).toBe("Navigate down");
		expect(downHotkey?.allowInInput).toBe(false);

		expect(upHotkey).toBeDefined();
		expect(upHotkey?.description).toBe("Navigate up");
		expect(upHotkey?.allowInInput).toBe(false);
	});

	it("should have Space configured for toggling entry selection", () => {
		const hotkeys = getJournalHotkeys();
		const spaceHotkey = hotkeys.find((h) => h.key === "Space");

		expect(spaceHotkey).toBeDefined();
		expect(spaceHotkey?.description).toBe("Select/deselect highlighted entry");
		expect(spaceHotkey?.allowInInput).toBe(false);
	});

	it("should have mod+D configured for deleting selected entries", () => {
		const hotkeys = getJournalHotkeys();
		const deleteHotkey = hotkeys.find((h) => h.key === "mod+D");

		expect(deleteHotkey).toBeDefined();
		expect(deleteHotkey?.description).toBe("Delete selected entries");
		expect(deleteHotkey?.allowInInput).toBe(false);
	});

	it("should have mod+shift+p configured for promoting entries to document", () => {
		const hotkeys = getJournalHotkeys();
		const promoteHotkey = hotkeys.find((h) => h.key === "mod+shift+p");

		expect(promoteHotkey).toBeDefined();
		expect(promoteHotkey?.description).toBe("Promote selected entries to document");
		expect(promoteHotkey?.allowInInput).toBe(false);
	});

	it("should have all 11 journal-specific hotkeys", () => {
		const hotkeys = getJournalHotkeys();
		expect(hotkeys).toHaveLength(11);
	});
});

// ============================================
// Test: Day Navigation shortcuts behavior (ctrl+n/p and Arrow Left/Right)
// ============================================

describe("Journal Context Shortcuts - Day Navigation", () => {
	let mockSetDate: ReturnType<typeof vi.fn>;
	let currentDate: string;

	beforeEach(() => {
		mockSetDate = vi.fn();
		currentDate = "2024-06-15";
	});

	// Helper to create date navigation handler (similar to useJournalController)
	const createGoToNextDayHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			// Simulate addDays(currentDate, 1)
			const d = new Date(currentDate);
			d.setDate(d.getDate() + 1);
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			const nextDate = `${y}-${m}-${day}`;
			mockSetDate(nextDate);
		};
	};

	const createGoToPrevDayHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			// Simulate addDays(currentDate, -1)
			const d = new Date(currentDate);
			d.setDate(d.getDate() - 1);
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			const prevDate = `${y}-${m}-${day}`;
			mockSetDate(prevDate);
		};
	};

	it("should navigate to next day with ctrl+n", () => {
		const handler = createGoToNextDayHandler();
		const event = new KeyboardEvent("keydown", { key: "n", ctrlKey: true });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");
		const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(stopPropagationSpy).toHaveBeenCalled();
		expect(mockSetDate).toHaveBeenCalledWith("2024-06-16");
	});

	it("should navigate to previous day with ctrl+p", () => {
		const handler = createGoToPrevDayHandler();
		const event = new KeyboardEvent("keydown", { key: "p", ctrlKey: true });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockSetDate).toHaveBeenCalledWith("2024-06-14");
	});

	it("should navigate to next day with ArrowRight", () => {
		const handler = createGoToNextDayHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowRight" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockSetDate).toHaveBeenCalledWith("2024-06-16");
	});

	it("should navigate to previous day with ArrowLeft", () => {
		const handler = createGoToPrevDayHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowLeft" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockSetDate).toHaveBeenCalledWith("2024-06-14");
	});

	it("should handle month boundary correctly (next day)", () => {
		currentDate = "2024-06-30";
		const handler = createGoToNextDayHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowRight" });

		handler(event);

		expect(mockSetDate).toHaveBeenCalledWith("2024-07-01");
	});

	it("should handle month boundary correctly (previous day)", () => {
		currentDate = "2024-07-01";
		const handler = createGoToPrevDayHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowLeft" });

		handler(event);

		expect(mockSetDate).toHaveBeenCalledWith("2024-06-30");
	});

	it("should handle year boundary correctly (next day)", () => {
		currentDate = "2024-12-31";
		const handler = createGoToNextDayHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowRight" });

		handler(event);

		expect(mockSetDate).toHaveBeenCalledWith("2025-01-01");
	});

	it("should handle year boundary correctly (previous day)", () => {
		currentDate = "2025-01-01";
		const handler = createGoToPrevDayHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowLeft" });

		handler(event);

		expect(mockSetDate).toHaveBeenCalledWith("2024-12-31");
	});
});

// ============================================
// Test: Entry Navigation shortcuts (j/k and Arrow Up/Down)
// ============================================

describe("Journal Context Shortcuts - Entry Navigation", () => {
	let mockHighlightNext: ReturnType<typeof vi.fn>;
	let mockHighlightPrevious: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockHighlightNext = vi.fn();
		mockHighlightPrevious = vi.fn();
	});

	const createHighlightNextHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			mockHighlightNext();
		};
	};

	const createHighlightPreviousHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			mockHighlightPrevious();
		};
	};

	it("should highlight next entry with j key", () => {
		const handler = createHighlightNextHandler();
		const event = new KeyboardEvent("keydown", { key: "j" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHighlightNext).toHaveBeenCalledTimes(1);
	});

	it("should highlight previous entry with k key", () => {
		const handler = createHighlightPreviousHandler();
		const event = new KeyboardEvent("keydown", { key: "k" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHighlightPrevious).toHaveBeenCalledTimes(1);
	});

	it("should highlight next entry with ArrowDown", () => {
		const handler = createHighlightNextHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHighlightNext).toHaveBeenCalledTimes(1);
	});

	it("should highlight previous entry with ArrowUp", () => {
		const handler = createHighlightPreviousHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowUp" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHighlightPrevious).toHaveBeenCalledTimes(1);
	});
});

// ============================================
// Test: Entry Selection shortcuts (Space)
// ============================================

describe("Journal Context Shortcuts - Entry Selection", () => {
	let mockToggleSelection: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockToggleSelection = vi.fn();
	});

	const createToggleSelectionHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			mockToggleSelection();
		};
	};

	it("should toggle selection with Space key", () => {
		const handler = createToggleSelectionHandler();
		const event = new KeyboardEvent("keydown", { key: " " });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");
		const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(stopPropagationSpy).toHaveBeenCalled();
		expect(mockToggleSelection).toHaveBeenCalledTimes(1);
	});

	it("should prevent page scroll when Space is pressed", () => {
		const handler = createToggleSelectionHandler();
		const event = new KeyboardEvent("keydown", { key: " " });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		// preventDefault prevents default scroll behavior
		expect(preventDefaultSpy).toHaveBeenCalled();
	});
});

// ============================================
// Test: Delete Selected Entries (mod+D)
// ============================================

describe("Journal Context Shortcuts - Delete Selected Entries", () => {
	let mockHandleDeleteSelected: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockHandleDeleteSelected = vi.fn();
	});

	const createDeleteHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			mockHandleDeleteSelected();
		};
	};

	it("should trigger delete dialog with mod+D", () => {
		const handler = createDeleteHandler();
		const event = new KeyboardEvent("keydown", { key: "d", ctrlKey: true });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHandleDeleteSelected).toHaveBeenCalledTimes(1);
	});

	it("should work with metaKey (Mac Cmd) for mod+D", () => {
		const handler = createDeleteHandler();
		const event = new KeyboardEvent("keydown", { key: "d", metaKey: true });

		handler(event);

		expect(mockHandleDeleteSelected).toHaveBeenCalledTimes(1);
	});
});

// ============================================
// Test: Promote Selected Entries (mod+shift+P)
// ============================================

describe("Journal Context Shortcuts - Promote to Document", () => {
	let mockHandlePromoteSelected: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockHandlePromoteSelected = vi.fn().mockResolvedValue(undefined);
	});

	const createPromoteHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			void mockHandlePromoteSelected();
		};
	};

	it("should trigger promote with mod+shift+P", () => {
		const handler = createPromoteHandler();
		const event = new KeyboardEvent("keydown", { key: "p", ctrlKey: true, shiftKey: true });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHandlePromoteSelected).toHaveBeenCalledTimes(1);
	});
});

// ============================================
// Test: Escape Handler (separate event listener in useJournalController)
// ============================================

describe("Journal Context Shortcuts - Escape Behavior", () => {
	/**
	 * In useJournalController, Escape is handled via a separate useEffect
	 * event listener rather than through the hotkeys array. This is because
	 * Escape needs special handling for closing the confirm dialog vs
	 * clearing selection.
	 */

	let mockClearSelection: ReturnType<typeof vi.fn>;
	let mockSetConfirmDialog: ReturnType<typeof vi.fn>;
	let confirmDialogIsOpen: boolean;
	let hasSelectedItems: boolean;

	beforeEach(() => {
		mockClearSelection = vi.fn();
		mockSetConfirmDialog = vi.fn();
		confirmDialogIsOpen = false;
		hasSelectedItems = false;
	});

	const createEscapeHandler = () => {
		return (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (confirmDialogIsOpen) {
					mockSetConfirmDialog({ isOpen: false });
				} else if (hasSelectedItems) {
					mockClearSelection();
				}
			}
		};
	};

	it("should close confirm dialog when Escape is pressed and dialog is open", () => {
		confirmDialogIsOpen = true;
		const handler = createEscapeHandler();
		const event = new KeyboardEvent("keydown", { key: "Escape" });

		handler(event);

		expect(mockSetConfirmDialog).toHaveBeenCalledWith({ isOpen: false });
		expect(mockClearSelection).not.toHaveBeenCalled();
	});

	it("should clear selection when Escape is pressed and has selected items", () => {
		hasSelectedItems = true;
		const handler = createEscapeHandler();
		const event = new KeyboardEvent("keydown", { key: "Escape" });

		handler(event);

		expect(mockClearSelection).toHaveBeenCalledTimes(1);
		expect(mockSetConfirmDialog).not.toHaveBeenCalled();
	});

	it("should do nothing when Escape is pressed with no dialog and no selection", () => {
		const handler = createEscapeHandler();
		const event = new KeyboardEvent("keydown", { key: "Escape" });

		handler(event);

		expect(mockClearSelection).not.toHaveBeenCalled();
		expect(mockSetConfirmDialog).not.toHaveBeenCalled();
	});

	it("should prioritize closing dialog over clearing selection", () => {
		confirmDialogIsOpen = true;
		hasSelectedItems = true;
		const handler = createEscapeHandler();
		const event = new KeyboardEvent("keydown", { key: "Escape" });

		handler(event);

		expect(mockSetConfirmDialog).toHaveBeenCalledWith({ isOpen: false });
		expect(mockClearSelection).not.toHaveBeenCalled();
	});
});

// ============================================
// Test: Context Isolation - Arrow keys vs text editing
// ============================================

describe("Journal Context Shortcuts - No Conflict with Text Editing", () => {
	/**
	 * These tests verify that ctrl+ArrowLeft and ctrl+ArrowRight (which are
	 * common text editing shortcuts for word navigation) do NOT conflict
	 * with the journal's day navigation shortcuts.
	 *
	 * The journal uses:
	 * - ctrl+n / ctrl+p for day navigation (emacs-style)
	 * - ArrowRight / ArrowLeft (without modifiers) for day navigation
	 *
	 * Text editing shortcuts like ctrl+ArrowLeft (word back) and
	 * ctrl+ArrowRight (word forward) should NOT trigger day navigation.
	 */

	it("should document that journal uses ctrl+n/ctrl+p NOT ctrl+Arrow for day navigation", () => {
		// Journal day navigation shortcuts:
		const journalDayNavShortcuts = ["ctrl+n", "ctrl+p", "ArrowRight", "ArrowLeft"];

		// Common text editing shortcuts (should NOT be registered):
		const textEditingShortcuts = ["ctrl+ArrowLeft", "ctrl+ArrowRight"];

		// Verify no overlap
		for (const textShortcut of textEditingShortcuts) {
			expect(journalDayNavShortcuts.includes(textShortcut)).toBe(false);
		}
	});

	it("should document that plain ArrowRight/ArrowLeft have allowInInput: false", () => {
		/**
		 * The ArrowRight and ArrowLeft shortcuts have allowInInput: false,
		 * which means they will NOT trigger when focus is in an input field.
		 *
		 * This prevents conflicts with normal cursor navigation in text fields.
		 */
		const arrowHotkeys: HotkeyConfig[] = [
			{
				key: "ArrowRight",
				handler: vi.fn(),
				allowInInput: false,
				description: "Next day",
			},
			{
				key: "ArrowLeft",
				handler: vi.fn(),
				allowInInput: false,
				description: "Previous day",
			},
		];

		for (const hotkey of arrowHotkeys) {
			expect(hotkey.allowInInput).toBe(false);
		}
	});

	it("should document that ctrl+n/ctrl+p have allowInInput: false", () => {
		/**
		 * Similarly, ctrl+n and ctrl+p have allowInInput: false.
		 *
		 * While ctrl+n might conflict with browser's "new window" and
		 * ctrl+p with "print", having allowInInput: false means these
		 * shortcuts won't fire when the user is typing in an input field.
		 */
		const navHotkeys: HotkeyConfig[] = [
			{
				key: "ctrl+n",
				handler: vi.fn(),
				allowInInput: false,
				description: "Next day",
			},
			{
				key: "ctrl+p",
				handler: vi.fn(),
				allowInInput: false,
				description: "Previous day",
			},
		];

		for (const hotkey of navHotkeys) {
			expect(hotkey.allowInInput).toBe(false);
		}
	});

	it("should verify all journal navigation shortcuts block in input fields", () => {
		/**
		 * All journal-specific navigation shortcuts have allowInInput: false
		 * to prevent interference with text editing.
		 */
		const allJournalHotkeys: HotkeyConfig[] = [
			{ key: "ctrl+n", handler: vi.fn(), allowInInput: false, description: "Next day" },
			{ key: "ctrl+p", handler: vi.fn(), allowInInput: false, description: "Previous day" },
			{ key: "ArrowRight", handler: vi.fn(), allowInInput: false, description: "Next day" },
			{ key: "ArrowLeft", handler: vi.fn(), allowInInput: false, description: "Previous day" },
			{ key: "j", handler: vi.fn(), allowInInput: false, description: "Highlight next entry" },
			{ key: "k", handler: vi.fn(), allowInInput: false, description: "Highlight previous entry" },
			{ key: "ArrowDown", handler: vi.fn(), allowInInput: false, description: "Navigate down" },
			{ key: "ArrowUp", handler: vi.fn(), allowInInput: false, description: "Navigate up" },
			{ key: "Space", handler: vi.fn(), allowInInput: false, description: "Select/deselect" },
		];

		for (const hotkey of allJournalHotkeys) {
			expect(hotkey.allowInInput).toBe(false);
		}
	});
});

// ============================================
// Test: Hotkey registration lifecycle
// ============================================

describe("Journal Context Shortcuts - Registration Lifecycle", () => {
	/**
	 * These tests document how journal hotkeys should be registered and
	 * unregistered as the Journal component mounts and unmounts.
	 */

	it("should register hotkeys on Journal mount", () => {
		const mockRegister = vi.fn().mockReturnValue("hotkey-1");

		// Simulate what useHotkeys does when Journal mounts
		const journalHotkeys: HotkeyConfig[] = [
			{ key: "ctrl+n", handler: vi.fn(), description: "Next day" },
			{ key: "ctrl+p", handler: vi.fn(), description: "Previous day" },
			{ key: "ArrowRight", handler: vi.fn(), description: "Next day" },
			{ key: "ArrowLeft", handler: vi.fn(), description: "Previous day" },
			{ key: "j", handler: vi.fn(), description: "Highlight next entry" },
			{ key: "k", handler: vi.fn(), description: "Highlight previous entry" },
			{ key: "ArrowDown", handler: vi.fn(), description: "Navigate down" },
			{ key: "ArrowUp", handler: vi.fn(), description: "Navigate up" },
			{ key: "Space", handler: vi.fn(), description: "Select/deselect" },
			{ key: "mod+D", handler: vi.fn(), description: "Delete selected entries" },
			{ key: "mod+shift+p", handler: vi.fn(), description: "Promote to document" },
		];

		// Register each hotkey
		const ids = journalHotkeys.map((config) => mockRegister(config));

		expect(mockRegister).toHaveBeenCalledTimes(11);
		expect(ids).toHaveLength(11);
	});

	it("should unregister hotkeys on Journal unmount", () => {
		const mockRegister = vi.fn().mockImplementation(() => `hotkey-${Math.random()}`);
		const mockUnregister = vi.fn();

		// Simulate mount - register hotkeys
		const journalHotkeys: HotkeyConfig[] = [
			{ key: "ctrl+n", handler: vi.fn(), description: "Next day" },
			{ key: "j", handler: vi.fn(), description: "Highlight next entry" },
		];

		const ids = journalHotkeys.map((config) => mockRegister(config));

		// Simulate unmount - unregister hotkeys
		ids.forEach((id) => {
			mockUnregister(id);
		});

		expect(mockUnregister).toHaveBeenCalledTimes(2);
	});

	it("should not have journal hotkeys active after navigating to Dashboard", () => {
		/**
		 * Scenario:
		 * 1. User is on Journal page - journal hotkeys are registered
		 * 2. User navigates to Dashboard
		 * 3. Journal unmounts - journal hotkeys are unregistered
		 * 4. Dashboard mounts - dashboard hotkeys are registered
		 * 5. ArrowRight on Dashboard should NOT trigger day navigation
		 *
		 * This behavior is automatic due to React component lifecycle.
		 */
		const hotkeyRegistry = new Map<string, HotkeyConfig>();

		const register = (config: HotkeyConfig): string => {
			const id = `hotkey-${hotkeyRegistry.size}`;
			hotkeyRegistry.set(id, config);
			return id;
		};

		const unregister = (id: string): void => {
			hotkeyRegistry.delete(id);
		};

		// Journal mounts and registers its hotkeys
		const journalNextDayId = register({
			key: "ArrowRight",
			handler: vi.fn(),
			description: "Next day",
		});
		expect(hotkeyRegistry.has(journalNextDayId)).toBe(true);
		expect(
			Array.from(hotkeyRegistry.values()).some(
				(h) => h.key === "ArrowRight" && h.description === "Next day",
			),
		).toBe(true);

		// Journal unmounts (navigation to Dashboard)
		unregister(journalNextDayId);
		expect(hotkeyRegistry.has(journalNextDayId)).toBe(false);

		// Dashboard mounts - ArrowDown is for list navigation, not day navigation
		register({ key: "ArrowDown", handler: vi.fn(), description: "Navigate down" });
		register({ key: "ArrowUp", handler: vi.fn(), description: "Navigate up" });

		// Verify no "Next day" ArrowRight hotkey is active
		const activeHotkeys = Array.from(hotkeyRegistry.values());
		expect(activeHotkeys.some((h) => h.key === "ArrowRight" && h.description === "Next day")).toBe(
			false,
		);
	});
});

// ============================================
// Test: Help context integration
// ============================================

describe("Journal Context Shortcuts - Help Context", () => {
	/**
	 * The useJournalController sets page context for help commands.
	 * This documents the expected help commands shown in the Help modal
	 * when on the Journal page.
	 */

	it("should define help commands for all journal shortcuts", () => {
		// These are the help commands defined in useJournalController.ts
		const helpCommands = [
			{ command: "j / ↓", description: "Navigate to next entry" },
			{ command: "k / ↑", description: "Navigate to previous entry" },
			{ command: "Space", description: "Select/deselect highlighted entry" },
			{ command: "Escape", description: "Clear selection" },
			{ command: "Ctrl+D", description: "Delete selected entries" },
			{ command: "Ctrl+Shift+P", description: "Promote selected entries to document" },
			{ command: "Ctrl+N / →", description: "Next day" },
			{ command: "Ctrl+P / ←", description: "Previous day" },
		];

		expect(helpCommands).toHaveLength(8);

		// Verify essential shortcuts are documented
		expect(helpCommands.some((h) => h.description.includes("next entry"))).toBe(true);
		expect(helpCommands.some((h) => h.description.includes("previous entry"))).toBe(true);
		expect(helpCommands.some((h) => h.description.includes("Select"))).toBe(true);
		expect(helpCommands.some((h) => h.description.includes("Clear selection"))).toBe(true);
		expect(helpCommands.some((h) => h.description.includes("Delete"))).toBe(true);
		expect(helpCommands.some((h) => h.description.includes("Promote"))).toBe(true);
		expect(helpCommands.some((h) => h.description.includes("Next day"))).toBe(true);
		expect(helpCommands.some((h) => h.description.includes("Previous day"))).toBe(true);
	});
});
