import { create } from "zustand";

export interface SaveErrorEntry {
	error: Error;
	retryFn: (() => Promise<void>) | null;
	isDirty: boolean;
}

interface SaveErrorState {
	/** Per-editor-instance save errors, keyed by a stable instance token. */
	errors: Map<object, SaveErrorEntry>;
	/** True when any instance currently has unsaved changes that failed to save. */
	hasDirtyError: boolean;
	setError: (key: object, error: Error, retryFn?: (() => Promise<void>) | null) => void;
	clearError: (key: object) => void;
	setDirtyError: (key: object, dirty: boolean) => void;
}

const anyDirty = (errors: Map<object, SaveErrorEntry>): boolean => {
	for (const entry of errors.values()) {
		if (entry.isDirty) return true;
	}
	return false;
};

// Keyed by instance so that, in a split-pane view, one editor's success or
// failure never overwrites another's error/dirty state (which would silently
// hide a failed save and let the user navigate away).
export const useSaveErrorStore = create<SaveErrorState>((set) => ({
	errors: new Map(),
	hasDirtyError: false,
	setError: (key, error, retryFn = null) =>
		set((state) => {
			const errors = new Map(state.errors);
			errors.set(key, { error, retryFn, isDirty: true });
			return { errors, hasDirtyError: anyDirty(errors) };
		}),
	clearError: (key) =>
		set((state) => {
			if (!state.errors.has(key)) return state;
			const errors = new Map(state.errors);
			errors.delete(key);
			return { errors, hasDirtyError: anyDirty(errors) };
		}),
	setDirtyError: (key, dirty) =>
		set((state) => {
			const entry = state.errors.get(key);
			// Dirty-with-error only exists alongside a tracked error; ignore
			// updates for instances that have no current error.
			if (!entry || entry.isDirty === dirty) return state;
			const errors = new Map(state.errors);
			errors.set(key, { ...entry, isDirty: dirty });
			return { errors, hasDirtyError: anyDirty(errors) };
		}),
}));
