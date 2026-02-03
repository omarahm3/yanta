import type React from "react";
import { createContext, type ReactNode, useContext } from "react";
import { type UseUserProgressReturn, useUserProgress } from "../hooks/useUserProgress";

const UserProgressContext = createContext<UseUserProgressReturn | null>(null);

interface UserProgressProviderProps {
	children: ReactNode;
}

export const UserProgressProvider: React.FC<UserProgressProviderProps> = ({ children }) => {
	const progress = useUserProgress();

	return <UserProgressContext.Provider value={progress}>{children}</UserProgressContext.Provider>;
};

export const useUserProgressContext = (): UseUserProgressReturn => {
	const context = useContext(UserProgressContext);
	if (!context) {
		throw new Error("useUserProgressContext must be used within a UserProgressProvider");
	}
	return context;
};
