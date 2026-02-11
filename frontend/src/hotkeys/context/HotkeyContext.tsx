import type React from "react";
import { createContext, type ReactNode, useContext } from "react";
import type { HotkeyContextValue } from "../../types/hotkeys";
import { useHotkeyProviderValue } from "./useHotkeyProviderValue";

const HotkeyContext = createContext<HotkeyContextValue | null>(null);

interface HotkeyProviderProps {
	children: ReactNode;
}

export const HotkeyProvider: React.FC<HotkeyProviderProps> = ({ children }) => {
	const value = useHotkeyProviderValue();
	return <HotkeyContext.Provider value={value}>{children}</HotkeyContext.Provider>;
};

export const useHotkeyContext = (): HotkeyContextValue => {
	const context = useContext(HotkeyContext);
	if (!context) {
		throw new Error("useHotkeyContext must be used within a HotkeyProvider");
	}
	return context;
};
