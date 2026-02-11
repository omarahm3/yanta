/**
 * Recent documents is now in shared/stores/recentDocuments.store (Zustand + persist).
 * Re-export so existing imports keep working.
 */
export {
	type RecentDocument,
	type UseRecentDocumentsReturn,
	useRecentDocuments,
} from "../shared/stores/recentDocuments.store";
