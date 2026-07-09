import { describe, expect, it, vi } from "vitest";
import type { CommandRegistry, CommandRegistryContext } from "../../types";
import { registerApplicationCommands } from "../applicationCommands";

const createMockRegistry = (): CommandRegistry => ({
	setCommands: vi.fn(),
	removeSource: vi.fn(),
	getAllCommands: vi.fn(() => []),
});

const createMockCtx = (overrides?: Partial<CommandRegistryContext>): CommandRegistryContext => ({
	onNavigate: vi.fn(),
	handleClose: vi.fn(),
	currentPage: "dashboard",
	currentProject: null,
	previousProject: null,
	projects: [],
	setCurrentProject: vi.fn(),
	switchToLastProject: vi.fn(),
	getSelectedDocument: vi.fn(() => null),
	notification: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	},
	showGitError: vi.fn(),
	resetLayout: vi.fn(),
	setShowRecentDocuments: vi.fn(),
	...overrides,
});

describe("registerApplicationCommands", () => {
	it("registers a Quick Capture command that navigates to quick-capture", () => {
		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const setCommandsCalls = (registry.setCommands as ReturnType<typeof vi.fn>).mock.calls;
		const appCommands = setCommandsCalls.find(
			(call: unknown[]) => call[0] === "application",
		)?.[1] as Array<{ id: string; action: () => void }>;

		expect(appCommands).toBeDefined();
		const qcCommand = appCommands.find((cmd) => cmd.id === "open-quick-capture");
		expect(qcCommand).toBeDefined();

		qcCommand?.action();

		expect(ctx.onNavigate).toHaveBeenCalledWith("quick-capture");
		expect(ctx.handleClose).toHaveBeenCalled();
	});
});
