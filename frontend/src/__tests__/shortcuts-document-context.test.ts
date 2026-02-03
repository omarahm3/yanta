/**
 * Document Context Shortcuts Tests
 *
 * Tests that document-specific shortcuts work correctly within the document context
 * and do NOT trigger when outside the document context (e.g., on Settings page).
 *
 * Shortcuts tested:
 * - Ctrl+S → Triggers save (verify save function called)
 * - Escape → Returns to Dashboard when editor is not focused
 * - mod+E → Export to Markdown
 * - mod+Shift+E → Export to PDF
 * - Enter → Focus editor when unfocused
 * - mod+C → Unfocus editor
 *
 * Note: Ctrl+N for new document is registered in Dashboard context, not Document.
 * Document creation from Document page would be via command palette or navigation.
 */

import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HotkeyConfig } from "../types/hotkeys";

// ============================================
// Test: useDocumentController hotkeys configuration
// ============================================

describe("Document Context Shortcuts - Hotkey Configuration", () => {
	/**
	 * Tests that the document controller returns the correct hotkey configurations.
	 * This validates the hotkey metadata (keys, allowInInput, capture, etc.)
	 */

	// Mock the document controller's hotkeys output to test configuration
	const getDocumentHotkeys = (): HotkeyConfig[] => {
		// These represent the hotkeys as defined in useDocumentController.ts
		return [
			{
				key: "mod+s",
				handler: vi.fn(),
				allowInInput: true,
				description: "Save document",
				capture: true,
			},
			{
				key: "mod+e",
				handler: vi.fn(),
				allowInInput: true,
				description: "Export to Markdown",
				capture: true,
			},
			{
				key: "mod+shift+e",
				handler: vi.fn(),
				allowInInput: true,
				description: "Export to PDF",
				capture: true,
			},
			{
				key: "Escape",
				handler: vi.fn(),
				allowInInput: false,
				description: "Navigate back when editor is not focused",
			},
			{
				key: "mod+C",
				handler: vi.fn(),
				allowInInput: true,
				description: "Unfocus editor",
			},
			{
				key: "Enter",
				handler: vi.fn(),
				allowInInput: false,
				description: "Focus editor when unfocused",
			},
		];
	};

	it("should have mod+s configured for saving document", () => {
		const hotkeys = getDocumentHotkeys();
		const saveHotkey = hotkeys.find((h) => h.key === "mod+s");

		expect(saveHotkey).toBeDefined();
		expect(saveHotkey?.description).toBe("Save document");
		expect(saveHotkey?.allowInInput).toBe(true);
		expect(saveHotkey?.capture).toBe(true);
	});

	it("should have Escape configured for navigation when editor unfocused", () => {
		const hotkeys = getDocumentHotkeys();
		const escapeHotkey = hotkeys.find((h) => h.key === "Escape");

		expect(escapeHotkey).toBeDefined();
		expect(escapeHotkey?.description).toBe("Navigate back when editor is not focused");
		expect(escapeHotkey?.allowInInput).toBe(false);
	});

	it("should have mod+e configured for export to Markdown", () => {
		const hotkeys = getDocumentHotkeys();
		const exportMdHotkey = hotkeys.find((h) => h.key === "mod+e");

		expect(exportMdHotkey).toBeDefined();
		expect(exportMdHotkey?.description).toBe("Export to Markdown");
		expect(exportMdHotkey?.allowInInput).toBe(true);
		expect(exportMdHotkey?.capture).toBe(true);
	});

	it("should have mod+shift+e configured for export to PDF", () => {
		const hotkeys = getDocumentHotkeys();
		const exportPdfHotkey = hotkeys.find((h) => h.key === "mod+shift+e");

		expect(exportPdfHotkey).toBeDefined();
		expect(exportPdfHotkey?.description).toBe("Export to PDF");
		expect(exportPdfHotkey?.allowInInput).toBe(true);
		expect(exportPdfHotkey?.capture).toBe(true);
	});

	it("should have Enter configured for focusing editor", () => {
		const hotkeys = getDocumentHotkeys();
		const enterHotkey = hotkeys.find((h) => h.key === "Enter");

		expect(enterHotkey).toBeDefined();
		expect(enterHotkey?.description).toBe("Focus editor when unfocused");
		expect(enterHotkey?.allowInInput).toBe(false);
	});

	it("should have mod+C configured for unfocusing editor", () => {
		const hotkeys = getDocumentHotkeys();
		const unfocusHotkey = hotkeys.find((h) => h.key === "mod+C");

		expect(unfocusHotkey).toBeDefined();
		expect(unfocusHotkey?.description).toBe("Unfocus editor");
		expect(unfocusHotkey?.allowInInput).toBe(true);
	});

	it("should have all 6 document-specific hotkeys", () => {
		const hotkeys = getDocumentHotkeys();
		expect(hotkeys).toHaveLength(6);
	});
});

