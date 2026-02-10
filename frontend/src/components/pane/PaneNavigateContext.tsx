import { createContext, useContext } from "react";
import type { NavigationState, PageName } from "../../types";

export type PaneNavigateHandler = (page: PageName, state?: NavigationState) => void;

const PaneNavigateContext = createContext<PaneNavigateHandler | null>(null);

export const usePaneNavigateContext = (): PaneNavigateHandler | null =>
	useContext(PaneNavigateContext);

export const PaneNavigateProvider = PaneNavigateContext.Provider;
