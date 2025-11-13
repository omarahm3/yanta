import React, { createContext, type ReactNode, useCallback, useState } from "react";

interface TitleBarContextType {
	heightInRem: number;
	setHeight: (height: number) => void;
}

const TitleBarContext = createContext<TitleBarContextType | undefined>(undefined);

interface TitleBarProviderProps {
	children: ReactNode;
}

export const TitleBarProvider: React.FC<TitleBarProviderProps> = ({ children }) => {
	const [heightInRem, setHeightInRem] = useState(2);

	const setHeight = useCallback((height: number) => {
		setHeightInRem(height);
	}, []);

	const value: TitleBarContextType = {
		heightInRem,
		setHeight,
	};

	return <TitleBarContext.Provider value={value}>{children}</TitleBarContext.Provider>;
};

export const useTitleBarContext = (): TitleBarContextType => {
	const context = React.useContext(TitleBarContext);
	if (context === undefined) {
		throw new Error("useTitleBarContext must be used within a TitleBarProvider");
	}
	return context;
};