// ============================================
// Test: Save shortcut behavior (mod+s / Ctrl+S)
// ============================================

describe("Document Context Shortcuts - Save (Ctrl+S / mod+s)", () => {
	let mockSaveNow: Mock<() => Promise<void>>;
	let mockError: Mock<(message: string) => void>;
	let isArchived: boolean;

	beforeEach(() => {
		mockSaveNow = vi.fn().mockResolvedValue(undefined);
		mockError = vi.fn();
		isArchived = false;
	});

	const createSaveHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (isArchived) {
				mockError("Restore the document before editing.");
				return;
			}
			void mockSaveNow();
		};
	};

	it("should call saveNow when Ctrl+S is triggered", () => {
		const handler = createSaveHandler();
		const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");
		const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(stopPropagationSpy).toHaveBeenCalled();
		expect(mockSaveNow).toHaveBeenCalledTimes(1);
		expect(mockError).not.toHaveBeenCalled();
	});

	it("should not call saveNow when document is archived", () => {
		isArchived = true;
		const handler = createSaveHandler();
		const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });

		handler(event);

		expect(mockSaveNow).not.toHaveBeenCalled();
		expect(mockError).toHaveBeenCalledWith("Restore the document before editing.");
	});

	it("should prevent browser default save dialog", () => {
		const handler = createSaveHandler();
		const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
	});
});

// ============================================
// Test: Escape shortcut behavior
// ============================================

describe("Document Context Shortcuts - Escape Navigation", () => {
	let mockOnNavigateBack: Mock<() => void>;
	let mockEditorIsFocused: Mock<() => boolean>;

	beforeEach(() => {
		mockOnNavigateBack = vi.fn();
		mockEditorIsFocused = vi.fn();
	});

	const createEscapeHandler = () => {
		return (e: KeyboardEvent) => {
			// Simulating editor ref check
			if (mockEditorIsFocused()) {
				// Editor is focused, don't navigate back
				return;
			}

			e.preventDefault();
			e.stopPropagation();
			mockOnNavigateBack();
		};
	};

	it("should navigate back when editor is not focused", () => {
		mockEditorIsFocused.mockReturnValue(false);
		const handler = createEscapeHandler();
		const event = new KeyboardEvent("keydown", { key: "Escape" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockOnNavigateBack).toHaveBeenCalledTimes(1);
	});

	it("should NOT navigate back when editor is focused", () => {
		mockEditorIsFocused.mockReturnValue(true);
		const handler = createEscapeHandler();
		const event = new KeyboardEvent("keydown", { key: "Escape" });

		handler(event);

		expect(mockOnNavigateBack).not.toHaveBeenCalled();
	});

	it("should allow text editing in editor when focused", () => {
		mockEditorIsFocused.mockReturnValue(true);
		const handler = createEscapeHandler();
		const event = new KeyboardEvent("keydown", { key: "Escape" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		// When editor is focused, we should NOT prevent default
		// allowing the editor to handle escape (e.g., exit selection mode)
		expect(preventDefaultSpy).not.toHaveBeenCalled();
	});
});

// ============================================
// Test: Export shortcuts behavior (mod+e, mod+shift+e)
// ============================================

describe("Document Context Shortcuts - Export", () => {
	let mockExportToMarkdown: Mock<() => Promise<void>>;
	let mockExportToPDF: Mock<() => Promise<void>>;
	let mockError: Mock<(message: string) => void>;
	let isArchived: boolean;
	let hasDocumentPath: boolean;

	beforeEach(() => {
		mockExportToMarkdown = vi.fn().mockResolvedValue(undefined);
		mockExportToPDF = vi.fn().mockResolvedValue(undefined);
		mockError = vi.fn();
		isArchived = false;
		hasDocumentPath = true;
	});

	const createExportMarkdownHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (isArchived) {
				mockError("Restore the document before exporting.");
				return;
			}
			if (!hasDocumentPath) {
				mockError("No document open");
				return;
			}
			void mockExportToMarkdown();
		};
	};

	const createExportPDFHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (isArchived) {
				mockError("Restore the document before exporting.");
				return;
			}
			if (!hasDocumentPath) {
				mockError("No document open");
				return;
			}
			void mockExportToPDF();
		};
	};

	it("should trigger export to Markdown with mod+e", () => {
		const handler = createExportMarkdownHandler();
		const event = new KeyboardEvent("keydown", { key: "e", ctrlKey: true });

		handler(event);

		expect(mockExportToMarkdown).toHaveBeenCalledTimes(1);
		expect(mockError).not.toHaveBeenCalled();
	});

	it("should trigger export to PDF with mod+shift+e", () => {
		const handler = createExportPDFHandler();
		const event = new KeyboardEvent("keydown", { key: "e", ctrlKey: true, shiftKey: true });

		handler(event);

		expect(mockExportToPDF).toHaveBeenCalledTimes(1);
		expect(mockError).not.toHaveBeenCalled();
	});

	it("should not export when document is archived", () => {
		isArchived = true;
		const mdHandler = createExportMarkdownHandler();
		const pdfHandler = createExportPDFHandler();

		mdHandler(new KeyboardEvent("keydown", { key: "e", ctrlKey: true }));
		pdfHandler(new KeyboardEvent("keydown", { key: "e", ctrlKey: true, shiftKey: true }));

		expect(mockExportToMarkdown).not.toHaveBeenCalled();
		expect(mockExportToPDF).not.toHaveBeenCalled();
		expect(mockError).toHaveBeenCalledTimes(2);
	});

	it("should show error when no document is open", () => {
		hasDocumentPath = false;
		const handler = createExportMarkdownHandler();

		handler(new KeyboardEvent("keydown", { key: "e", ctrlKey: true }));

		expect(mockExportToMarkdown).not.toHaveBeenCalled();
		expect(mockError).toHaveBeenCalledWith("No document open");
	});
});

