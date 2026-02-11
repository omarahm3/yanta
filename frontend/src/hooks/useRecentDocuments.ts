/**
 * Recent documents is now in shared/stores/recentDocuments.store (Zustand + persist).
 * Re-export so existing imports keep working.
 */
export {
	useRecentDocuments,
	type RecentDocument,
	type UseRecentDocumentsReturn,
} from "../shared/stores/recentDocuments.store";
