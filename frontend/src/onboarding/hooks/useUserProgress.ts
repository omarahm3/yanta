/**
 * User progress is now in shared/stores/progress.store (Zustand + persist).
 * Re-export as useUserProgress for backward compatibility.
 */
export {
	type UserProgressData,
	type UseUserProgressReturn,
	useUserProgressContext as useUserProgress,
} from "../../shared/stores/progress.store";