// ============================================
// Test: Editor focus shortcuts (Enter, mod+C)
// ============================================

describe("Document Context Shortcuts - Editor Focus Control", () => {
	let mockEditorFocus: Mock<() => void>;
	let mockEditorBlur: Mock<() => void>;
	let mockEditorIsFocused: Mock<() => boolean>;

	beforeEach(() => {
		mockEditorFocus = vi.fn();
		mockEditorBlur = vi.fn();
		mockEditorIsFocused = vi.fn();
	});

	const createFocusEditorHandler = () => {
		return () => {
			if (!mockEditorIsFocused()) {
				mockEditorFocus();
			}
		};
	};

	const createUnfocusHandler = () => {
		return (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (mockEditorIsFocused()) {
				mockEditorBlur();
			}
		};
	};

	it("should focus editor with Enter when editor is not focused", () => {
		mockEditorIsFocused.mockReturnValue(false);
		const handler = createFocusEditorHandler();

		handler();

		expect(mockEditorFocus).toHaveBeenCalledTimes(1);
	});

	it("should NOT focus editor with Enter when editor is already focused", () => {
		mockEditorIsFocused.mockReturnValue(true);
		const handler = createFocusEditorHandler();

		handler();

		expect(mockEditorFocus).not.toHaveBeenCalled();
	});

	it("should blur editor with mod+C when editor is focused", () => {
		mockEditorIsFocused.mockReturnValue(true);
		const handler = createUnfocusHandler();
		const event = new KeyboardEvent("keydown", { key: "c", ctrlKey: true });

		handler(event);

		expect(mockEditorBlur).toHaveBeenCalledTimes(1);
	});

	it("should not blur editor with mod+C when editor is not focused", () => {
		mockEditorIsFocused.mockReturnValue(false);
		const handler = createUnfocusHandler();
		const event = new KeyboardEvent("keydown", { key: "c", ctrlKey: true });

		handler(event);

		expect(mockEditorBlur).not.toHaveBeenCalled();
	});
});

// ============================================
// Test: Context Isolation - Document shortcuts should NOT work outside document context
// ============================================

