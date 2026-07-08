import { useCallback, useRef, useState } from "react";
import { useSaveErrorStore } from "../../shared/stores/saveError.store";
import type { NavigationState, PageName } from "../../shared/types";
import { ConfirmDialog } from "../../shared/ui";

interface UseNavGuardReturn {
	guardedNavigate: (page: PageName, state?: NavigationState) => void;
	showNavGuardDialog: boolean;
	pendingNavigation: { page: PageName; state?: NavigationState } | null;
	confirmNavigation: () => void;
	cancelNavigation: () => void;
}

export function useNavGuard(
	originalNavigate: (page: PageName, state?: NavigationState) => void,
): UseNavGuardReturn {
	const [showDialog, setShowDialog] = useState(false);
	const pendingNavRef = useRef<{ page: PageName; state?: NavigationState } | null>(null);

	const guardedNavigate = useCallback(
		(page: PageName, state?: NavigationState) => {
			const hasDirtyError = useSaveErrorStore.getState().hasDirtyError;
			if (hasDirtyError) {
				pendingNavRef.current = { page, state };
				setShowDialog(true);
				return;
			}
			originalNavigate(page, state);
		},
		[originalNavigate],
	);

	const confirmNavigation = useCallback(() => {
		setShowDialog(false);
		if (pendingNavRef.current) {
			originalNavigate(pendingNavRef.current.page, pendingNavRef.current.state);
			pendingNavRef.current = null;
		}
	}, [originalNavigate]);

	const cancelNavigation = useCallback(() => {
		setShowDialog(false);
		pendingNavRef.current = null;
	}, []);

	return {
		guardedNavigate,
		showNavGuardDialog: showDialog,
		pendingNavigation: pendingNavRef.current,
		confirmNavigation,
		cancelNavigation,
	};
}

export function NavGuardDialog({
	isOpen,
	onConfirm,
	onCancel,
}: {
	isOpen: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<ConfirmDialog
			isOpen={isOpen}
			title="Unsaved changes with errors"
			message="You have unsaved changes that failed to save. Navigating away will discard these changes. Are you sure you want to proceed?"
			confirmText="Discard & Navigate"
			cancelText="Stay & Review"
			onConfirm={onConfirm}
			onCancel={onCancel}
			danger
		/>
	);
}
