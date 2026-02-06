export const TIMEOUTS = {
	tooltipHoverDelay: 500,
	tooltipFocusDelay: 800,
	tooltipOffset: 8,
	scrollDebounceMs: 200,
	autoSaveDebounceMs: 2000,
	autoSaveMaxRetries: 3,
	autoSaveRetryBaseMs: 1000,
	savedStateDisplayMs: 3000,
	welcomeDelayMs: 500,
	savePersistenceDebounceMs: 500,
	/** Search input debounce (Search page). */
	searchDebounceMs: 300,
	/** Document picker filter debounce (EmptyPaneDocumentPicker). */
	documentPickerFilterDebounceMs: 200,
	/** Delay before restoring focus after modal open (WelcomeOverlay, MoveDocumentDialog, NewProjectDialog, HelpModal). */
	focusRestoreMs: 100,
	/** Delay before clearing git error toast (GlobalCommandPalette). */
	gitErrorDismissMs: 300,
	/** Help modal: delay before setting announcement (ensures same-message re-announce). */
	helpAnnounceDelayMs: 50,
	/** MilestoneHint: exit animation duration before onDismiss. */
	milestoneAnimationMs: 200,
} as const;
