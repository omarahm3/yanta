import type React from "react";
import { useUserProgressContext } from "../context/UserProgressContext";
import { useMilestoneHints } from "../hooks";
import { MilestoneHint } from "./MilestoneHint";

/**
 * MilestoneHintManager component that displays progressive milestone hints.
 *
 * This component connects the useMilestoneHints hook with the MilestoneHint
 * component to display contextual tips as users reach usage milestones:
 *
 * - First document saved: "Press Ctrl+S to save quickly"
 * - 5 documents created: "Power tip: Ctrl+K → Recent Documents to quickly reopen files"
 * - First journal entry: "Navigate days with Ctrl+← and Ctrl+→"
 * - 10 journal entries: "Select entries with Space to promote or delete in bulk"
 * - First project switch: "Quick switch with Ctrl+Tab to toggle between projects"
 *
 * Each hint is shown only once and persists to localStorage.
 */
export const MilestoneHintManager: React.FC = () => {
	const { progressData, hasHintBeenShown, markHintShown } = useUserProgressContext();

	const { currentHint, dismissCurrentHint } = useMilestoneHints({
		progressData,
		hasHintBeenShown,
		markHintShown,
	});

	if (!currentHint) {
		return null;
	}

	return (
		<MilestoneHint hintId={currentHint.id} text={currentHint.text} onDismiss={dismissCurrentHint} />
	);
};
