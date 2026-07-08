import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DialogProvider } from "../app/context";
import { HotkeyProvider } from "../hotkeys";
import { useProjectManageStore } from "../project/projectManage.store";

const parse = vi.fn(() => Promise.resolve({ success: true, message: "", data: {} }));

vi.mock("../../bindings/yanta/internal/commandline/projectcommands", () => ({
	Parse: (cmd: string) => parse(cmd),
}));

vi.mock("../../bindings/yanta/internal/project/service", () => ({
	Create: vi.fn(() => Promise.resolve("new-id")),
	GetAllDocumentCounts: vi.fn(() => Promise.resolve({})),
	GetAllLastDocumentDates: vi.fn(() => Promise.resolve({})),
}));

const mockSuccess = vi.fn();
const mockError = vi.fn();
const setCurrentProject = vi.fn();
const loadProjects = vi.fn(() => Promise.resolve());

const projects = [
	{ id: "1", name: "Alpha", alias: "@alpha" },
	{ id: "2", name: "Beta", alias: "@beta" },
];
const archivedProjects = [{ id: "3", name: "Gamma", alias: "@gamma" }];
const projectContext = {
	currentProject: projects[0],
	setCurrentProject,
	projects,
	archivedProjects,
	loadProjects,
	isLoading: false,
};

vi.mock("../shared/hooks/useNotification", () => ({
	useNotification: () => ({ success: mockSuccess, error: mockError }),
}));
vi.mock("../help", () => ({ useHelp: () => ({ setPageContext: vi.fn() }) }));
vi.mock("../shared/hooks/useSidebarSections", () => ({
	__esModule: true,
	useSidebarSections: () => [],
}));
vi.mock("../project/context", () => ({ useProjectContext: () => projectContext }));
vi.mock("../app", () => ({
	Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { Projects } from "../project";

const renderProjects = () =>
	render(
		<DialogProvider>
			<HotkeyProvider>
				<Projects />
			</HotkeyProvider>
		</DialogProvider>,
	);

describe("Projects mouse actions", () => {
	beforeEach(() => {
		parse.mockClear();
		mockSuccess.mockClear();
		mockError.mockClear();
		setCurrentProject.mockClear();
		loadProjects.mockClear();
		useProjectManageStore.setState({ request: null });
		projectContext.projects = projects;
		projectContext.archivedProjects = archivedProjects;
		projectContext.isLoading = false;
	});

	it("opens the New Project dialog from the header button", () => {
		renderProjects();
		fireEvent.click(screen.getByRole("button", { name: "New project" }));
		expect(screen.getByText("New Project")).toBeInTheDocument();
	});

	it("renames a project through the row action, issuing a rename command", async () => {
		renderProjects();

		fireEvent.click(screen.getByRole("button", { name: "Rename Alpha" }));
		const input = await screen.findByLabelText(/Name/);
		expect(input).toHaveValue("Alpha");

		fireEvent.change(input, { target: { value: "Alpha Prime" } });
		fireEvent.click(screen.getByRole("button", { name: "Rename" }));

		await waitFor(() => expect(parse).toHaveBeenCalledWith("rename @alpha Alpha Prime"));
	});

	it("archives an active project through the row action", async () => {
		renderProjects();
		fireEvent.click(screen.getByRole("button", { name: "Archive Alpha" }));
		await waitFor(() => expect(parse).toHaveBeenCalledWith("archive @alpha"));
	});

	it("restores an archived project through the row action", async () => {
		renderProjects();
		fireEvent.click(screen.getByRole("button", { name: "Restore Gamma" }));
		await waitFor(() => expect(parse).toHaveBeenCalledWith("unarchive @gamma"));
	});

	it("opens the rename dialog when the palette requests it", async () => {
		renderProjects();
		useProjectManageStore.getState().requestRename("2");
		expect(await screen.findByDisplayValue("Beta")).toBeInTheDocument();
	});

	it("keeps a palette rename request pending until the project loads (no lost request)", () => {
		// Arrive from the palette while projects are still loading.
		projectContext.projects = [];
		projectContext.isLoading = true;
		useProjectManageStore.getState().requestRename("2");

		renderProjects();

		// The dialog isn't shown yet, and crucially the one-shot request is retained.
		expect(screen.queryByText("Rename Project")).not.toBeInTheDocument();
		expect(useProjectManageStore.getState().request).toEqual({
			type: "rename",
			projectId: "2",
		});
	});
});
