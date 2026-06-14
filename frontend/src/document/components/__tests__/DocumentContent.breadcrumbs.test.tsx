import { render } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type { BreadcrumbItem } from "../../../shared/ui";

/**
 * Verifies the document-view breadcrumbs are interactive (keyboard navigable):
 * the project crumb must carry an onClick that navigates back to the dashboard,
 * so HeaderBar renders it as a focusable <button> rather than a static <span>.
 * (Gemini PR #51 findings 3410222839 / 3410222841.)
 */

let capturedBreadcrumbs: BreadcrumbItem[] | undefined;

vi.mock("../../../app", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../app")>();
	return {
		...actual,
		Layout: ({
			children,
			breadcrumbs,
		}: {
			children: React.ReactNode;
			breadcrumbs?: BreadcrumbItem[];
		}) => {
			capturedBreadcrumbs = breadcrumbs;
			return <div data-testid="layout">{children}</div>;
		},
	};
});

vi.mock("../DocumentEditorForm", () => ({
	DocumentEditorForm: () => <div data-testid="document-editor-form" />,
}));

vi.mock("../DocumentEditorActions", () => ({
	DocumentEditorActions: () => <div data-testid="document-editor-actions" />,
}));

import { DocumentContent } from "../DocumentContent";

const baseProps = {
	sidebarSections: [],
	currentProject: {
		id: "1",
		alias: "proj",
		name: "Project",
		createdAt: "",
		updatedAt: "",
		startDate: "",
	},
	documentPath: "proj/note.json",
	documentTitle: "My Note",
	formData: { blocks: [], tags: [] },
	isEditMode: true,
	isLoading: false,
	isArchived: false,
	autoSave: {
		saveState: "idle" as const,
		lastSaved: null,
		hasUnsavedChanges: false,
		saveError: null,
		saveNow: vi.fn(),
	},
	onTitleChange: vi.fn(),
	onBlocksChange: vi.fn(),
	onTagRemove: vi.fn(),
	onEditorReady: vi.fn(),
};

describe("DocumentContent breadcrumbs", () => {
	it("makes the project crumb interactive, navigating to the dashboard", () => {
		const onNavigate = vi.fn();
		render(<DocumentContent {...baseProps} onNavigate={onNavigate} />);

		expect(capturedBreadcrumbs).toHaveLength(2);
		const [projectCrumb, documentCrumb] = capturedBreadcrumbs ?? [];

		expect(projectCrumb.label).toBe("Project");
		expect(typeof projectCrumb.onClick).toBe("function");

		projectCrumb.onClick?.();
		expect(onNavigate).toHaveBeenCalledWith("dashboard");

		// The current document is the leaf — it stays a static crumb.
		expect(documentCrumb.label).toBe("My Note");
		expect(documentCrumb.onClick).toBeUndefined();
	});
});
