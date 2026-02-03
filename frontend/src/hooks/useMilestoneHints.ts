import { useCallback, useMemo } from "react";
import type { UserProgressData } from "./useUserProgress";

/**
 * Milestone hint identifiers.
 * These are used as keys in the hintsShown array to prevent showing the same hint twice.
 */
export const MILESTONE_HINT_IDS = {
	FIRST_SAVE: "first-save",
	RECENT_DOCS: "recent-docs",
	JOURNAL_NAV: "journal-nav",
	JOURNAL_SELECT: "journal-select",
	QUICK_SWITCH: "quick-switch",
} as const;

export type MilestoneHintId = (typeof MILESTONE_HINT_IDS)[keyof typeof MILESTONE_HINT_IDS];

/**
 * Configuration for a milestone hint trigger.
 */
export interface MilestoneHint {
	id: MilestoneHintId;
	text: string;
	/**
	 * Function that determines if this hint should be shown based on user progress.
	 * Returns true if the milestone threshold is met.
	 */
	shouldShow: (progress: UserProgressData) => boolean;
}

/**
 * All milestone hints with their trigger conditions.
 * Hints are evaluated in order; the first matching hint is returned.
 */
export const MILESTONE_HINTS: MilestoneHint[] = [
	{
		id: MILESTONE_HINT_IDS.FIRST_SAVE,
		text: "Press Ctrl+S to save quickly",
		shouldShow: (progress) => progress.documentsCreated === 1,
	},
	{
		id: MILESTONE_HINT_IDS.RECENT_DOCS,
		text: "Power tip: Ctrl+E opens your recent documents",
		shouldShow: (progress) => progress.documentsCreated >= 5,
	},
	{
		id: MILESTONE_HINT_IDS.JOURNAL_NAV,
		text: "Navigate days with Ctrl+← and Ctrl+→",
		shouldShow: (progress) => progress.journalEntriesCreated === 1,
	},
	{
		id: MILESTONE_HINT_IDS.JOURNAL_SELECT,
		text: "Select entries with Space to promote or delete in bulk",
		shouldShow: (progress) => progress.journalEntriesCreated >= 10,
	},
	{
		id: MILESTONE_HINT_IDS.QUICK_SWITCH,
		text: "Quick switch with Ctrl+Tab to toggle between projects",
		shouldShow: (progress) => progress.projectsSwitched === 1,
	},
];

export interface UseMilestoneHintsOptions {
	progressData: UserProgressData;
	hasHintBeenShown: (hintId: string) => boolean;
	markHintShown: (hintId: string) => void;
}

export interface UseMilestoneHintsReturn {
	/**
	 * The next hint to display, or null if no hint should be shown.
	 */
	currentHint: MilestoneHint | null;
	/**
	 * Mark the current hint as shown and dismissed.
	 * Call this after the hint is displayed/dismissed to prevent showing it again.
	 */
	dismissCurrentHint: () => void;
	/**
	 * Check if a specific hint should be shown (milestone met and not yet shown).
	 */
	shouldShowHint: (hintId: MilestoneHintId) => boolean;
	/**
	 * Get all hints that are eligible to be shown (not yet shown).
	 */
	pendingHints: MilestoneHint[];
}

/**
 * Hook that checks user progress and returns the next milestone hint to show.
 *
 * Usage:
 * ```tsx
 * const { currentHint, dismissCurrentHint } = useMilestoneHints({
 *   progressData,
 *   hasHintBeenShown,
 *   markHintShown,
 * });
 *
 * return currentHint ? (
 *   <MilestoneHint
 *     hintId={currentHint.id}
 *     text={currentHint.text}
 *     onDismiss={dismissCurrentHint}
 *   />
 * ) : null;
 * ```
 */
export function useMilestoneHints({
	progressData,
	hasHintBeenShown,
	markHintShown,
}: UseMilestoneHintsOptions): UseMilestoneHintsReturn {
	// Find all hints that haven't been shown yet
	const pendingHints = useMemo(() => {
		return MILESTONE_HINTS.filter((hint) => !hasHintBeenShown(hint.id));
	}, [hasHintBeenShown]);

	// Find the first hint that should be shown based on current progress
	const currentHint = useMemo(() => {
		for (const hint of MILESTONE_HINTS) {
			if (!hasHintBeenShown(hint.id) && hint.shouldShow(progressData)) {
				return hint;
			}
		}
		return null;
	}, [progressData, hasHintBeenShown]);

	const dismissCurrentHint = useCallback(() => {
		if (currentHint) {
			markHintShown(currentHint.id);
		}
	}, [currentHint, markHintShown]);

	const shouldShowHint = useCallback(
		(hintId: MilestoneHintId): boolean => {
			const hint = MILESTONE_HINTS.find((h) => h.id === hintId);
			if (!hint) return false;
			return !hasHintBeenShown(hintId) && hint.shouldShow(progressData);
		},
		[progressData, hasHintBeenShown],
	);

	return {
		currentHint,
		dismissCurrentHint,
		shouldShowHint,
		pendingHints,
	};
}
