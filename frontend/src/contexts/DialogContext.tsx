import type React from "react";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

interface DialogContextValue {
	isDialogOpen: boolean;
	openDialog: () => void;
	closeDialog: () => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

interface DialogProviderProps {
	children: ReactNode;
}

export const DialogProvider: React.FC<DialogProviderProps> = ({ children }) => {
	const [openCount, setOpenCount] = useState(0);

	const openDialog = useCallback(() => {
		setOpenCount((c) => c + 1);
	}, []);

	const closeDialog = useCallback(() => {
		setOpenCount((c) => Math.max(0, c - 1));
	}, []);

	const isDialogOpen = openCount > 0;

	const value: DialogContextValue = {
		isDialogOpen,
		openDialog,
		closeDialog,
	};

	return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

export const useDialog = (): DialogContextValue => {
	const context = useContext(DialogContext);
	if (!context) {
		throw new Error("useDialog must be used within a DialogProvider");
	}
	return context;
};
