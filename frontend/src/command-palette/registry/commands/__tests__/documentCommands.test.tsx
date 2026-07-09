import { describe, expect, it, vi } from "vitest";
import { useDocumentCommandStore } from "../../../../shared/stores/documentCommand.store";
import type { CommandRegistry, CommandRegistryContext } from "../../types";
import { registerDocumentCommands } from "../documentCommands";

vi.mock("../../../../../bindings/yanta/internal/document/service", () => ({
	ExportDocument: vi.fn(),
	SoftDelete: vi.fn().mockResolvedValue(undefined),
	Restore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../bindings/yanta/internal/document/models", () => ({
	ExportDocumentRequest: vi.fn(),
}));

vi.mock("../../../../../bindings/yanta/internal/export", () => ({
	ExportRequest: vi.fn(),
}));

vi.mock("../../../../../bindings/yanta/internal/export/service", () => ({
	ExportToPDF: vi.fn(),
}));

vi.mock("../../../../../bindings/yanta/internal/system/service", () => ({
	OpenDirectoryDialog: vi.fn(),
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
	return calls.find((call: unknown[]) => call[0] === "document")?.[1] as Array<{
		id: string;
		action: () => void | Promise<void>;
	}>;
};

describe("registerDocumentCommands", () => {
	describe("context gating", () => {
		it("does not register any commands when not on document page", () => {
			const registry = createMockRegistry();
			const ctx = createMockCtx({
				currentPage: "dashboard",
				getSelectedDocument: () => ({ path: "some/path.json" }),
			});

			registerDocumentCommands(registry, ctx);

			const commands = getCommands(registry);
			expect(commands).toEqual([]);
		});

		it("does not register any commands when on document page but no document selected", () => {
			const registry = createMockRegistry();
			const ctx = createMockCtx({
				currentPage: "document",
				getSelectedDocument: () => null,
			});

			registerDocumentCommands(registry, ctx);

			const commands = getCommands(registry);
			expect(commands).toEqual([]);
		});

		it("registers all document commands when on document page with a document selected", () => {
			const registry = createMockRegistry();
			const ctx = createMockCtx({
				currentPage: "document",
				getSelectedDocument: () => ({ path: "some/path.json" }),
			});

			registerDocumentCommands(registry, ctx);

			const commands = getCommands(registry);
			const ids = commands.map((c) => c.id);
			expect(ids).toContain("save-document");
			expect(ids).toContain("find-in-document");
			expect(ids).toContain("archive-document");
			expect(ids).toContain("restore-document");
			expect(ids).toContain("export-document");
			expect(ids).toContain("export-document-pdf");
		});
	});

	describe("find-in-document", () => {
		it("calls requestFind on the document command store", () => {
			const requestFind = vi.fn();
			vi.spyOn(useDocumentCommandStore, "getState").mockReturnValue({
				requestFind,
			} as unknown as ReturnType<typeof useDocumentCommandStore.getState>);

			const registry = createMockRegistry();
			const ctx = createMockCtx({
				currentPage: "document",
				getSelectedDocument: () => ({ path: "some/path.json" }),
			});

			registerDocumentCommands(registry, ctx);

			const commands = getCommands(registry);
			const findCommand = commands.find((cmd) => cmd.id === "find-in-document");
			expect(findCommand).toBeDefined();

			findCommand?.action();

			expect(requestFind).toHaveBeenCalled();
			expect(ctx.handleClose).toHaveBeenCalled();
		});
	});

	describe("archive-document", () => {
		it("calls SoftDelete with the current document path", async () => {
			const { SoftDelete } = await import("../../../../../bindings/yanta/internal/document/service");

			const registry = createMockRegistry();
			const ctx = createMockCtx({
				currentPage: "document",
				getSelectedDocument: () => ({ path: "docs/test.json" }),
			});

			registerDocumentCommands(registry, ctx);

			const commands = getCommands(registry);
			const archiveCommand = commands.find((cmd) => cmd.id === "archive-document");
			expect(archiveCommand).toBeDefined();

			await archiveCommand?.action();

			expect(SoftDelete).toHaveBeenCalledWith("docs/test.json");
			expect(ctx.notification.success).toHaveBeenCalledWith("Document archived");
			// Leave the archived document's editor so it can't keep being edited.
			expect(ctx.onNavigate).toHaveBeenCalledWith("dashboard");
		});
	});

	describe("restore-document", () => {
		it("routes through the controller's requestRestore handler, not the backend directly", async () => {
			const { Restore } = await import("../../../../../bindings/yanta/internal/document/service");
			const requestRestore = vi.fn();
			vi.spyOn(useDocumentCommandStore, "getState").mockReturnValue({
				requestRestore,
			} as unknown as ReturnType<typeof useDocumentCommandStore.getState>);

			const registry = createMockRegistry();
			const ctx = createMockCtx({
				currentPage: "document",
				getSelectedDocument: () => ({ path: "docs/test.json" }),
			});

			registerDocumentCommands(registry, ctx);

			const commands = getCommands(registry);
			const restoreCommand = commands.find((cmd) => cmd.id === "restore-document");
			expect(restoreCommand).toBeDefined();

			restoreCommand?.action();

			expect(requestRestore).toHaveBeenCalled();
			// Backend Restore must not be called directly — it would bypass the
			// controller's hasRestored state and leave the archived banner stuck.
			expect(Restore).not.toHaveBeenCalled();
			expect(ctx.handleClose).toHaveBeenCalled();
		});
	});
});
