import { create } from "zustand";
import type { CommandOption } from "../../components/ui";

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

export const useCommandRegistryStore = create<CommandRegistryState>((set, get) => ({
	sources: {},

	setCommands: (source, commands) => {
		set((state) => ({
			sources: { ...state.sources, [source]: commands },
		}));
	},

	removeSource: (source) => {
		set((state) => {
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
