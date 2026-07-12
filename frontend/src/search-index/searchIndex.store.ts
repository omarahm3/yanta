import type MiniSearch from "minisearch";
import { create } from "zustand";
import type { IndexDoc } from "../../bindings/yanta/internal/search/models";
import { ExportIndex } from "../../bindings/yanta/internal/search/service";
import type { FinderItem } from "../global-search/types";
import { BackendLogger } from "../shared/utils/backendLogger";
import { parseQuery } from "./queryParser";
import { createMiniSearch } from "./searchIndex";
import { buildSnippet } from "./snippet";

type IndexStatus = "idle" | "building" | "ready" | "error";

interface SearchIndexState {
	status: IndexStatus;
	index: MiniSearch<IndexDoc> | null;
	docsById: Map<string, IndexDoc>;
	/** Build (or fully rebuild) the index from the backend export. */
	build: () => Promise<void>;
	/** Debounced full rebuild — used by vault-change event handlers. */
	scheduleRebuild: () => void;
	/** Synchronous, in-memory search returning finder rows (ranked, capped). */
	search: (query: string) => FinderItem[];
}

const SEARCH_LIMIT = 50;
const REBUILD_DEBOUNCE_MS = 800;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
// Set when a rebuild is requested while a build is already running, so the
// request is coalesced into one trailing rebuild instead of being dropped.
let rebuildPending = false;

const stripAt = (s: string) => s.replace(/^@+/, "");

function docHasTag(doc: IndexDoc, tag: string): boolean {
	return ` ${doc.tags.toLowerCase()} `.includes(` ${tag} `);
}

function toFinderItem(doc: IndexDoc, terms: string[]): FinderItem {
	return {
		key: doc.id,
		type: doc.type === "note" ? "note" : "document",
		title: doc.title,
		projectAlias: doc.projectAlias,
		path: doc.id,
		updated: doc.updated,
		snippets: doc.body ? [buildSnippet(doc.body, terms)] : [],
		matchCount: terms.length,
		noteId: doc.noteId || undefined,
	};
}

export const useSearchIndexStore = create<SearchIndexState>((set, get) => ({
	status: "idle",
	index: null,
	docsById: new Map(),

	build: async () => {
		if (get().status === "building") {
			// A rebuild fired mid-build — coalesce it so the latest vault state is
			// picked up once the current build finishes, rather than being dropped.
			rebuildPending = true;
			return;
		}
		set({ status: "building" });
		rebuildPending = false;
		try {
			const records = (await ExportIndex()) ?? [];
			const index = createMiniSearch();
			const docsById = new Map<string, IndexDoc>();
			for (const rec of records) docsById.set(rec.id, rec);
			index.addAll(records);
			set({ index, docsById, status: "ready" });
		} catch (err) {
			BackendLogger.error("[searchIndex] build failed:", err);
			set({ status: "error" });
		} finally {
			if (rebuildPending) {
				void get().build();
			}
		}
	},

	scheduleRebuild: () => {
		if (rebuildTimer) clearTimeout(rebuildTimer);
		rebuildTimer = setTimeout(() => {
			rebuildTimer = null;
			void get().build();
		}, REBUILD_DEBOUNCE_MS);
	},

	search: (query) => {
		const { index, docsById } = get();
		if (!index) return [];

		const { text, projects, tags, phrases, excludes } = parseQuery(query);
		const hasText = text.trim().length > 0;
		const hasPhrases = phrases.length > 0;
		const hasFilters = projects.length > 0 || tags.length > 0;
		if (!hasText && !hasPhrases && !hasFilters) return [];

		const docText = (doc: IndexDoc): string => `${doc.title ?? ""}\n${doc.body ?? ""}`.toLowerCase();

		const passesFilters = (doc: IndexDoc): boolean => {
			if (projects.length && !projects.includes(stripAt(doc.projectAlias).toLowerCase())) return false;
			if (tags.length && !tags.every((t) => docHasTag(doc, t))) return false;
			// Quoted phrases must appear verbatim; -excluded terms must not appear.
			if (phrases.length || excludes.length) {
				const dt = docText(doc);
				if (phrases.length && !phrases.every((p) => dt.includes(p.toLowerCase()))) return false;
				if (excludes.length && excludes.some((e) => dt.includes(e.toLowerCase()))) return false;
			}
			return true;
		};

		const items: FinderItem[] = [];

		if (hasText) {
			// MiniSearch returns all matches ranked by score (best first); filter
			// and cap afterwards so a project:/tag: filter never starves the list.
			for (const r of index.search(text)) {
				const doc = docsById.get(r.id as string);
				if (!doc || !passesFilters(doc)) continue;
				items.push(toFinderItem(doc, r.terms));
				if (items.length >= SEARCH_LIMIT) break;
			}
		} else {
			// Phrase-only (e.g. "exact phrase") or filter-only (e.g. "project:@work")
			// browse: newest first. Highlight phrases in the snippet when present.
			const matches = [...docsById.values()].filter(passesFilters);
			matches.sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));
			for (const doc of matches.slice(0, SEARCH_LIMIT)) items.push(toFinderItem(doc, phrases));
		}

		return items;
	},
}));
