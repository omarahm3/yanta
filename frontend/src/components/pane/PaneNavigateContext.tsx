import type React from "react";
import { createContext, useContext } from "react";

export type PaneNavigateHandler = (
	page: string,
	state?: Record<string, string | number | boolean | undefined>,
) => void;

const PaneNavigateContext = createContext<PaneNavigateHandler | null>(null);

export const usePaneNavigateContext = (): PaneNavigateHandler | null =>
	useContext(PaneNavigateContext);

export const PaneNavigateProvider = PaneNavigateContext.Provider;
