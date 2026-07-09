import { renderHook } from "@testing-library/react";
import { Events } from "@wailsio/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../../../shared/types";
import { useOpenJournalFromCapture } from "../useOpenJournalFromCapture";

vi.mock("@wailsio/runtime", () => ({
	Events: { On: vi.fn(() => () => {}) },
}));

const PROJECTS = [
	{ id: "1", alias: "@work", name: "Work" },
	{ id: "2", alias: "personal", name: "Personal" },
] as unknown as Project[];

/** Grab the callback registered with Events.On so we can fire the event. */
function getListener() {
	const onMock = Events.On as unknown as ReturnType<typeof vi.fn>;
	return onMock.mock.calls.at(-1)?.[1] as (event: {
		data?: { projectAlias?: string; date?: string };
	}) => void;
}

describe("useOpenJournalFromCapture", () => {
	beforeEach(() => vi.clearAllMocks());

	it("selects the matching project (alias normalized) and navigates to its journal date", () => {
		const onNavigate = vi.fn();
		const setCurrentProject = vi.fn();

		renderHook(() =>
			useOpenJournalFromCapture({ onNavigate, projects: PROJECTS, setCurrentProject }),
		);

		// Event carries a leading-@ alias; the store project has no @ — must still match.
		getListener()({ data: { projectAlias: "@personal", date: "2026-07-09" } });

		expect(setCurrentProject).toHaveBeenCalledWith(PROJECTS[1]);
		expect(onNavigate).toHaveBeenCalledWith("journal", { date: "2026-07-09" });
	});

	it("navigates without a date when none is provided and skips unknown projects", () => {
		const onNavigate = vi.fn();
		const setCurrentProject = vi.fn();

		renderHook(() =>
			useOpenJournalFromCapture({ onNavigate, projects: PROJECTS, setCurrentProject }),
		);

		getListener()({ data: { projectAlias: "@ghost" } });

		expect(setCurrentProject).not.toHaveBeenCalled();
		expect(onNavigate).toHaveBeenCalledWith("journal", undefined);
	});

	it("unsubscribes on unmount", () => {
		const unsub = vi.fn();
		(Events.On as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(unsub);

		const { unmount } = renderHook(() =>
			useOpenJournalFromCapture({
				onNavigate: vi.fn(),
				projects: PROJECTS,
				setCurrentProject: vi.fn(),
			}),
		);
		unmount();

		expect(unsub).toHaveBeenCalled();
	});
});
