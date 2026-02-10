import { useState } from "react";

export interface ConfirmDialogState {
	isOpen: boolean;
	title: string;
	message: string;
	onConfirm: () => void;
	danger?: boolean;
}

const initialConfirm: ConfirmDialogState = {
	isOpen: false,
	title: "",
	message: "",
	onConfirm: () => {},
};

export interface UseJournalDialogsResult {
	confirmDialog: ConfirmDialogState;
	setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
}

export function useJournalDialogs(): UseJournalDialogsResult {
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(initialConfirm);

	return {
		confirmDialog,
		setConfirmDialog,
	};
}
