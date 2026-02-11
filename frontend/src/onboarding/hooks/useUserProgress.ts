/**
 * User progress is now in shared/stores/progress.store (Zustand + persist).
 * Re-export as useUserProgress for backward compatibility.
 */
export {
	useUserProgressContext as useUserProgress,
	type UserProgressData,
	type UseUserProgressReturn,
} from "../../shared/stores/progress.store";
