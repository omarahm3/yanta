// TODO: redundant with MoveDocumentDialog in dashboard domain, remove
// Backward compatibility shim - re-export from dashboard domain
export {
	type ConfirmDialogState,
	type DashboardControllerOptions,
	type DashboardControllerResult,
	type MoveDialogState,
	useDashboardController,
} from "../../dashboard/hooks/useDashboardController";