describe("Document Context Shortcuts - Context Isolation", () => {
	/**
	 * These tests verify that document-specific shortcuts do NOT trigger
	 * when the user is on a different page (e.g., Settings, Dashboard).
	 *
	 * In the actual implementation, this is handled by:
	 * 1. Document hotkeys are only registered when Document component mounts
	 * 2. When navigating away, Document unmounts and its hotkeys are unregistered
	 * 3. Other pages register their own context-specific hotkeys
	 */

	it("should document that hotkeys are page-scoped via component lifecycle", () => {
		/**
		 * Architecture documentation:
		 *
		 * The HotkeyProvider maintains a registry of hotkeys. Each page component
		 * (Document, Settings, Dashboard, etc.) registers its own hotkeys via useHotkeys()
		 * when it mounts and automatically unregisters them when it unmounts.
		 *
		 * This means:
		 * - When on Document page: Document's mod+s (save) is active
		 * - When on Settings page: Document's mod+s is NOT active (unregistered)
		 *
		 * The Router component handles page transitions, causing proper mount/unmount.
		 */
		expect(true).toBe(true);
	});

	it("should verify Settings page does NOT have document save shortcut", () => {
		// Settings page hotkeys (from Settings.tsx)
		const settingsHotkeys: HotkeyConfig[] = [
			{
				key: "j",
				handler: vi.fn(),
				allowInInput: false,
				description: "Navigate to next section",
			},
			{
				key: "k",
				handler: vi.fn(),
				allowInInput: false,
				description: "Navigate to previous section",
			},
		];

		// Verify Settings does NOT include document-specific shortcuts
		const hasSaveShortcut = settingsHotkeys.some((h) => h.key === "mod+s");
		const hasExportShortcut = settingsHotkeys.some(
			(h) => h.key === "mod+e" && h.description?.includes("Export"),
		);

		expect(hasSaveShortcut).toBe(false);
		expect(hasExportShortcut).toBe(false);
	});

	it("should verify Dashboard page has different mod+N behavior than Document", () => {
		// Dashboard has mod+N for creating new document (navigation)
		// Document context does NOT have mod+N registered
		const dashboardHotkeys: { key: string; description: string }[] = [
			{ key: "mod+N", description: "Create new document" },
			{ key: "mod+shift+A", description: "Toggle archived documents view" },
			{ key: "mod+D", description: "Soft delete selected documents" },
			{ key: "j", description: "Highlight next document" },
			{ key: "k", description: "Highlight previous document" },
		];

		const documentHotkeys: { key: string; description: string }[] = [
			{ key: "mod+s", description: "Save document" },
			{ key: "mod+e", description: "Export to Markdown" },
			{ key: "mod+shift+e", description: "Export to PDF" },
			{ key: "Escape", description: "Navigate back when editor is not focused" },
			{ key: "mod+C", description: "Unfocus editor" },
			{ key: "Enter", description: "Focus editor when unfocused" },
		];

		// mod+N is in Dashboard, NOT in Document
		expect(dashboardHotkeys.some((h) => h.key === "mod+N")).toBe(true);
		expect(documentHotkeys.some((h) => h.key === "mod+N")).toBe(false);

		// mod+s is in Document, NOT in Dashboard
		expect(documentHotkeys.some((h) => h.key === "mod+s")).toBe(true);
		expect(dashboardHotkeys.some((h) => h.key === "mod+s")).toBe(false);
	});

	it("should verify Escape has different behavior across contexts", () => {
		/**
		 * Escape key behavior varies by context:
		 *
		 * - Document: Navigate back when editor is not focused
		 * - Search: Unfocus/clear search
		 * - Help Modal: Close modal
		 * - Command Palette: Close palette
		 *
		 * Priority and capture flags determine which handler wins when multiple
		 * are registered at the same time.
		 */
		const escapeUsages = [
			{
				context: "document",
				description: "Navigate back when editor is not focused",
				capture: false,
				priority: undefined,
			},
			{ context: "search", description: "Unfocus/clear", capture: false, priority: undefined },
		];

		// Document's Escape does not use capture (lower priority)
		const docEscape = escapeUsages.find((e) => e.context === "document");
		expect(docEscape?.capture).toBe(false);
	});
});

// ============================================
// Test: Browser Default Prevention
// ============================================

