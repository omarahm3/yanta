import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentEditorForm } from "../DocumentEditorForm";

vi.mock("../../../editor/RichEditor", () => ({
	RichEditor: () => <div data-testid="rich-editor" />,
}));

vi.mock("../../../shared/hooks", () => ({
	useNotification: () => ({
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	}),
}));

vi.mock("../../../plugins/registry", () => ({
	disableExternalPluginsForEditorRecovery: vi.fn(),
	getActiveExternalPluginIds: () => [],
	hasActiveExternalPlugins: () => false,
}));

vi.mock("@/app", () => ({
	GranularErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("DocumentEditorForm - TagChip", () => {
	it("renders tags with × button for removal", () => {
		const onTagRemove = vi.fn();
		render(
			<DocumentEditorForm
				blocks={[]}
				tags={["urgent", "backend"]}
				isEditMode={true}
				isLoading={false}
				onTitleChange={vi.fn()}
				onBlocksChange={vi.fn()}
				onTagRemove={onTagRemove}
			/>,
		);

		expect(screen.getByText("urgent")).toBeInTheDocument();
		expect(screen.getByText("backend")).toBeInTheDocument();
		const removeButtons = screen.getAllByRole("button", { name: /remove/i });
		expect(removeButtons).toHaveLength(2);
	});

	it("clicking the tag label triggers filter/search (not removal)", () => {
		const onTagRemove = vi.fn();
		const onNavigate = vi.fn();
		render(
			<DocumentEditorForm
				blocks={[]}
				tags={["urgent"]}
				isEditMode={true}
				isLoading={false}
				onTitleChange={vi.fn()}
				onBlocksChange={vi.fn()}
				onTagRemove={onTagRemove}
				onNavigate={onNavigate}
			/>,
		);

		const tagButton = screen.getByRole("button", { name: /^urgent$/ });
		fireEvent.click(tagButton);

		expect(onTagRemove).not.toHaveBeenCalled();
		expect(onNavigate).toHaveBeenCalledWith("search", { query: "tag:urgent" });
	});

	it("clicking the × button removes the tag", () => {
		const onTagRemove = vi.fn();
		render(
			<DocumentEditorForm
				blocks={[]}
				tags={["urgent", "backend"]}
				isEditMode={true}
				isLoading={false}
				onTitleChange={vi.fn()}
				onBlocksChange={vi.fn()}
				onTagRemove={onTagRemove}
			/>,
		);

		const removeButtons = screen.getAllByRole("button", { name: /remove/i });
		fireEvent.click(removeButtons[0]);

		expect(onTagRemove).toHaveBeenCalledWith("urgent");
	});

	it("Delete key on focused tag removes the tag", () => {
		const onTagRemove = vi.fn();
		render(
			<DocumentEditorForm
				blocks={[]}
				tags={["urgent"]}
				isEditMode={true}
				isLoading={false}
				onTitleChange={vi.fn()}
				onBlocksChange={vi.fn()}
				onTagRemove={onTagRemove}
			/>,
		);

		const tagButton = screen.getByRole("button", { name: /^urgent$/ });
		fireEvent.keyDown(tagButton, { key: "Delete" });

		expect(onTagRemove).toHaveBeenCalledWith("urgent");
	});

	it("Backspace key on focused tag removes the tag", () => {
		const onTagRemove = vi.fn();
		render(
			<DocumentEditorForm
				blocks={[]}
				tags={["urgent"]}
				isEditMode={true}
				isLoading={false}
				onTitleChange={vi.fn()}
				onBlocksChange={vi.fn()}
				onTagRemove={onTagRemove}
			/>,
		);

		const tagButton = screen.getByRole("button", { name: /^urgent$/ });
		fireEvent.keyDown(tagButton, { key: "Backspace" });

		expect(onTagRemove).toHaveBeenCalledWith("urgent");
	});

	it("does not remove tag on click when readOnly", () => {
		const onTagRemove = vi.fn();
		const onNavigate = vi.fn();
		render(
			<DocumentEditorForm
				blocks={[]}
				tags={["urgent"]}
				isEditMode={true}
				isLoading={false}
				isReadOnly={true}
				onTitleChange={vi.fn()}
				onBlocksChange={vi.fn()}
				onTagRemove={onTagRemove}
				onNavigate={onNavigate}
			/>,
		);

		const tagButton = screen.getByRole("button", { name: /^urgent$/ });
		fireEvent.click(tagButton);

		expect(onTagRemove).not.toHaveBeenCalled();
		expect(onNavigate).not.toHaveBeenCalled();
	});
});
