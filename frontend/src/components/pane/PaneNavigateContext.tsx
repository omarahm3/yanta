import type React from "react";
import { createContext, useContext } from "react";
import type { NavigationState } from "../../types";

export type PaneNavigateHandler = (page: string, state?: NavigationState) => void;

const PaneNavigateContext = createContext<PaneNavigateHandler | null>(null);

export const usePaneNavigateContext = (): PaneNavigateHandler | null =>
	useContext(PaneNavigateContext);

export const PaneNavigateProvider = PaneNavigateContext.Provider;