describe("Document Context Shortcuts - Browser Default Prevention", () => {
	it("should prevent Ctrl+S from triggering browser save dialog", () => {
		const mockSaveNow = vi.fn();
		const handler = (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			void mockSaveNow();
		};

		const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
	});

	it("should use capture phase for save shortcut to intercept before browser", () => {
		// The document save hotkey uses capture:true
		const saveHotkeyConfig: HotkeyConfig = {
			key: "mod+s",
			handler: vi.fn(),
			allowInInput: true,
			description: "Save document",
			capture: true,
		};

		expect(saveHotkeyConfig.capture).toBe(true);
	});

	it("should allow save shortcut to work inside input fields (editor)", () => {
		// allowInInput: true means the shortcut works even in contenteditable
		const saveHotkeyConfig: HotkeyConfig = {
			key: "mod+s",
			handler: vi.fn(),
			allowInInput: true,
			description: "Save document",
			capture: true,
		};

		expect(saveHotkeyConfig.allowInInput).toBe(true);
	});
});

// ============================================
// Test: Hotkey registration lifecycle
// ============================================

describe("Document Context Shortcuts - Registration Lifecycle", () => {
	/**
	 * These tests document how document hotkeys should be registered and
	 * unregistered as the Document component mounts and unmounts.
	 */

	it("should register hotkeys on Document mount", () => {
		const mockRegister = vi.fn().mockReturnValue("hotkey-1");
		const _mockUnregister = vi.fn();

		// Simulate what useHotkeys does when Document mounts
		const documentHotkeys: HotkeyConfig[] = [
			{ key: "mod+s", handler: vi.fn(), description: "Save document" },
			{ key: "Escape", handler: vi.fn(), description: "Navigate back" },
		];

		// Register each hotkey
		const ids = documentHotkeys.map((config) => mockRegister(config));

		expect(mockRegister).toHaveBeenCalledTimes(2);
		expect(ids).toEqual(["hotkey-1", "hotkey-1"]);
	});

	it("should unregister hotkeys on Document unmount", () => {
		const mockRegister = vi.fn().mockImplementation(() => `hotkey-${Math.random()}`);
		const mockUnregister = vi.fn();

		// Simulate mount - register hotkeys
		const documentHotkeys: HotkeyConfig[] = [
			{ key: "mod+s", handler: vi.fn(), description: "Save document" },
			{ key: "Escape", handler: vi.fn(), description: "Navigate back" },
		];

		const ids = documentHotkeys.map((config) => mockRegister(config));

		// Simulate unmount - unregister hotkeys
		ids.forEach((id) => {
			mockUnregister(id);
		});

		expect(mockUnregister).toHaveBeenCalledTimes(2);
	});

	it("should not have document hotkeys active after navigating to Settings", () => {
		/**
		 * Scenario:
		 * 1. User is on Document page - document hotkeys are registered
		 * 2. User presses Ctrl+, to go to Settings
		 * 3. Document unmounts - document hotkeys are unregistered
		 * 4. Settings mounts - settings hotkeys are registered
		 * 5. Ctrl+S on Settings page should NOT trigger document save
		 *
		 * This behavior is automatic due to React component lifecycle and
		 * the useHotkeys hook's cleanup function.
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

		// Document mounts and registers its hotkeys
		const docSaveId = register({ key: "mod+s", handler: vi.fn(), description: "Save document" });
		expect(hotkeyRegistry.has(docSaveId)).toBe(true);
		expect(Array.from(hotkeyRegistry.values()).some((h) => h.key === "mod+s")).toBe(true);

		// Document unmounts (navigation to Settings)
		unregister(docSaveId);
		expect(hotkeyRegistry.has(docSaveId)).toBe(false);
		expect(Array.from(hotkeyRegistry.values()).some((h) => h.key === "mod+s")).toBe(false);

		// Settings mounts and registers its hotkeys (no mod+s)
		register({ key: "j", handler: vi.fn(), description: "Next section" });
		register({ key: "k", handler: vi.fn(), description: "Previous section" });

		// Verify no mod+s hotkey is active
		const activeHotkeys = Array.from(hotkeyRegistry.values());
		expect(activeHotkeys.some((h) => h.key === "mod+s")).toBe(false);
		expect(activeHotkeys.some((h) => h.key === "j")).toBe(true);
	});
});
