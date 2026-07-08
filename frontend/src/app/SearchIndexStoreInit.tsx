import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { useSearchIndexStore } from "../search-index/searchIndex.store";

/**
 * Vault-mutation events after which the client search index should be rebuilt.
 * `yanta/vault/reindexed` fires after a git-sync pull or a manual reindex so the
 * index stays fresh across devices (see the backend indexer/sync paths).
 */
const VAULT_CHANGE_EVENTS = [
	"yanta/entry/created",
	"yanta/entry/updated",
	"yanta/entry/deleted",
	"yanta/entry/restored",
	"yanta/entry/moved",
	"yanta/entry/external-change",
	"yanta/vault/reindexed",
];

/**
 * Builds the client-side full-text search index once on boot and keeps it fresh
 * by rebuilding (debounced) whenever the vault changes. Mounted inside
 * AppProviders, so it never runs in the stripped-down quick-capture window.
 */
export function SearchIndexStoreInit() {
	useEffect(() => {
		void useSearchIndexStore.getState().build();
	}, []);

	useEffect(() => {
		const schedule = () => useSearchIndexStore.getState().scheduleRebuild();
		const unsubscribers = VAULT_CHANGE_EVENTS.map((name) => Events.On(name, schedule));
		return () => {
			for (const unsub of unsubscribers) unsub?.();
		};
	}, []);

	return null;
}
