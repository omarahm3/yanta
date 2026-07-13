import { useState } from "react";

export interface ConfirmDialogState {
	isOpen: boolean;
	title: string;
	message: string;
	onConfirm: () => void;
	danger?: boolean;
}

export interface PromoteDialogState {
	isOpen: boolean;
	title: string;
	targetProject: string;
	keepOriginal: boolean;
}

const initialConfirm: ConfirmDialogState = {
	isOpen: false,
	title: "",
	message: "",
	onConfirm: () => {},
};

const initialPromote: PromoteDialogState = {
	isOpen: false,
	title: "Journal Notes",
	targetProject: "",
	keepOriginal: false,
};

export interface UseJournalDialogsResult {
	confirmDialog: ConfirmDialogState;
	setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
	promoteDialog: PromoteDialogState;
	setPromoteDialog: React.Dispatch<React.SetStateAction<PromoteDialogState>>;
}

export function useJournalDialogs(): UseJournalDialogsResult {
	const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(initialConfirm);
	const [promoteDialog, setPromoteDialog] = useState<PromoteDialogState>(initialPromote);

	return {
		confirmDialog,
		setConfirmDialog,
		promoteDialog,
		setPromoteDialog,
	};
}
