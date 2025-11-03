import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { DialogProvider, HotkeyProvider, useHotkeyContext } from "../contexts";
import type { HotkeyContextValue } from "../types/hotkeys";

const mockSuccess = vi.fn();
const mockError = vi.fn();
const setCurrentProject = vi.fn();
const loadProjects = vi.fn();

const projects = [
	{ id: "1", name: "Alpha", alias: "alpha" },
	{ id: "2", name: "Beta", alias: "beta" },
];
const archivedProjects = [{ id: "3", name: "Gamma", alias: "gamma" }];

vi.mock("../hooks/useNotification", () => ({
	useNotification: () => ({
		success: mockSuccess,
		error: mockError,
	}),
}));

vi.mock("../hooks/useHelp", () => ({
	useHelp: () => ({ setPageContext: vi.fn() }),
}));

vi.mock("../hooks/useSidebarSections", () => ({
	__esModule: true,
	useSidebarSections: () => [],
}));

vi.mock("../contexts", async () => {
	const actual = await vi.importActual<typeof import("../contexts")>("../contexts");
	return {
		...actual,
		useProjectContext: () => ({
			currentProject: projects[0],
			setCurrentProject,
			projects,
			archivedProjects,
			loadProjects,
			isLoading: false,
		}),
	};
});

vi.mock("../components/Layout", () => {
	const Layout = ({ children, commandInputRef, commandValue, onCommandChange }: any) => (
		<div>
			<input
				data-testid="command-input"
				ref={commandInputRef}
				value={commandValue}
				onChange={(e) => onCommandChange?.(e.target.value)}
			/>
			{children}
		</div>
	);
	return { __esModule: true, Layout };
});

vi.mock("../components/ui", () => ({
	__esModule: true,
	Table: ({ selectedRowId }: { selectedRowId: string }) => (
		<div data-testid="selected-project">{selectedRowId}</div>
	),
}));

import { Projects } from "../pages/Projects";

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
					<HotkeyProbe onReady={(value) => (ctx = value)} />
					<Projects />
				</HotkeyProvider>
			</DialogProvider>,
		);
		await waitFor(() => expect(ctx).not.toBeNull());
		return ctx!;
	};

	const getHotkey = (ctx: HotkeyContextValue, key: string) => {
		const hotkey = ctx.getRegisteredHotkeys().find((h) => h.key === key);
		expect(hotkey).toBeDefined();
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
		expect(mockSuccess).toHaveBeenCalledWith("Switched to Alpha");
	});

	it("queues project commands", async () => {
		const ctx = await renderProjects();
		const input = screen.getByTestId("command-input") as HTMLInputElement;

		const combos: [string, string][] = [
			["mod+N", "new "],
			["mod+A", "archive "],
			["mod+U", "unarchive "],
			["mod+R", "rename alpha "],
			["mod+D", "delete alpha"],
		];

		for (const [key, expected] of combos) {
			const hotkey = getHotkey(ctx, key);

			vi.useFakeTimers();
			await act(async () => {
				hotkey.handler(
					new KeyboardEvent("keydown", {
						key: key.includes("mod") ? key.split("+")[1].toLowerCase() : key,
						ctrlKey: key.includes("mod"),
					}),
				);
			});

			// Run timers and check synchronously
			act(() => {
				vi.runAllTimers();
			});
			vi.useRealTimers();

			// Check value after timers have run
			expect(input.value).toBe(expected);
		}
	});
});
