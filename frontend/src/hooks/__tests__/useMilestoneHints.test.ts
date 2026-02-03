import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	MILESTONE_HINT_IDS,
	MILESTONE_HINTS,
	type MilestoneHintId,
	useMilestoneHints,
} from "../useMilestoneHints";
import type { UserProgressData } from "../useUserProgress";

describe("useMilestoneHints", () => {
	const createMockProgressData = (overrides: Partial<UserProgressData> = {}): UserProgressData => ({
		documentsCreated: 0,
		journalEntriesCreated: 0,
		projectsSwitched: 0,
		hintsShown: [],
		...overrides,
	});

	const createMockFunctions = () => {
		const shownHints = new Set<string>();
		return {
			shownHints,
			hasHintBeenShown: vi.fn((hintId: string) => shownHints.has(hintId)),
			markHintShown: vi.fn((hintId: string) => shownHints.add(hintId)),
		};
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("MILESTONE_HINT_IDS", () => {
		it("exports all expected hint IDs", () => {
			expect(MILESTONE_HINT_IDS.FIRST_SAVE).toBe("first-save");
			expect(MILESTONE_HINT_IDS.RECENT_DOCS).toBe("recent-docs");
			expect(MILESTONE_HINT_IDS.JOURNAL_NAV).toBe("journal-nav");
			expect(MILESTONE_HINT_IDS.JOURNAL_SELECT).toBe("journal-select");
			expect(MILESTONE_HINT_IDS.QUICK_SWITCH).toBe("quick-switch");
		});
	});

	describe("MILESTONE_HINTS configuration", () => {
		it("defines all 5 milestone hints", () => {
			expect(MILESTONE_HINTS).toHaveLength(5);
		});

		it("first-save hint triggers on exactly 1 document", () => {
			const hint = MILESTONE_HINTS.find((h) => h.id === "first-save");
			expect(hint).toBeDefined();

			expect(hint?.shouldShow(createMockProgressData({ documentsCreated: 0 }))).toBe(false);
			expect(hint?.shouldShow(createMockProgressData({ documentsCreated: 1 }))).toBe(true);
			expect(hint?.shouldShow(createMockProgressData({ documentsCreated: 2 }))).toBe(false);
		});

		it("recent-docs hint triggers on 5+ documents", () => {
			const hint = MILESTONE_HINTS.find((h) => h.id === "recent-docs");
			expect(hint).toBeDefined();

			expect(hint?.shouldShow(createMockProgressData({ documentsCreated: 4 }))).toBe(false);
			expect(hint?.shouldShow(createMockProgressData({ documentsCreated: 5 }))).toBe(true);
			expect(hint?.shouldShow(createMockProgressData({ documentsCreated: 100 }))).toBe(true);
		});

		it("journal-nav hint triggers on exactly 1 journal entry", () => {
			const hint = MILESTONE_HINTS.find((h) => h.id === "journal-nav");
			expect(hint).toBeDefined();

			expect(hint?.shouldShow(createMockProgressData({ journalEntriesCreated: 0 }))).toBe(false);
			expect(hint?.shouldShow(createMockProgressData({ journalEntriesCreated: 1 }))).toBe(true);
			expect(hint?.shouldShow(createMockProgressData({ journalEntriesCreated: 2 }))).toBe(false);
		});

		it("journal-select hint triggers on 10+ journal entries", () => {
			const hint = MILESTONE_HINTS.find((h) => h.id === "journal-select");
			expect(hint).toBeDefined();

			expect(hint?.shouldShow(createMockProgressData({ journalEntriesCreated: 9 }))).toBe(false);
			expect(hint?.shouldShow(createMockProgressData({ journalEntriesCreated: 10 }))).toBe(true);
			expect(hint?.shouldShow(createMockProgressData({ journalEntriesCreated: 50 }))).toBe(true);
		});

		it("quick-switch hint triggers on exactly 1 project switch", () => {
			const hint = MILESTONE_HINTS.find((h) => h.id === "quick-switch");
			expect(hint).toBeDefined();

			expect(hint?.shouldShow(createMockProgressData({ projectsSwitched: 0 }))).toBe(false);
			expect(hint?.shouldShow(createMockProgressData({ projectsSwitched: 1 }))).toBe(true);
			expect(hint?.shouldShow(createMockProgressData({ projectsSwitched: 2 }))).toBe(false);
		});

		it("each hint has correct text", () => {
			const firstSave = MILESTONE_HINTS.find((h) => h.id === "first-save");
			expect(firstSave?.text).toBe("Press Ctrl+S to save quickly");

			const recentDocs = MILESTONE_HINTS.find((h) => h.id === "recent-docs");
			expect(recentDocs?.text).toBe("Power tip: Ctrl+E opens your recent documents");

			const journalNav = MILESTONE_HINTS.find((h) => h.id === "journal-nav");
			expect(journalNav?.text).toBe("Navigate days with Ctrl+← and Ctrl+→");

			const journalSelect = MILESTONE_HINTS.find((h) => h.id === "journal-select");
			expect(journalSelect?.text).toBe("Select entries with Space to promote or delete in bulk");

			const quickSwitch = MILESTONE_HINTS.find((h) => h.id === "quick-switch");
			expect(quickSwitch?.text).toBe("Quick switch with Ctrl+Tab to toggle between projects");
		});
	});

	describe("currentHint", () => {
		it("returns null when no milestone is met", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData(),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).toBeNull();
		});

		it("returns first-save hint when first document is created", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).not.toBeNull();
			expect(result.current.currentHint?.id).toBe("first-save");
		});

		it("returns journal-nav hint when first journal entry is created", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ journalEntriesCreated: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).not.toBeNull();
			expect(result.current.currentHint?.id).toBe("journal-nav");
		});

		it("returns quick-switch hint when first project switch occurs", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ projectsSwitched: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).not.toBeNull();
			expect(result.current.currentHint?.id).toBe("quick-switch");
		});

		it("returns recent-docs hint when 5 documents are created", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 5 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).not.toBeNull();
			expect(result.current.currentHint?.id).toBe("recent-docs");
		});

		it("returns journal-select hint when 10 journal entries are created", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ journalEntriesCreated: 10 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).not.toBeNull();
			expect(result.current.currentHint?.id).toBe("journal-select");
		});

		it("returns null when hint has already been shown", () => {
			const mocks = createMockFunctions();
			mocks.shownHints.add("first-save");

			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).toBeNull();
		});

		it("returns first matching hint when multiple milestones are met", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({
						documentsCreated: 5,
						journalEntriesCreated: 10,
						projectsSwitched: 1,
					}),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			// Should return recent-docs because it's first in the array that matches
			expect(result.current.currentHint).not.toBeNull();
			expect(result.current.currentHint?.id).toBe("recent-docs");
		});

		it("skips to next available hint when earlier ones are shown", () => {
			const mocks = createMockFunctions();
			mocks.shownHints.add("recent-docs");

			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({
						documentsCreated: 5,
						journalEntriesCreated: 10,
						projectsSwitched: 1,
					}),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).not.toBeNull();
			expect(result.current.currentHint?.id).toBe("journal-select");
		});
	});

	describe("dismissCurrentHint", () => {
		it("calls markHintShown with current hint id", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint?.id).toBe("first-save");

			act(() => {
				result.current.dismissCurrentHint();
			});

			expect(mocks.markHintShown).toHaveBeenCalledWith("first-save");
		});

		it("does not call markHintShown when there is no current hint", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData(),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.currentHint).toBeNull();

			act(() => {
				result.current.dismissCurrentHint();
			});

			expect(mocks.markHintShown).not.toHaveBeenCalled();
		});
	});

	describe("shouldShowHint", () => {
		it("returns true for hint that should be shown", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.shouldShowHint("first-save")).toBe(true);
		});

		it("returns false for hint that has already been shown", () => {
			const mocks = createMockFunctions();
			mocks.shownHints.add("first-save");

			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.shouldShowHint("first-save")).toBe(false);
		});

		it("returns false for hint whose milestone is not met", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 0 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.shouldShowHint("first-save")).toBe(false);
		});

		it("returns false for unknown hint id", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 10 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.shouldShowHint("unknown-hint" as MilestoneHintId)).toBe(false);
		});
	});

	describe("pendingHints", () => {
		it("returns all hints when none have been shown", () => {
			const mocks = createMockFunctions();
			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData(),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.pendingHints).toHaveLength(5);
		});

		it("excludes hints that have been shown", () => {
			const mocks = createMockFunctions();
			mocks.shownHints.add("first-save");
			mocks.shownHints.add("journal-nav");

			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData(),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.pendingHints).toHaveLength(3);
			expect(result.current.pendingHints.map((h) => h.id)).not.toContain("first-save");
			expect(result.current.pendingHints.map((h) => h.id)).not.toContain("journal-nav");
		});

		it("returns empty array when all hints have been shown", () => {
			const mocks = createMockFunctions();
			MILESTONE_HINTS.forEach((h) => {
				mocks.shownHints.add(h.id);
			});

			const { result } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData(),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			expect(result.current.pendingHints).toHaveLength(0);
		});
	});

	describe("progressive user journey", () => {
		it("shows hints in correct order as user progresses", () => {
			const mocks = createMockFunctions();

			// User creates first document - should show first-save hint
			const { result: result1 } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);
			expect(result1.current.currentHint?.id).toBe("first-save");

			// Dismiss first-save hint
			act(() => {
				result1.current.dismissCurrentHint();
			});
			expect(mocks.markHintShown).toHaveBeenCalledWith("first-save");

			// User creates 5 documents - should show recent-docs hint
			const { result: result2 } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 5 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);
			expect(result2.current.currentHint?.id).toBe("recent-docs");

			// Dismiss recent-docs hint
			act(() => {
				result2.current.dismissCurrentHint();
			});
			expect(mocks.markHintShown).toHaveBeenCalledWith("recent-docs");

			// User creates first journal entry - should show journal-nav hint
			const { result: result3 } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 5, journalEntriesCreated: 1 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);
			expect(result3.current.currentHint?.id).toBe("journal-nav");

			// Dismiss journal-nav hint
			act(() => {
				result3.current.dismissCurrentHint();
			});
			expect(mocks.markHintShown).toHaveBeenCalledWith("journal-nav");

			// User creates 10 journal entries - should show journal-select hint
			const { result: result4 } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({ documentsCreated: 5, journalEntriesCreated: 10 }),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);
			expect(result4.current.currentHint?.id).toBe("journal-select");

			// Dismiss journal-select hint
			act(() => {
				result4.current.dismissCurrentHint();
			});
			expect(mocks.markHintShown).toHaveBeenCalledWith("journal-select");

			// User switches project - should show quick-switch hint
			const { result: result5 } = renderHook(() =>
				useMilestoneHints({
					progressData: createMockProgressData({
						documentsCreated: 5,
						journalEntriesCreated: 10,
						projectsSwitched: 1,
					}),
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);
			expect(result5.current.currentHint?.id).toBe("quick-switch");

			// Dismiss quick-switch hint
			act(() => {
				result5.current.dismissCurrentHint();
			});
			expect(mocks.markHintShown).toHaveBeenCalledWith("quick-switch");

			// Verify all hints were marked as shown
			expect(mocks.shownHints.size).toBe(5);
		});

		it("returns null for previously shown hints after state update", () => {
			const mocks = createMockFunctions();

			// First document created
			const { result, rerender } = renderHook(
				({ progressData, hasHintBeenShown }) =>
					useMilestoneHints({
						progressData,
						hasHintBeenShown,
						markHintShown: mocks.markHintShown,
					}),
				{
					initialProps: {
						progressData: createMockProgressData({ documentsCreated: 1 }),
						hasHintBeenShown: mocks.hasHintBeenShown,
					},
				},
			);

			expect(result.current.currentHint?.id).toBe("first-save");

			// Simulate the parent marking the hint as shown (like the real useUserProgress does)
			mocks.shownHints.add("first-save");

			// Create new hasHintBeenShown function that returns updated value
			const updatedHasHintBeenShown = vi.fn((hintId: string) => mocks.shownHints.has(hintId));

			// Rerender with the new function reference (simulating state update from useUserProgress)
			rerender({
				progressData: createMockProgressData({ documentsCreated: 1 }),
				hasHintBeenShown: updatedHasHintBeenShown,
			});

			// Now the hint should be null since it's been shown
			expect(result.current.currentHint).toBeNull();
		});
	});

	describe("memoization", () => {
		it("returns same currentHint reference when inputs haven't changed", () => {
			const mocks = createMockFunctions();
			const progressData = createMockProgressData({ documentsCreated: 1 });

			const { result, rerender } = renderHook(() =>
				useMilestoneHints({
					progressData,
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			const firstHint = result.current.currentHint;
			rerender();
			const secondHint = result.current.currentHint;

			expect(firstHint).toBe(secondHint);
		});

		it("returns same pendingHints reference when inputs haven't changed", () => {
			const mocks = createMockFunctions();
			const progressData = createMockProgressData();

			const { result, rerender } = renderHook(() =>
				useMilestoneHints({
					progressData,
					hasHintBeenShown: mocks.hasHintBeenShown,
					markHintShown: mocks.markHintShown,
				}),
			);

			const firstPending = result.current.pendingHints;
			rerender();
			const secondPending = result.current.pendingHints;

			expect(firstPending).toBe(secondPending);
		});
	});
});
