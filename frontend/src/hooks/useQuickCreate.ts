import { useCallback, useRef } from "react";
import { useProjectContext } from "../contexts";
import { saveDocument } from "../services/DocumentService";
import type { BlockNoteBlock } from "../types/Document";
import { createEmptyDocument } from "../utils/documentBlockUtils";
import { useNotification } from "./useNotification";

export interface UseQuickCreateOptions {
	/**
	 * Callback when navigation is needed after document creation
	 */
	onNavigate?: (page: string, state?: Record<string, string | number | boolean | undefined>) => void;
}

export interface UseQuickCreateReturn {
	/**
	 * Handler for creating a new document from a title string
	 * Used with QuickCreateInput's onCreateDocument prop
	 */
	handleCreateDocument: (title: string) => Promise<void>;
	/**
	 * Handler for creating a new journal entry from content string
	 * Used with QuickCreateInput's onCreateJournalEntry prop
	 */
	handleCreateJournalEntry: (content: string) => Promise<void>;
	/**
	 * Current project alias for display in QuickCreateInput
	 */
	currentProjectAlias: string | null;
	/**
	 * Whether creation is disabled (no project selected)
	 */
	isDisabled: boolean;
}

/**
 * Hook for creating documents and journal entries via QuickCreateInput.
 * Handles validation, backend API calls, notifications, and navigation.
 */
export function useQuickCreate({ onNavigate }: UseQuickCreateOptions = {}): UseQuickCreateReturn {
	const { currentProject } = useProjectContext();
	const { success, error } = useNotification();
	const currentProjectRef = useRef(currentProject);
	currentProjectRef.current = currentProject;

	const handleCreateDocument = useCallback(
		async (title: string) => {
			const project = currentProjectRef.current;

			// Validate title is not empty
			if (!title.trim()) {
				return;
			}

			// Validate project is selected
			if (!project) {
				error("No project selected");
				return;
			}

			try {
				// Create document with title as H1 heading
				const docData = createEmptyDocument(title);

				// Save to backend - returns the new document path
				const documentPath = await saveDocument({
					path: undefined,
					projectAlias: project.alias,
					title: title,
					blocks: docData.blocks as BlockNoteBlock[],
					tags: [],
				});

				success("Document created");

				// Navigate to the new document
				onNavigate?.("document", {
					documentPath: documentPath,
				});
			} catch (err) {
				error(
					`Failed to create document: ${err instanceof Error ? err.message : "Unknown error"}`,
				);
			}
		},
		[onNavigate, success, error],
	);

	const handleCreateJournalEntry = useCallback(
		async (_content: string) => {
			// Journal entry creation will be implemented in Task 4
			// For now, this is a placeholder
		},
		[],
	);

	return {
		handleCreateDocument,
		handleCreateJournalEntry,
		currentProjectAlias: currentProject?.alias ?? null,
		isDisabled: !currentProject,
	};
}
