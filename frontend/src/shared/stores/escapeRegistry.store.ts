import { create } from "zustand";

/**
 * Escape handler. Return `true` (or `void`) when the Escape was handled so the
 * caller suppresses the native event; return `false` to decline and let Escape
 * fall through to native/Radix handling (e.g. so a Radix Dialog can still close).
 */
export type EscapeHandler = (e: KeyboardEvent) => boolean | void;

interface RegistryEntry {
	id: string;
	handler: EscapeHandler;
}

interface EscapeRegistryState {
	stack: RegistryEntry[];
	push: (handler: EscapeHandler) => string;
	remove: (id: string) => void;
	reset: () => void;
}

let nextId = 0;

/**
 * LIFO escape registry. Consumers register an Escape handler; only the topmost
 * (most recently registered) handler fires on Escape. This prevents parallel
 * capture-phase Escape handlers from firing multiple unrelated actions on one
 * keypress.
 */
export const useEscapeRegistryStore = create<EscapeRegistryState>((set) => ({
	stack: [],
	push: (handler: EscapeHandler) => {
		const id = `escape-${nextId++}`;
		set((s) => ({ stack: [...s.stack, { id, handler }] }));
		return id;
	},
	remove: (id: string) => {
		set((s) => ({ stack: s.stack.filter((item) => item.id !== id) }));
	},
	reset: () => {
		set({ stack: [] });
	},
}));

/**
 * Dispatch Escape to the topmost registered handler. Returns true only when that
 * handler actually handled the event (so the caller knows whether to suppress
 * it); false when the stack is empty or the top handler declined.
 */
export function dispatchEscape(e: KeyboardEvent): boolean {
	const { stack } = useEscapeRegistryStore.getState();
	const top = stack[stack.length - 1];
	if (!top) return false;
	return top.handler(e) !== false;
}
