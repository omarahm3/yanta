import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar, type SidebarSection } from "../Sidebar";

// Mock the useTooltipUsage hook
const mockShouldShowTooltip = vi.fn();
const mockRecordTooltipView = vi.fn();

// Mock the Tooltip component to avoid Radix Tooltip jsdom issues.
// Sidebar integration with Tooltip is what we're testing, not Radix internals.
vi.mock("../Tooltip", () => ({
	Tooltip: ({
		tooltipId,
		content,
		shortcut,
		children,
	}: {
		tooltipId: string;
		content: React.ReactNode;
		shortcut?: string;
		placement?: string;
		children: React.ReactNode;
	}) => {
		const [visible, setVisible] = useState(false);
		const shouldShow = mockShouldShowTooltip(tooltipId);
		return (
			<div
				onMouseEnter={() => {
					if (shouldShow) {
						setVisible(true);
						mockRecordTooltipView(tooltipId);
					}
				}}
				onMouseLeave={() => setVisible(false)}
			>
				{children}
				{visible && (
					<div role="tooltip" data-tooltip-id={tooltipId}>
						<span>{content}</span>
						{shortcut && shortcut.split("+").map((k) => <kbd key={k}>{k.trim()}</kbd>)}
					</div>
				)}
			</div>
		);
	},
}));

