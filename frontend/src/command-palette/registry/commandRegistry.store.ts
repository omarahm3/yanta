import { create } from "zustand";
import type { CommandOption } from "../../shared/ui";

const SOURCE_ORDER = [
	"navigation",
	"create",
	"document",
	"git",
	"projects",
	"application",
] as const;

interface CommandRegistryState {
	sources: Record<string, CommandOption[]>;
	setCommands: (source: string, commands: CommandOption[]) => void;
	removeSource: (source: string) => void;
	getAllCommands: () => CommandOption[];
}

function areKeywordArraysEqual(a?: string[], b?: string[]): boolean {
	if (a === b) return true;
	const aa = a ?? [];
	const bb = b ?? [];
	if (aa.length !== bb.length) return false;
	for (let i = 0; i < aa.length; i += 1) {
		if (aa[i] !== bb[i]) return false;
	}
	return true;
}

function areCommandsEquivalent(
	previous: CommandOption[] | undefined,
	next: CommandOption[],
): boolean {
	if (!previous) return false;
	if (previous.length !== next.length) return false;
	for (let i = 0; i < previous.length; i += 1) {
		const a = previous[i];
		const b = next[i];
		if (
			a.id !== b.id ||
			a.text !== b.text ||
			a.hint !== b.hint ||
			a.shortcut !== b.shortcut ||
			a.group !== b.group ||
			a.keepOpen !== b.keepOpen
		) {
			return false;
		}
		if (!areKeywordArraysEqual(a.keywords, b.keywords)) {
			return false;
		}
	}
	return true;
}

export const useCommandRegistryStore = create<CommandRegistryState>((set, get) => ({
	sources: {},

	setCommands: (source, commands) => {
		set((state) => {
			if (areCommandsEquivalent(state.sources[source], commands)) {
				return state;
			}
			return {
				sources: { ...state.sources, [source]: commands },
			};
		});
	},

	removeSource: (source) => {
		set((state) => {
			if (!(source in state.sources)) {
				return state;
			}
			const next = { ...state.sources };
			delete next[source];
			return { sources: next };
		});
	},

	getAllCommands: () => {
		const { sources } = get();
		const result: CommandOption[] = [];
		for (const key of SOURCE_ORDER) {
			const list = sources[key];
			if (list?.length) result.push(...list);
		}
		// Include any sources not in SOURCE_ORDER (e.g. future plugins)
		for (const key of Object.keys(sources)) {
			if (SOURCE_ORDER.includes(key as (typeof SOURCE_ORDER)[number])) continue;
			result.push(...(sources[key] ?? []));
		}
		return result;
	},
}));
