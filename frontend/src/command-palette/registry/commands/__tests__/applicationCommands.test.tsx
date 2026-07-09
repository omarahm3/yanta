import { describe, expect, it, vi } from "vitest";
import { useGlobalSearchStore } from "../../../../global-search/globalSearch.store";
import { useSearchIndexStore } from "../../../../search-index/searchIndex.store";
import { usePreferencesStore } from "../../../../shared/stores/preferences.store";
import { useScaleStore } from "../../../../shared/stores/scale.store";
import type { CommandRegistry, CommandRegistryContext } from "../../types";
import { registerApplicationCommands } from "../applicationCommands";

vi.mock("../../../../global-search/globalSearch.store", () => ({
	useGlobalSearchStore: { getState: vi.fn() },
}));

vi.mock("../../../../search-index/searchIndex.store", () => ({
	useSearchIndexStore: { getState: vi.fn() },
}));

vi.mock("../../../../shared/stores/preferences.store", () => ({
	usePreferencesStore: { getState: vi.fn() },
}));

vi.mock("../../../../shared/stores/scale.store", () => ({
	useScaleStore: { getState: vi.fn() },
}));

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
	...overrides,
});

const getCommands = (registry: CommandRegistry) => {
	const calls = (registry.setCommands as ReturnType<typeof vi.fn>).mock.calls;
	return calls.find((call: unknown[]) => call[0] === "application")?.[1] as Array<{
		id: string;
		action: () => void | Promise<void>;
	}>;
};

describe("registerApplicationCommands", () => {
	it("registers a Quick Capture command that navigates to quick-capture", () => {
		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		expect(appCommands).toBeDefined();
		const qcCommand = appCommands.find((cmd) => cmd.id === "open-quick-capture");
		expect(qcCommand).toBeDefined();

		qcCommand?.action();

		expect(ctx.onNavigate).toHaveBeenCalledWith("quick-capture");
		expect(ctx.handleClose).toHaveBeenCalled();
	});

	it("registers open-finder that opens global search", () => {
		const openMock = vi.fn();
		vi.mocked(useGlobalSearchStore.getState).mockReturnValue({
			open: openMock,
			close: vi.fn(),
			toggle: vi.fn(),
			reset: vi.fn(),
			isOpen: false,
		} as unknown as ReturnType<typeof useGlobalSearchStore.getState>);

		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		const finderCommand = appCommands.find((cmd) => cmd.id === "open-finder");
		expect(finderCommand).toBeDefined();

		finderCommand?.action();

		expect(openMock).toHaveBeenCalled();
		expect(ctx.handleClose).toHaveBeenCalled();
	});

	it("registers rebuild-search-index that reports success when build succeeds", async () => {
		const buildMock = vi.fn().mockResolvedValue(undefined);
		vi.mocked(useSearchIndexStore.getState).mockReturnValue({
			build: buildMock,
			status: "ready",
		} as unknown as ReturnType<typeof useSearchIndexStore.getState>);

		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		const rebuildCommand = appCommands.find((cmd) => cmd.id === "rebuild-search-index");
		expect(rebuildCommand).toBeDefined();

		await rebuildCommand?.action();

		expect(buildMock).toHaveBeenCalled();
		expect(ctx.notification.success).toHaveBeenCalledWith("Search index rebuilt");
		expect(ctx.notification.error).not.toHaveBeenCalled();
	});

	it("rebuild-search-index reports error when build fails (build swallows the error)", async () => {
		// build() catches its own errors and reflects failure via store status
		// rather than throwing, so a try/catch here would never fire.
		const buildMock = vi.fn().mockResolvedValue(undefined);
		vi.mocked(useSearchIndexStore.getState).mockReturnValue({
			build: buildMock,
			status: "error",
		} as unknown as ReturnType<typeof useSearchIndexStore.getState>);

		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		const rebuildCommand = appCommands.find((cmd) => cmd.id === "rebuild-search-index");

		await rebuildCommand?.action();

		expect(buildMock).toHaveBeenCalled();
		expect(ctx.notification.error).toHaveBeenCalledWith("Failed to rebuild search index");
		expect(ctx.notification.success).not.toHaveBeenCalled();
	});

	it("registers toggle-theme that cycles dark → light → system", async () => {
		const saveMock = vi.fn().mockResolvedValue(undefined);
		vi.mocked(usePreferencesStore.getState).mockReturnValue({
			overrides: { appearance: { theme: "dark" } },
			saveOverrides: saveMock,
		} as unknown as ReturnType<typeof usePreferencesStore.getState>);

		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		const themeCommand = appCommands.find((cmd) => cmd.id === "toggle-theme");
		expect(themeCommand).toBeDefined();

		await themeCommand?.action();

		expect(saveMock).toHaveBeenCalledWith(
			expect.objectContaining({
				appearance: expect.objectContaining({ theme: "light" }),
			}),
		);
	});

	it("toggle-theme surfaces an error notification if persistence fails", async () => {
		const saveMock = vi.fn().mockRejectedValue(new Error("disk full"));
		vi.mocked(usePreferencesStore.getState).mockReturnValue({
			overrides: { appearance: { theme: "dark" } },
			saveOverrides: saveMock,
		} as unknown as ReturnType<typeof usePreferencesStore.getState>);

		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		const themeCommand = appCommands.find((cmd) => cmd.id === "toggle-theme");

		// Must not reject — a thrown saveOverrides would become an unhandled rejection.
		await expect(themeCommand?.action()).resolves.toBeUndefined();
		expect(ctx.notification.error).toHaveBeenCalledWith("Failed to change theme");
	});

	it("registers zoom-in that increases scale", () => {
		const setScaleMock = vi.fn();
		vi.mocked(useScaleStore.getState).mockReturnValue({
			scale: 1.0,
			setScale: setScaleMock,
		} as unknown as ReturnType<typeof useScaleStore.getState>);

		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		const zoomInCommand = appCommands.find((cmd) => cmd.id === "zoom-in");
		expect(zoomInCommand).toBeDefined();

		zoomInCommand?.action();

		expect(setScaleMock).toHaveBeenCalledWith(1.1);
	});

	it("registers zoom-out that decreases scale", () => {
		const setScaleMock = vi.fn();
		vi.mocked(useScaleStore.getState).mockReturnValue({
			scale: 1.0,
			setScale: setScaleMock,
		} as unknown as ReturnType<typeof useScaleStore.getState>);

		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		const zoomOutCommand = appCommands.find((cmd) => cmd.id === "zoom-out");
		expect(zoomOutCommand).toBeDefined();

		zoomOutCommand?.action();

		expect(setScaleMock).toHaveBeenCalledWith(0.9);
	});

	it("registers zoom-reset that sets scale to 1.0", () => {
		const setScaleMock = vi.fn();
		vi.mocked(useScaleStore.getState).mockReturnValue({
			scale: 1.5,
			setScale: setScaleMock,
		} as unknown as ReturnType<typeof useScaleStore.getState>);

		const registry = createMockRegistry();
		const ctx = createMockCtx();

		registerApplicationCommands(registry, ctx);

		const appCommands = getCommands(registry);
		const zoomResetCommand = appCommands.find((cmd) => cmd.id === "zoom-reset");
		expect(zoomResetCommand).toBeDefined();

		zoomResetCommand?.action();

		expect(setScaleMock).toHaveBeenCalledWith(1.0);
	});
});
