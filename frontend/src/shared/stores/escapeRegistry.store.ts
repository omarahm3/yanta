import { create } from "zustand";

export type EscapeHandler = (e: KeyboardEvent) => void;

interface EscapeRegistryState {
	stack: EscapeHandler[];
	push: (handler: EscapeHandler) => string;
	remove: (id: string) => void;
	reset: () => void;
}

let nextId = 0;
const idToIndex = new Map<string, number>();

/**
 * LIFO escape registry. Consumers register an Escape handler; only the topmost
 * (most recently registered) handler fires on Escape. This prevents parallel
 * capture-phase Escape handlers from firing multiple unrelated actions on one
 * keypress.
 */
export const useEscapeRegistryStore = create<EscapeRegistryState>((set, get) => ({
	stack: [],
	push: (handler: EscapeHandler) => {
		const id = `escape-${nextId++}`;
		set((s) => {
			const newStack = [...s.stack, handler];
			idToIndex.set(id, newStack.length - 1);
			return { stack: newStack };
		});
		return id;
	},
	remove: (id: string) => {
		set((s) => {
			const idx = idToIndex.get(id);
			if (idx === undefined) return s;
			const newStack = s.stack.filter((_, i) => i !== idx);
			idToIndex.delete(id);
			for (const [key, val] of idToIndex) {
				if (val > idx) {
					idToIndex.set(key, val - 1);
				}
			}
			return { stack: newStack };
		});
	},
	reset: () => {
		idToIndex.clear();
		set({ stack: [] });
	},
}));

/**
 * Dispatch Escape to the topmost registered handler. Returns true if a handler
 * was called, false if the stack was empty.
 */
export function dispatchEscape(e: KeyboardEvent): boolean {
	const stack = useEscapeRegistryStore.getState().stack;
	if (stack.length === 0) return false;
	const topHandler = stack[stack.length - 1];
	if (topHandler) {
		topHandler(e);
		return true;
	}
	return false;
}
