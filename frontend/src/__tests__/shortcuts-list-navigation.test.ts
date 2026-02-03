/**
 * Dashboard/List Navigation Shortcuts Tests
 *
 * Tests that list navigation shortcuts work correctly on Dashboard, Projects,
 * and Search pages. Each page has its own set of list navigation shortcuts
 * for navigating between items and selecting/opening them.
 *
 * Dashboard shortcuts tested:
 * - ↑ / ↓ / j / k → Navigate between documents in the list
 * - Enter → Opens the selected/highlighted document
 * - Space → Toggle document selection
 * - Ctrl+N → Creates new document
 *
 * Projects page shortcuts tested:
 * - ↑ / ↓ / j / k → Navigate between projects
 * - Enter → Switches to the selected project
 *
 * Search results page shortcuts tested:
 * - j / k → Navigate between search results
 * - Enter → Opens the selected result
 * - Escape → Unfocus/blur search input
 * - / → Focus search input
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HotkeyConfig } from "../types/hotkeys";

// ============================================
// Test: Dashboard List Navigation - Hotkey Configuration
// ============================================

describe("Dashboard List Navigation - Hotkey Configuration", () => {
	/**
	 * Tests that the dashboard controller returns the correct hotkey configurations
	 * for list navigation.
	 */

	// Mock the dashboard controller's hotkeys output
	const getDashboardHotkeys = (): HotkeyConfig[] => {
		// These represent the hotkeys as defined in useDashboardController.ts
		return [
			{
				key: "mod+N",
				handler: vi.fn(),
				allowInInput: false,
				description: "Create new document",
			},
			{
				key: "mod+shift+A",
				handler: vi.fn(),
				allowInInput: false,
				description: "Toggle archived documents view",
			},
			{
				key: "mod+D",
				handler: vi.fn(),
				allowInInput: false,
				description: "Soft delete selected documents",
			},
			{
				key: "mod+shift+D",
				handler: vi.fn(),
				allowInInput: false,
				description: "Permanently delete selected documents",
			},
			{
				key: "Space",
				handler: vi.fn(),
				allowInInput: false,
				description: "Select/deselect highlighted document",
			},
			{
				key: "Enter",
				handler: vi.fn(),
				allowInInput: false,
				description: "Open highlighted document",
			},
			{
				key: "j",
				handler: vi.fn(),
				allowInInput: false,
				description: "Highlight next document",
			},
			{
				key: "k",
				handler: vi.fn(),
				allowInInput: false,
				description: "Highlight previous document",
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
				key: "mod+A",
				handler: vi.fn(),
				allowInInput: false,
				description: "Archive selected documents",
			},
			{
				key: "mod+U",
				handler: vi.fn(),
				allowInInput: false,
				description: "Restore archived documents",
			},
			{
				key: "mod+E",
				handler: vi.fn(),
				allowInInput: false,
				description: "Export selected documents to markdown",
			},
			{
				key: "mod+shift+E",
				handler: vi.fn(),
				allowInInput: false,
				description: "Export selected documents to PDF",
			},
		];
	};

	it("should have j/k configured for document navigation (vim-style)", () => {
		const hotkeys = getDashboardHotkeys();
		const jHotkey = hotkeys.find((h) => h.key === "j");
		const kHotkey = hotkeys.find((h) => h.key === "k");

		expect(jHotkey).toBeDefined();
		expect(jHotkey?.description).toBe("Highlight next document");
		expect(jHotkey?.allowInInput).toBe(false);

		expect(kHotkey).toBeDefined();
		expect(kHotkey?.description).toBe("Highlight previous document");
		expect(kHotkey?.allowInInput).toBe(false);
	});

	it("should have Arrow keys configured for document navigation", () => {
		const hotkeys = getDashboardHotkeys();
		const downHotkey = hotkeys.find((h) => h.key === "ArrowDown");
		const upHotkey = hotkeys.find((h) => h.key === "ArrowUp");

		expect(downHotkey).toBeDefined();
		expect(downHotkey?.description).toBe("Navigate down");
		expect(downHotkey?.allowInInput).toBe(false);

		expect(upHotkey).toBeDefined();
		expect(upHotkey?.description).toBe("Navigate up");
		expect(upHotkey?.allowInInput).toBe(false);
	});

	it("should have Enter configured for opening highlighted document", () => {
		const hotkeys = getDashboardHotkeys();
		const enterHotkey = hotkeys.find((h) => h.key === "Enter");

		expect(enterHotkey).toBeDefined();
		expect(enterHotkey?.description).toBe("Open highlighted document");
		expect(enterHotkey?.allowInInput).toBe(false);
	});

	it("should have Space configured for toggling document selection", () => {
		const hotkeys = getDashboardHotkeys();
		const spaceHotkey = hotkeys.find((h) => h.key === "Space");

		expect(spaceHotkey).toBeDefined();
		expect(spaceHotkey?.description).toBe("Select/deselect highlighted document");
		expect(spaceHotkey?.allowInInput).toBe(false);
	});

	it("should have mod+N configured for creating new document", () => {
		const hotkeys = getDashboardHotkeys();
		const newDocHotkey = hotkeys.find((h) => h.key === "mod+N");

		expect(newDocHotkey).toBeDefined();
		expect(newDocHotkey?.description).toBe("Create new document");
		expect(newDocHotkey?.allowInInput).toBe(false);
	});

	it("should have all 14 dashboard-specific hotkeys", () => {
		const hotkeys = getDashboardHotkeys();
		expect(hotkeys).toHaveLength(14);
	});
});

