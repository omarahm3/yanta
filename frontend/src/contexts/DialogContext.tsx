import type React from "react";
import { createContext, type ReactNode, useContext, useState } from "react";

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
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const openDialog = () => setIsDialogOpen(true);
	const closeDialog = () => setIsDialogOpen(false);

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
