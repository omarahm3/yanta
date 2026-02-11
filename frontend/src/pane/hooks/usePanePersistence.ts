/**
 * Pane persistence is now in shared/stores/paneLayout.store (Zustand + persist).
 * Re-export so existing imports keep working.
 */
export {
	clearLayoutForDocument,
	flushSaveLayout,
	loadLayoutForDocument,
	loadPaneLayout,
	saveLayoutForDocument,
	usePanePersistence,
} from "../../shared/stores/paneLayout.store";
