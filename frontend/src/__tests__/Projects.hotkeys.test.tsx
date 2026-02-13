import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { DialogProvider } from "../app/context";
import { HotkeyProvider, useHotkeyContext } from "../hotkeys";
import type { HotkeyContextValue } from "../shared/types/hotkeys";

const mockSuccess = vi.fn();
const mockError = vi.fn();
const setCurrentProject = vi.fn();
const loadProjects = vi.fn();

const projects = [
	{ id: "1", name: "Alpha", alias: "alpha" },
	{ id: "2", name: "Beta", alias: "beta" },
];
const archivedProjects = [{ id: "3", name: "Gamma", alias: "gamma" }];

vi.mock("../shared/hooks/useNotification", () => ({
	useNotification: () => ({
		success: mockSuccess,
		error: mockError,
	}),
}));

vi.mock("../help", () => ({
	useHelp: () => ({ setPageContext: vi.fn() }),
}));

vi.mock("../shared/hooks/useSidebarSections", () => ({
	__esModule: true,
	useSidebarSections: () => [],
}));

// Mock the context module directly (not the barrel) because ProjectsPage
// imports useProjectContext from "./context", not from the barrel.
vi.mock("../project/context", () => ({
	useProjectContext: () => ({
		currentProject: projects[0],
		setCurrentProject,
		projects,
		archivedProjects,
		loadProjects,
		isLoading: false,
	}),
}));

vi.mock("../app", () => ({
	Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../shared/ui", () => ({
	__esModule: true,
	Table: ({ selectedRowId }: { selectedRowId: string }) => (
		<div data-testid="selected-project">{selectedRowId}</div>
	),
}));

import { Projects } from "../project";

const HotkeyProbe: React.FC<{ onReady: (ctx: HotkeyContextValue) => void }> = ({ onReady }) => {
	const ctx = useHotkeyContext();
	React.useEffect(() => {
		onReady(ctx);
	}, [ctx, onReady]);
	return null;
};

describe("Projects hotkeys", () => {
	beforeEach(() => {
		mockSuccess.mockClear();
		mockError.mockClear();
		setCurrentProject.mockClear();
		loadProjects.mockClear();
	});

	const renderProjects = async () => {
		let ctx: HotkeyContextValue | null = null;
		render(
			<DialogProvider>
				<HotkeyProvider>
					{/* biome-ignore lint/suspicious/noAssignInExpressions: Test callback pattern */}
					<HotkeyProbe onReady={(value) => (ctx = value)} />
					<Projects />
				</HotkeyProvider>
			</DialogProvider>,
		);
		await waitFor(() => expect(ctx).not.toBeNull());
		// biome-ignore lint/style/noNonNullAssertion: Test utility function ensures non-null
		return ctx!;
	};

	const getHotkey = (ctx: HotkeyContextValue, key: string) => {
		const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === key);
		expect(hotkey).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: Test utility function ensures non-null
		return hotkey!;
	};

	it("navigates selection with j/k", async () => {
		const ctx = await renderProjects();
		const jHotkey = getHotkey(ctx, "j");
		const kHotkey = getHotkey(ctx, "k");

		await act(async () => {
			jHotkey.handler(new KeyboardEvent("keydown", { key: "j" }));
		});
		await waitFor(() => expect(screen.getAllByTestId("selected-project")[0].textContent).toBe("2"));

		await act(async () => {
			kHotkey.handler(new KeyboardEvent("keydown", { key: "k" }));
		});
		await waitFor(() => expect(screen.getAllByTestId("selected-project")[0].textContent).toBe("1"));
	});

	it("navigates selection with arrow keys", async () => {
		const ctx = await renderProjects();
		const downHotkey = getHotkey(ctx, "ArrowDown");
		const upHotkey = getHotkey(ctx, "ArrowUp");

		await act(async () => {
			downHotkey.handler(new KeyboardEvent("keydown", { key: "ArrowDown" }));
		});
		await waitFor(() => expect(screen.getAllByTestId("selected-project")[0].textContent).toBe("2"));

		await act(async () => {
			upHotkey.handler(new KeyboardEvent("keydown", { key: "ArrowUp" }));
		});
		await waitFor(() => expect(screen.getAllByTestId("selected-project")[0].textContent).toBe("1"));
	});

	it("selects project with Enter", async () => {
		const ctx = await renderProjects();
		const enterHotkey = getHotkey(ctx, "Enter");
		await act(async () => {
			enterHotkey.handler(new KeyboardEvent("keydown", { key: "Enter" }));
		});
		expect(setCurrentProject).toHaveBeenCalledWith(
			expect.objectContaining({ id: "1", name: "Alpha" }),
		);
	});

	it("registers project command hotkeys", async () => {
		const ctx = await renderProjects();

		// Verify project command hotkeys are registered
		const keys = ctx.getRegisteredHotkeys().map((h) => h.key);
		expect(keys).toContain("mod+N");
		expect(keys).toContain("mod+A");
		expect(keys).toContain("mod+U");
		expect(keys).toContain("mod+D");
	});
});
