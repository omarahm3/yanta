import { create } from "zustand";

/**
 * A one-shot request to open a project-management dialog on the Projects page.
 * Lets the command palette (which lives outside the page) trigger the New /
 * Rename dialogs after navigating to Projects.
 */
export type ProjectManageRequest = { type: "new" } | { type: "rename"; projectId: string } | null;

interface ProjectManageStore {
	request: ProjectManageRequest;
	requestNew: () => void;
	requestRename: (projectId: string) => void;
	/** Read and clear the pending request. */
	consume: () => ProjectManageRequest;
}

export const useProjectManageStore = create<ProjectManageStore>((set, get) => ({
	request: null,
	requestNew: () => set({ request: { type: "new" } }),
	requestRename: (projectId) => set({ request: { type: "rename", projectId } }),
	consume: () => {
		const { request } = get();
		if (request) set({ request: null });
		return request;
	},
}));