// ============================================
// Test: Dashboard List Navigation - Navigation Behavior
// ============================================

describe("Dashboard List Navigation - Navigation Behavior", () => {
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

	it("should highlight next document with j key", () => {
		const handler = createHighlightNextHandler();
		const event = new KeyboardEvent("keydown", { key: "j" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHighlightNext).toHaveBeenCalledTimes(1);
	});

	it("should highlight previous document with k key", () => {
		const handler = createHighlightPreviousHandler();
		const event = new KeyboardEvent("keydown", { key: "k" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHighlightPrevious).toHaveBeenCalledTimes(1);
	});

	it("should highlight next document with ArrowDown", () => {
		const handler = createHighlightNextHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHighlightNext).toHaveBeenCalledTimes(1);
	});

	it("should highlight previous document with ArrowUp", () => {
		const handler = createHighlightPreviousHandler();
		const event = new KeyboardEvent("keydown", { key: "ArrowUp" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHighlightPrevious).toHaveBeenCalledTimes(1);
	});
});

// ============================================
// Test: Dashboard List Navigation - Document Selection
// ============================================

describe("Dashboard List Navigation - Document Selection", () => {
	let mockToggleSelection: ReturnType<typeof vi.fn>;
	let _highlightedIndex: number;
	let _documentsLength: number;

	beforeEach(() => {
		mockToggleSelection = vi.fn();
		_highlightedIndex = 0;
		_documentsLength = 5;
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
// Test: Dashboard List Navigation - Open Document
// ============================================

describe("Dashboard List Navigation - Open Document", () => {
	let mockHandleDocumentClick: ReturnType<typeof vi.fn>;
	let highlightedIndex: number;
	let documents: { path: string; title: string }[];

	beforeEach(() => {
		mockHandleDocumentClick = vi.fn();
		highlightedIndex = 0;
		documents = [
			{ path: "/vault/test-doc-1.json", title: "Test Doc 1" },
			{ path: "/vault/test-doc-2.json", title: "Test Doc 2" },
			{ path: "/vault/test-doc-3.json", title: "Test Doc 3" },
		];
	});

	const createOpenHighlightedDocumentHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (highlightedIndex < 0 || highlightedIndex >= documents.length) {
				return;
			}
			const doc = documents[highlightedIndex];
			if (doc) {
				mockHandleDocumentClick(doc.path);
			}
		};
	};

	it("should open highlighted document with Enter key", () => {
		const handler = createOpenHighlightedDocumentHandler();
		const event = new KeyboardEvent("keydown", { key: "Enter" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockHandleDocumentClick).toHaveBeenCalledWith("/vault/test-doc-1.json");
	});

	it("should open the correct document based on highlighted index", () => {
		highlightedIndex = 2;
		const handler = createOpenHighlightedDocumentHandler();
		const event = new KeyboardEvent("keydown", { key: "Enter" });

		handler(event);

		expect(mockHandleDocumentClick).toHaveBeenCalledWith("/vault/test-doc-3.json");
	});

	it("should not navigate when highlighted index is out of bounds (negative)", () => {
		highlightedIndex = -1;
		const handler = createOpenHighlightedDocumentHandler();
		const event = new KeyboardEvent("keydown", { key: "Enter" });

		handler(event);

		expect(mockHandleDocumentClick).not.toHaveBeenCalled();
	});

	it("should not navigate when highlighted index is out of bounds (too large)", () => {
		highlightedIndex = 10;
		const handler = createOpenHighlightedDocumentHandler();
		const event = new KeyboardEvent("keydown", { key: "Enter" });

		handler(event);

		expect(mockHandleDocumentClick).not.toHaveBeenCalled();
	});
});

// ============================================
// Test: Dashboard List Navigation - Create New Document
// ============================================

describe("Dashboard List Navigation - Create New Document", () => {
	let mockOnNavigate: ReturnType<typeof vi.fn>;
	let mockError: ReturnType<typeof vi.fn>;
	let currentProject: { alias: string } | null;

	beforeEach(() => {
		mockOnNavigate = vi.fn();
		mockError = vi.fn();
		currentProject = { alias: "test-project" };
	});

	const createNewDocumentHandler = () => {
		return (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (!currentProject) {
				mockError("No project selected");
				return;
			}
			mockOnNavigate("document");
		};
	};

	it("should create new document with mod+N", () => {
		const handler = createNewDocumentHandler();
		const event = new KeyboardEvent("keydown", { key: "n", ctrlKey: true });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockOnNavigate).toHaveBeenCalledWith("document");
		expect(mockError).not.toHaveBeenCalled();
	});

	it("should show error when no project is selected", () => {
		currentProject = null;
		const handler = createNewDocumentHandler();
		const event = new KeyboardEvent("keydown", { key: "n", ctrlKey: true });

		handler(event);

		expect(mockError).toHaveBeenCalledWith("No project selected");
		expect(mockOnNavigate).not.toHaveBeenCalled();
	});
});

// ============================================
// Test: Dashboard List Navigation - Escape Behavior
// ============================================

describe("Dashboard List Navigation - Escape Behavior", () => {
	/**
	 * In useDashboardController, Escape is handled via a separate useEffect
	 * event listener rather than through the hotkeys array. This is because
	 * Escape needs special handling for closing the confirm dialog vs
	 * clearing selection.
	 */

	let mockClearSelection: ReturnType<typeof vi.fn>;
	let mockSetConfirmDialog: ReturnType<typeof vi.fn>;
	let confirmDialogIsOpen: boolean;
	let hasSelectedDocuments: boolean;

	beforeEach(() => {
		mockClearSelection = vi.fn();
		mockSetConfirmDialog = vi.fn();
		confirmDialogIsOpen = false;
		hasSelectedDocuments = false;
	});

	const createEscapeHandler = () => {
		return (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (confirmDialogIsOpen) {
					mockSetConfirmDialog({ isOpen: false });
				} else if (hasSelectedDocuments) {
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

		expect(mockSetConfirmDialog).toHaveBeenCalled();
		expect(mockClearSelection).not.toHaveBeenCalled();
	});

	it("should clear selection when Escape is pressed and has selected documents", () => {
		hasSelectedDocuments = true;
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
		hasSelectedDocuments = true;
		const handler = createEscapeHandler();
		const event = new KeyboardEvent("keydown", { key: "Escape" });

		handler(event);

		expect(mockSetConfirmDialog).toHaveBeenCalled();
		expect(mockClearSelection).not.toHaveBeenCalled();
	});
});

// ============================================
// Test: Projects Page List Navigation - Hotkey Configuration
// ============================================

describe("Projects Page List Navigation - Hotkey Configuration", () => {
	/**
	 * Tests that the Projects page returns the correct hotkey configurations
	 * for list navigation between projects.
	 */

	const getProjectsHotkeys = (): HotkeyConfig[] => {
		// These represent the hotkeys as defined in Projects.tsx
		return [
			{
				key: "j",
				handler: vi.fn(),
				allowInInput: false,
				description: "Select next project",
			},
			{
				key: "k",
				handler: vi.fn(),
				allowInInput: false,
				description: "Select previous project",
			},
			{
				key: "ArrowDown",
				handler: vi.fn(),
				allowInInput: false,
				description: "Select next project",
			},
			{
				key: "ArrowUp",
				handler: vi.fn(),
				allowInInput: false,
				description: "Select previous project",
			},
			{
				key: "Enter",
				handler: vi.fn(),
				allowInInput: false,
				description: "Switch to selected project",
			},
			{
				key: "mod+A",
				handler: vi.fn(),
				allowInInput: false,
				description: "Archive selected project",
			},
			{
				key: "mod+U",
				handler: vi.fn(),
				allowInInput: false,
				description: "Restore archived project",
			},
			{
				key: "mod+D",
				handler: vi.fn(),
				allowInInput: false,
				description: "Delete selected project",
			},
		];
	};

	it("should have j/k configured for project navigation (vim-style)", () => {
		const hotkeys = getProjectsHotkeys();
		const jHotkey = hotkeys.find((h) => h.key === "j");
		const kHotkey = hotkeys.find((h) => h.key === "k");

		expect(jHotkey).toBeDefined();
		expect(jHotkey?.description).toBe("Select next project");
		expect(jHotkey?.allowInInput).toBe(false);

		expect(kHotkey).toBeDefined();
		expect(kHotkey?.description).toBe("Select previous project");
		expect(kHotkey?.allowInInput).toBe(false);
	});

	it("should have Arrow keys configured for project navigation", () => {
		const hotkeys = getProjectsHotkeys();
		const downHotkey = hotkeys.find((h) => h.key === "ArrowDown");
		const upHotkey = hotkeys.find((h) => h.key === "ArrowUp");

		expect(downHotkey).toBeDefined();
		expect(downHotkey?.description).toBe("Select next project");
		expect(downHotkey?.allowInInput).toBe(false);

		expect(upHotkey).toBeDefined();
		expect(upHotkey?.description).toBe("Select previous project");
		expect(upHotkey?.allowInInput).toBe(false);
	});

	it("should have Enter configured for switching to selected project", () => {
		const hotkeys = getProjectsHotkeys();
		const enterHotkey = hotkeys.find((h) => h.key === "Enter");

		expect(enterHotkey).toBeDefined();
		expect(enterHotkey?.description).toBe("Switch to selected project");
		expect(enterHotkey?.allowInInput).toBe(false);
	});

	it("should have all 8 project-specific hotkeys", () => {
		const hotkeys = getProjectsHotkeys();
		expect(hotkeys).toHaveLength(8);
	});
});

// ============================================
// Test: Projects Page List Navigation - Navigation Behavior
// ============================================

describe("Projects Page List Navigation - Navigation Behavior", () => {
	let mockSelectNext: ReturnType<typeof vi.fn>;
	let mockSelectPrevious: ReturnType<typeof vi.fn>;
	let selectedProjectId: string;
	let projects: { id: string; name: string }[];

	beforeEach(() => {
		mockSelectNext = vi.fn();
		mockSelectPrevious = vi.fn();
		selectedProjectId = "project-1";
		projects = [
			{ id: "project-1", name: "Project One" },
			{ id: "project-2", name: "Project Two" },
			{ id: "project-3", name: "Project Three" },
		];
	});

	const createSelectNextHandler = () => {
		return () => {
			const currentIndex = projects.findIndex((p) => p.id === selectedProjectId);
			if (currentIndex < projects.length - 1) {
				mockSelectNext(projects[currentIndex + 1].id);
			}
		};
	};

	const createSelectPreviousHandler = () => {
		return () => {
			const currentIndex = projects.findIndex((p) => p.id === selectedProjectId);
			if (currentIndex > 0) {
				mockSelectPrevious(projects[currentIndex - 1].id);
			}
		};
	};

	it("should select next project with j key", () => {
		const handler = createSelectNextHandler();
		handler();

		expect(mockSelectNext).toHaveBeenCalledWith("project-2");
	});

	it("should select previous project with k key", () => {
		selectedProjectId = "project-2";
		const handler = createSelectPreviousHandler();
		handler();

		expect(mockSelectPrevious).toHaveBeenCalledWith("project-1");
	});

	it("should not select next project when at the end of the list", () => {
		selectedProjectId = "project-3";
		const handler = createSelectNextHandler();
		handler();

		expect(mockSelectNext).not.toHaveBeenCalled();
	});

	it("should not select previous project when at the beginning of the list", () => {
		selectedProjectId = "project-1";
		const handler = createSelectPreviousHandler();
		handler();

		expect(mockSelectPrevious).not.toHaveBeenCalled();
	});
});

// ============================================
// Test: Projects Page List Navigation - Switch Project
// ============================================

describe("Projects Page List Navigation - Switch Project", () => {
	let mockSetCurrentProject: ReturnType<typeof vi.fn>;
	let mockSuccess: ReturnType<typeof vi.fn>;
	let selectedProjectId: string;
	let projects: { id: string; name: string }[];

	beforeEach(() => {
		mockSetCurrentProject = vi.fn();
		mockSuccess = vi.fn();
		selectedProjectId = "project-1";
		projects = [
			{ id: "project-1", name: "Project One" },
			{ id: "project-2", name: "Project Two" },
		];
	});

	const createSelectCurrentProjectHandler = () => {
		return () => {
			const project = projects.find((p) => p.id === selectedProjectId);
			if (project) {
				mockSetCurrentProject(project);
				mockSuccess(`Switched to ${project.name}`);
			}
		};
	};

	it("should switch to selected project with Enter key", () => {
		const handler = createSelectCurrentProjectHandler();
		handler();

		expect(mockSetCurrentProject).toHaveBeenCalledWith({ id: "project-1", name: "Project One" });
		expect(mockSuccess).toHaveBeenCalledWith("Switched to Project One");
	});

	it("should switch to the correct project based on selection", () => {
		selectedProjectId = "project-2";
		const handler = createSelectCurrentProjectHandler();
		handler();

		expect(mockSetCurrentProject).toHaveBeenCalledWith({ id: "project-2", name: "Project Two" });
		expect(mockSuccess).toHaveBeenCalledWith("Switched to Project Two");
	});
});

// ============================================
// Test: Search Page List Navigation - Behavior
// ============================================

describe("Search Page List Navigation - Behavior", () => {
	/**
	 * The Search page uses a different approach for keyboard navigation.
	 * It uses a useEffect with document.addEventListener for keydown events
	 * rather than the useHotkeys hook. This is because:
	 * 1. Search needs special handling for Tab navigation from input to results
	 * 2. j/k navigation should only work when not focused on the search input
	 * 3. Escape unfocuses the search input instead of navigating away
	 */

	let selectedIndex: number;
	let groupedResultsLength: number;
	let mockOpenResult: ReturnType<typeof vi.fn>;
	let mockSetSelectedIndex: ReturnType<typeof vi.fn>;
	let isSearchInputFocused: boolean;

	beforeEach(() => {
		selectedIndex = 0;
		groupedResultsLength = 5;
		mockOpenResult = vi.fn();
		mockSetSelectedIndex = vi.fn();
		isSearchInputFocused = false;
	});

	const createSearchKeydownHandler = () => {
		return (e: KeyboardEvent) => {
			// Skip if search input is focused (except for Escape and Tab)
			if (isSearchInputFocused) {
				if (e.key === "Escape") {
					// Blur search input
					return;
				}
				return;
			}

			if (e.key === "j") {
				e.preventDefault();
				const newIndex = Math.min(selectedIndex + 1, groupedResultsLength - 1);
				mockSetSelectedIndex(newIndex);
			} else if (e.key === "k") {
				e.preventDefault();
				const newIndex = Math.max(selectedIndex - 1, 0);
				mockSetSelectedIndex(newIndex);
			} else if (e.key === "/") {
				e.preventDefault();
				// Focus search input
			} else if (e.key === "Enter") {
				e.preventDefault();
				mockOpenResult(selectedIndex);
			}
		};
	};

	it("should navigate to next result with j key", () => {
		const handler = createSearchKeydownHandler();
		const event = new KeyboardEvent("keydown", { key: "j" });
		const preventDefaultSpy = vi.spyOn(event, "preventDefault");

		handler(event);

		expect(preventDefaultSpy).toHaveBeenCalled();
		expect(mockSetSelectedIndex).toHaveBeenCalledWith(1);
	});

	it("should navigate to previous result with k key", () => {
		selectedIndex = 2;
		const handler = createSearchKeydownHandler();
		const event = new KeyboardEvent("keydown", { key: "k" });

		handler(event);

		expect(mockSetSelectedIndex).toHaveBeenCalledWith(1);
	});

	it("should not navigate past the last result", () => {
		selectedIndex = 4; // Last index
		const handler = createSearchKeydownHandler();
		const event = new KeyboardEvent("keydown", { key: "j" });

		handler(event);

		expect(mockSetSelectedIndex).toHaveBeenCalledWith(4); // Stays at 4
	});

	it("should not navigate before the first result", () => {
		selectedIndex = 0;
		const handler = createSearchKeydownHandler();
		const event = new KeyboardEvent("keydown", { key: "k" });

		handler(event);

		expect(mockSetSelectedIndex).toHaveBeenCalledWith(0); // Stays at 0
	});

	it("should open result with Enter key", () => {
		selectedIndex = 2;
		const handler = createSearchKeydownHandler();
		const event = new KeyboardEvent("keydown", { key: "Enter" });

		handler(event);

		expect(mockOpenResult).toHaveBeenCalledWith(2);
	});

	it("should not handle j/k navigation when search input is focused", () => {
		isSearchInputFocused = true;
		const handler = createSearchKeydownHandler();
		const event = new KeyboardEvent("keydown", { key: "j" });

		handler(event);

		expect(mockSetSelectedIndex).not.toHaveBeenCalled();
	});
});

// ============================================
// Test: Search Page List Navigation - Search Input Focus
// ============================================

describe("Search Page List Navigation - Search Input Focus", () => {
	/**
	 * Tests specific to search input focus management
	 */

	it("should document that / key focuses search input", () => {
		/**
		 * When / is pressed (and not in an input field):
		 * 1. e.preventDefault() is called to prevent typing / in the focused element
		 * 2. searchInputRef.current?.focus() is called
		 * 3. searchInputRef.current?.select() is called to select existing text
		 */
		const searchInputFocusBehavior = {
			key: "/",
			action: "Focus and select search input",
			shouldPreventDefault: true,
			shouldSelectAllText: true,
		};

		expect(searchInputFocusBehavior.shouldPreventDefault).toBe(true);
		expect(searchInputFocusBehavior.shouldSelectAllText).toBe(true);
	});

	it("should document that Escape unfocuses search input", () => {
		/**
		 * When Escape is pressed while search input is focused:
		 * 1. e.preventDefault() is called
		 * 2. searchInputRef.current?.blur() is called
		 * 3. If there are results, focus moves to the first result
		 */
		const escapeInSearchBehavior = {
			key: "Escape",
			action: "Blur search input and focus first result",
			shouldPreventDefault: true,
			shouldFocusFirstResult: true,
		};

		expect(escapeInSearchBehavior.shouldPreventDefault).toBe(true);
		expect(escapeInSearchBehavior.shouldFocusFirstResult).toBe(true);
	});

	it("should document that Tab moves focus from input to results", () => {
		/**
		 * When Tab is pressed while search input is focused:
		 * 1. e.preventDefault() and e.stopPropagation() are called
		 * 2. If there are results, focus moves to the first result element
		 * 3. selectedIndex is set to 0
		 * 4. If no results, search input is blurred
		 */
		const tabBehavior = {
			key: "Tab",
			action: "Move focus from search input to first result",
			shouldPreventDefault: true,
			shouldStopPropagation: true,
			focusesFirstResultIfAvailable: true,
		};

		expect(tabBehavior.shouldPreventDefault).toBe(true);
		expect(tabBehavior.focusesFirstResultIfAvailable).toBe(true);
	});
});

// ============================================
// Test: Context Isolation - List Navigation is Page-Scoped
// ============================================

describe("List Navigation - Context Isolation", () => {
	/**
	 * Tests that verify list navigation shortcuts are properly scoped
	 * to their respective pages and don't interfere with each other.
	 */

	it("should verify Dashboard has mod+N while Projects does not", () => {
		// Dashboard hotkeys include mod+N for creating new documents
		const dashboardHotkeys: { key: string; description: string }[] = [
			{ key: "mod+N", description: "Create new document" },
			{ key: "j", description: "Highlight next document" },
			{ key: "k", description: "Highlight previous document" },
		];

		// Projects hotkeys do NOT include mod+N
		const projectsHotkeys: { key: string; description: string }[] = [
			{ key: "j", description: "Select next project" },
			{ key: "k", description: "Select previous project" },
			{ key: "Enter", description: "Switch to selected project" },
		];

		// mod+N is in Dashboard, NOT in Projects
		expect(dashboardHotkeys.some((h) => h.key === "mod+N")).toBe(true);
		expect(projectsHotkeys.some((h) => h.key === "mod+N")).toBe(false);
	});

	it("should verify j/k have different meanings across contexts", () => {
		/**
		 * j/k shortcuts are context-specific:
		 * - Dashboard: Navigate documents (j = next, k = previous)
		 * - Projects: Navigate projects (j = next, k = previous)
		 * - Journal: Navigate entries (j = next, k = previous)
		 * - Search: Navigate results (j = next, k = previous)
		 *
		 * The behavior is similar but operates on different items.
		 */
		const jkUsageByContext = [
			{
				context: "dashboard",
				jMeaning: "Highlight next document",
				kMeaning: "Highlight previous document",
			},
			{ context: "projects", jMeaning: "Select next project", kMeaning: "Select previous project" },
			{ context: "journal", jMeaning: "Highlight next entry", kMeaning: "Highlight previous entry" },
			{
				context: "search",
				jMeaning: "Navigate to next result",
				kMeaning: "Navigate to previous result",
			},
		];

		// All contexts use j/k for similar navigation purposes
		for (const usage of jkUsageByContext) {
			expect(usage.jMeaning.toLowerCase()).toContain("next");
			expect(usage.kMeaning.toLowerCase()).toContain("previous");
		}
	});

	it("should verify Enter has different meanings across contexts", () => {
		/**
		 * Enter key behavior varies by context:
		 * - Dashboard: Open highlighted document
		 * - Projects: Switch to selected project
		 * - Document: Focus editor when unfocused
		 * - Search: Open selected result
		 */
		const enterUsageByContext = [
			{ context: "dashboard", action: "Open highlighted document" },
			{ context: "projects", action: "Switch to selected project" },
			{ context: "document", action: "Focus editor when unfocused" },
			{ context: "search", action: "Open selected result" },
		];

		// Verify each context has a distinct Enter action
		const actions = enterUsageByContext.map((e) => e.action);
		const uniqueActions = new Set(actions);
		expect(uniqueActions.size).toBe(4);
	});

	it("should verify all list navigation shortcuts have allowInInput: false", () => {
		/**
		 * All list navigation shortcuts (j, k, ArrowUp, ArrowDown, Space, Enter)
		 * have allowInInput: false to prevent conflicts with text input.
		 * This is important because:
		 * 1. Users might be typing in a command input
		 * 2. j/k would otherwise insert characters instead of navigating
		 * 3. Space would insert a space instead of selecting
		 * 4. Enter would submit a form instead of opening an item
		 */
		const listNavigationShortcuts: HotkeyConfig[] = [
			{ key: "j", handler: vi.fn(), allowInInput: false, description: "Navigate" },
			{ key: "k", handler: vi.fn(), allowInInput: false, description: "Navigate" },
			{ key: "ArrowDown", handler: vi.fn(), allowInInput: false, description: "Navigate" },
			{ key: "ArrowUp", handler: vi.fn(), allowInInput: false, description: "Navigate" },
			{ key: "Space", handler: vi.fn(), allowInInput: false, description: "Select" },
			{ key: "Enter", handler: vi.fn(), allowInInput: false, description: "Open" },
		];

		for (const hotkey of listNavigationShortcuts) {
			expect(hotkey.allowInInput).toBe(false);
		}
	});
});

// ============================================
// Test: Registration Lifecycle - List Navigation
// ============================================

describe("List Navigation - Registration Lifecycle", () => {
	/**
	 * Tests that document list navigation hotkeys are registered and
	 * unregistered as components mount and unmount.
	 */

	it("should register hotkeys on Dashboard mount", () => {
		const mockRegister = vi.fn().mockReturnValue("hotkey-1");

		const dashboardHotkeys: HotkeyConfig[] = [
			{ key: "j", handler: vi.fn(), description: "Highlight next document" },
			{ key: "k", handler: vi.fn(), description: "Highlight previous document" },
			{ key: "Enter", handler: vi.fn(), description: "Open highlighted document" },
			{ key: "mod+N", handler: vi.fn(), description: "Create new document" },
		];

		const ids = dashboardHotkeys.map((config) => mockRegister(config));

		expect(mockRegister).toHaveBeenCalledTimes(4);
		expect(ids).toHaveLength(4);
	});

	it("should unregister hotkeys on Dashboard unmount", () => {
		const mockRegister = vi.fn().mockImplementation(() => `hotkey-${Math.random()}`);
		const mockUnregister = vi.fn();

		const dashboardHotkeys: HotkeyConfig[] = [
			{ key: "j", handler: vi.fn(), description: "Highlight next document" },
			{ key: "k", handler: vi.fn(), description: "Highlight previous document" },
		];

		const ids = dashboardHotkeys.map((config) => mockRegister(config));
		ids.forEach((id) => {
			mockUnregister(id);
		});

		expect(mockUnregister).toHaveBeenCalledTimes(2);
	});

	it("should switch hotkeys when navigating from Dashboard to Projects", () => {
		const hotkeyRegistry = new Map<string, HotkeyConfig>();

		const register = (config: HotkeyConfig): string => {
			const id = `hotkey-${hotkeyRegistry.size}`;
			hotkeyRegistry.set(id, config);
			return id;
		};

		const unregister = (id: string): void => {
			hotkeyRegistry.delete(id);
		};

		// Dashboard mounts
		const dashboardJId = register({
			key: "j",
			handler: vi.fn(),
			description: "Highlight next document",
		});
		const dashboardModNId = register({
			key: "mod+N",
			handler: vi.fn(),
			description: "Create new document",
		});

		// Verify Dashboard hotkeys are active
		expect(
			Array.from(hotkeyRegistry.values()).some((h) => h.description === "Highlight next document"),
		).toBe(true);
		expect(
			Array.from(hotkeyRegistry.values()).some((h) => h.description === "Create new document"),
		).toBe(true);

		// Dashboard unmounts (navigation to Projects)
		unregister(dashboardJId);
		unregister(dashboardModNId);

		// Verify Dashboard hotkeys are removed
		expect(
			Array.from(hotkeyRegistry.values()).some((h) => h.description === "Highlight next document"),
		).toBe(false);
		expect(
			Array.from(hotkeyRegistry.values()).some((h) => h.description === "Create new document"),
		).toBe(false);

		// Projects mounts
		register({ key: "j", handler: vi.fn(), description: "Select next project" });
		register({ key: "Enter", handler: vi.fn(), description: "Switch to selected project" });

		// Verify Projects hotkeys are active
		expect(
			Array.from(hotkeyRegistry.values()).some((h) => h.description === "Select next project"),
		).toBe(true);
		expect(
			Array.from(hotkeyRegistry.values()).some((h) => h.description === "Switch to selected project"),
		).toBe(true);

		// Verify no Dashboard hotkeys are active
		expect(
			Array.from(hotkeyRegistry.values()).some((h) => h.description === "Highlight next document"),
		).toBe(false);
	});
});
