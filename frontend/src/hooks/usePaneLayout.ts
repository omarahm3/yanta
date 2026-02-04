import { useContext } from "react";
import { PaneLayoutContext, type PaneLayoutContextValue } from "../contexts/PaneLayoutContext";

export const usePaneLayout = (): PaneLayoutContextValue => {
	const context = useContext(PaneLayoutContext);
	if (!context) {
		throw new Error("usePaneLayout must be used within a PaneLayoutProvider");
	}
	return context;
};
