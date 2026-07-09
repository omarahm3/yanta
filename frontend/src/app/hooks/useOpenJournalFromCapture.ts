import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import type { Project } from "../../shared/types";
import type { NavigationState, PageName } from "../../shared/types/navigation";

/** Cross-window event emitted by the Quick Capture window's "Open" action. */
const NAVIGATE_JOURNAL_EVENT = "yanta/navigate/journal";

interface JournalNavigatePayload {
	projectAlias?: string;
	date?: string;
}

interface UseOpenJournalFromCaptureParams {
	onNavigate: (page: PageName, state?: NavigationState) => void;
	projects: Project[];
	setCurrentProject: (project: Project | undefined) => void;
}

const stripAt = (alias: string): string => alias.replace(/^@/, "");

/**
 * Listen for the "open journal" event the Quick Capture window emits after a
 * save. Quick Capture is a separate Wails webview and cannot drive the main
 * router directly, so it emits an app-wide event; here (in the main window) we
 * select the entry's project and navigate to its journal for that date.
 */
export function useOpenJournalFromCapture({
	onNavigate,
	projects,
	setCurrentProject,
}: UseOpenJournalFromCaptureParams): void {
	useEffect(() => {
		const unsubscribe = Events.On(
			NAVIGATE_JOURNAL_EVENT,
			(event: { data?: JournalNavigatePayload }) => {
				const { projectAlias, date } = event?.data ?? {};
				if (projectAlias) {
					const target = projects.find((p) => stripAt(p.alias) === stripAt(projectAlias));
					if (target) setCurrentProject(target);
				}
				onNavigate("journal", date ? { date } : undefined);
			},
		);
		return () => {
			if (typeof unsubscribe === "function") unsubscribe();
		};
	}, [onNavigate, projects, setCurrentProject]);
}
