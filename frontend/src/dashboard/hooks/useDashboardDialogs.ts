import { useCallback, useState } from "react";

export interface ConfirmDialogState {
	isOpen: boolean;
	title: string;
	message: string;
	onConfirm: () => void;
	danger?: boolean;
	inputPrompt?: string;
	expectedInput?: string;
	showCheckbox?: boolean;
}

export interface MoveDialogState {
	isOpen: boolean;
	documentPaths: string[];
}

const initialConfirm: ConfirmDialogState = {
	isOpen: false,
	title: "",
	message: "",
	onConfirm: () => {},
};

const initialMove: MoveDialogState = {
	isOpen: false,
	documentPaths: [],
};

export interface UseDashboardDialogsResult {
	confirmDialog: ConfirmDialogState;
	setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
	moveDialog: MoveDialogState;
	setMoveDialog: React.Dispatch<React.SetStateAction<MoveDialogState>>;
	closeMoveDialog: () => void;
}

export function useDashboardDialogs(): UseDashboardDialogsResult {
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(initialConfirm);
	const [moveDialog, setMoveDialog] = useState<MoveDialogState>(initialMove);

	const closeMoveDialog = useCallback(() => {
		setMoveDialog({ isOpen: false, documentPaths: [] });
	}, []);

	return {
		confirmDialog,
		setConfirmDialog,
		moveDialog,
		setMoveDialog,
		closeMoveDialog,
	};
}