describe("Sidebar", () => {
	const HOVER_DELAY = 500;

	const basicSections: SidebarSection[] = [
		{
			id: "navigation",
			title: "NAVIGATION",
			items: [
				{ id: "dashboard", label: "documents" },
				{ id: "journal", label: "journal" },
			],
		},
	];

	const sectionsWithTooltips: SidebarSection[] = [
		{
			id: "navigation",
			title: "NAVIGATION",
			items: [
				{ id: "dashboard", label: "documents" },
				{
					id: "search",
					label: "search",
					tooltip: {
						tooltipId: "sidebar-search",
						description: "Search",
						shortcut: "Ctrl+Shift+F",
					},
				},
				{
					id: "journal",
					label: "journal",
					tooltip: {
						tooltipId: "sidebar-journal",
						description: "Journal",
						shortcut: "Ctrl+J",
					},
				},
			],
		},
	];

	beforeEach(() => {
		vi.useFakeTimers();
		mockShouldShowTooltip.mockReturnValue(true);
		mockRecordTooltipView.mockClear();
		// Mock matchMedia for reduced motion
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
		// Mock requestAnimationFrame to execute callback synchronously
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			return window.setTimeout(() => cb(Date.now()), 0);
		});
		vi.stubGlobal("cancelAnimationFrame", (id: number) => {
			window.clearTimeout(id);
		});
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	describe("basic rendering", () => {
		it("renders sections and items correctly", () => {
			render(<Sidebar sections={basicSections} />);

			expect(screen.getByText("NAVIGATION")).toBeInTheDocument();
			expect(screen.getByText("documents")).toBeInTheDocument();
			expect(screen.getByText("journal")).toBeInTheDocument();
		});

		it("renders logo image", () => {
			render(<Sidebar sections={basicSections} />);

			const logo = screen.getByAltText("YANTA");
			expect(logo).toBeInTheDocument();
		});

		it("applies custom className", () => {
			const { container } = render(<Sidebar sections={basicSections} className="custom-class" />);

			const aside = container.querySelector("aside");
			expect(aside).toHaveClass("custom-class");
		});

		it("renders item counts when provided", () => {
			const sectionsWithCounts: SidebarSection[] = [
				{
					id: "projects",
					title: "PROJECTS",
					items: [
						{ id: "project-1", label: "project-1", count: 5 },
						{ id: "project-2", label: "project-2", count: 10 },
					],
				},
			];

			render(<Sidebar sections={sectionsWithCounts} />);

			expect(screen.getByText("5")).toBeInTheDocument();
			expect(screen.getByText("10")).toBeInTheDocument();
		});

		it("handles item clicks", () => {
			const handleClick = vi.fn();
			const sectionsWithClick: SidebarSection[] = [
				{
					id: "navigation",
					title: "NAVIGATION",
					items: [{ id: "dashboard", label: "documents", onClick: handleClick }],
				},
			];

			render(<Sidebar sections={sectionsWithClick} />);

			fireEvent.click(screen.getByText("documents"));
			expect(handleClick).toHaveBeenCalledTimes(1);
		});

		it("marks active items", () => {
			const sectionsWithActive: SidebarSection[] = [
				{
					id: "navigation",
					title: "NAVIGATION",
					items: [
						{ id: "dashboard", label: "documents", active: true },
						{ id: "journal", label: "journal", active: false },
					],
				},
			];

			render(<Sidebar sections={sectionsWithActive} />);

			const dashboardItem = screen.getByText("documents").closest("li");
			const journalItem = screen.getByText("journal").closest("li");

			expect(dashboardItem).toHaveClass("active");
			expect(journalItem).not.toHaveClass("active");
		});
	});

	describe("tooltip functionality", () => {
		it("shows tooltip on hover for items with tooltip config", () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const searchItem = screen.getByText("search").closest("li");
			expect(searchItem).toBeInTheDocument();
			if (!searchItem) throw new Error("search item not found");

			// Hover over the wrapper around the list item (Tooltip mock wraps in div)
			const tooltipWrapper =
				searchItem.closest('[role="tooltip"]')?.parentElement ?? searchItem.parentElement;
			if (!tooltipWrapper) throw new Error("tooltip wrapper not found");
			fireEvent.mouseEnter(tooltipWrapper);

			// Tooltip should be visible
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
			expect(screen.getByText("Search")).toBeInTheDocument();
		});

		it("displays keyboard shortcut in tooltip", () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const journalItem = screen.getByText("journal").closest("li");
			if (!journalItem) throw new Error("journal item not found");

			const tooltipWrapper = journalItem.parentElement;
			if (!tooltipWrapper) throw new Error("tooltip wrapper not found");
			fireEvent.mouseEnter(tooltipWrapper);

			// Should show the keyboard shortcut
			expect(screen.getByText("Ctrl")).toBeInTheDocument();
			expect(screen.getByText("J")).toBeInTheDocument();
		});

		it("hides tooltip on mouse leave", () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const searchItem = screen.getByText("search").closest("li");
			if (!searchItem) throw new Error("search item not found");

			const tooltipWrapper = searchItem.parentElement;
			if (!tooltipWrapper) throw new Error("tooltip wrapper not found");
			fireEvent.mouseEnter(tooltipWrapper);

			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Leave the item
			fireEvent.mouseLeave(tooltipWrapper);

			// Tooltip should be hidden
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("does not show tooltip for items without tooltip config", () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			// Items without tooltip config are not wrapped in a Tooltip mock div
			// The "documents" item has no tooltip, so hovering should not show one
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("respects shouldShowTooltip returning false", () => {
			mockShouldShowTooltip.mockReturnValue(false);

			render(<Sidebar sections={sectionsWithTooltips} />);

			const searchItem = screen.getByText("search").closest("li");
			if (!searchItem) throw new Error("search item not found");

			const tooltipWrapper = searchItem.parentElement;
			if (!tooltipWrapper) throw new Error("tooltip wrapper not found");
			fireEvent.mouseEnter(tooltipWrapper);

			// Tooltip should not be shown
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("records tooltip view when tooltip becomes visible", () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const journalItem = screen.getByText("journal").closest("li");
			if (!journalItem) throw new Error("journal item not found");

			const tooltipWrapper = journalItem.parentElement;
			if (!tooltipWrapper) throw new Error("tooltip wrapper not found");
			fireEvent.mouseEnter(tooltipWrapper);

			expect(mockRecordTooltipView).toHaveBeenCalledWith("sidebar-journal");
		});

		it("preserves item click functionality with tooltip", () => {
			const handleClick = vi.fn();
			const sectionsWithClickAndTooltip: SidebarSection[] = [
				{
					id: "navigation",
					title: "NAVIGATION",
					items: [
						{
							id: "search",
							label: "search",
							onClick: handleClick,
							tooltip: {
								tooltipId: "sidebar-search",
								description: "Search",
								shortcut: "Ctrl+Shift+F",
							},
						},
					],
				},
			];

			render(<Sidebar sections={sectionsWithClickAndTooltip} />);

			fireEvent.click(screen.getByText("search"));
			expect(handleClick).toHaveBeenCalledTimes(1);
		});
	});

	describe("multiple sections", () => {
		it("renders multiple sections correctly", () => {
			const multipleSections: SidebarSection[] = [
				{
					id: "navigation",
					title: "NAVIGATION",
					items: [{ id: "dashboard", label: "documents" }],
				},
				{
					id: "projects",
					title: "PROJECTS",
					items: [{ id: "project-1", label: "project-1" }],
				},
			];

			render(<Sidebar sections={multipleSections} />);

			expect(screen.getByText("NAVIGATION")).toBeInTheDocument();
			expect(screen.getByText("PROJECTS")).toBeInTheDocument();
			expect(screen.getByText("documents")).toBeInTheDocument();
			expect(screen.getByText("project-1")).toBeInTheDocument();
		});
	});
});
