import { create } from "zustand";
import { type ParsedGitError, parseAppError } from "../utils/gitErrorParser";

interface ErrorDialogState {
	/** FIFO queue of errors; the head is the one currently shown in the dialog. */
	queue: ParsedGitError[];
	/** Parse an error and enqueue it for display. */
	showError: (error: unknown) => void;
	/** Dismiss the current error, advancing to the next queued one (if any). */
	dismiss: () => void;
	/** For tests: clear all errors. */
	reset: () => void;
}

/**
 * Global error dialog queue. Any `.error()` notification and every git failure
 * routes here so the user always gets a dismissible, scrollable dialog instead
 * of a toast that can grow off-screen. Consecutive duplicates are collapsed so
 * a retry loop doesn't stack identical dialogs.
 */
export const useErrorDialogStore = create<ErrorDialogState>((set) => ({
	queue: [],
	showError: (error) =>
		set((state) => {
			const parsed = parseAppError(error);
			const last = state.queue[state.queue.length - 1];
			if (last && last.technicalDetails === parsed.technicalDetails) {
				return state;
			}
			return { queue: [...state.queue, parsed] };
		}),
	dismiss: () => set((state) => ({ queue: state.queue.slice(1) })),
	reset: () => set({ queue: [] }),
}));
