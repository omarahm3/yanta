import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Tests for DocumentContent page header with mode icon
 * These tests verify the visual elements added for mode differentiation
 * by rendering the ACTUAL DocumentContent component
 */

// Mock Layout to render children (header is part of children)
vi.mock("../../../app", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../app")>();
	return {
		...actual,
		Layout: ({ children }: { children: React.ReactNode }) => (
			<div data-testid="layout">{children}</div>
		),
	};
});

// Mock child components that aren't relevant to header testing
vi.mock("../DocumentEditorForm", () => ({
	DocumentEditorForm: () => <div data-testid="document-editor-form" />,
}));

vi.mock("../DocumentEditorActions", () => ({
	DocumentEditorActions: () => <div data-testid="document-editor-actions" />,
}));

// Import after mocks
import { DocumentContent } from "../DocumentContent";

const mockProps = {
	sidebarSections: [],
	currentProject: {
		id: "1",
		alias: "proj",
		name: "Project",
		createdAt: "",
		updatedAt: "",
		startDate: "",
	},
	formData: {
		blocks: [],
		tags: [],
	},
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

describe("DocumentContent page header visual elements", () => {
	it("renders the actual DocumentContent with Document label", () => {
		render(<DocumentContent {...mockProps} />);

		const label = screen.getByText("Document");
		expect(label).toBeInTheDocument();
	});

	it("renders page header icon with mode accent styling", () => {
		render(<DocumentContent {...mockProps} />);

		const icon = screen.getByTestId("page-header-icon");
		expect(icon).toBeInTheDocument();
		expect(icon).toHaveAttribute("aria-hidden", "true");
		expect(icon).toHaveStyle({ color: "var(--mode-accent)" });
	});

	it("icon and label are rendered together in the header", () => {
		render(<DocumentContent {...mockProps} />);

		const icon = screen.getByTestId("page-header-icon");
		const label = screen.getByText("Document");

		// Both should be in the document
		expect(icon).toBeInTheDocument();
		expect(label).toBeInTheDocument();

		// They should share a common parent container
		const iconParent = icon.parentElement;
		const labelParent = label.parentElement;
		expect(iconParent).toBe(labelParent);
	});
});
