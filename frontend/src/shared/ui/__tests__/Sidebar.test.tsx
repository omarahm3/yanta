import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarStateStore } from "../../stores/sidebarState.store";
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
						{shortcut?.split("+").map((k) => (
							<kbd key={k}>{k.trim()}</kbd>
						))}
					</div>
				)}
			</div>
		);
	},
}));

describe("Sidebar", () => {
	const _HOVER_DELAY = 500;

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
		// Reset persisted sidebar state before each test
		localStorage.clear();
		useSidebarStateStore.setState({
			collapsedSections: [],
			sidebarWidth: 192,
			pinnedDocuments: [],
		});
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
		localStorage.clear();
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

		it("exposes the sidebar as a navigation landmark", () => {
			render(<Sidebar sections={basicSections} />);

			const nav = screen.getByRole("navigation", { name: "Main navigation" });
			expect(nav.tagName.toLowerCase()).toBe("aside");
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

	describe("collapsible sections", () => {
		it("sections are expanded by default", () => {
			render(<Sidebar sections={basicSections} />);

			const toggleBtn = screen.getByRole("button", { name: /NAVIGATION/i });
			expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
		});

		it("collapses a section on header click", () => {
			render(<Sidebar sections={basicSections} />);

			const toggleBtn = screen.getByRole("button", { name: /NAVIGATION/i });
			fireEvent.click(toggleBtn);

			expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
		});

		it("expands a collapsed section on second click", () => {
			render(<Sidebar sections={basicSections} />);

			const toggleBtn = screen.getByRole("button", { name: /NAVIGATION/i });
			fireEvent.click(toggleBtn);
			expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

			fireEvent.click(toggleBtn);
			expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
		});

		it("section toggle button has aria-controls pointing to content", () => {
			render(<Sidebar sections={basicSections} />);

			const toggleBtn = screen.getByRole("button", { name: /NAVIGATION/i });
			const controlledId = toggleBtn.getAttribute("aria-controls");
			expect(controlledId).toBe("sidebar-section-navigation");

			const contentEl = document.getElementById("sidebar-section-navigation");
			expect(contentEl).toBeInTheDocument();
		});

		it("persists collapsed state to store", () => {
			render(<Sidebar sections={basicSections} />);

			const toggleBtn = screen.getByRole("button", { name: /NAVIGATION/i });
			fireEvent.click(toggleBtn);

			expect(useSidebarStateStore.getState().collapsedSections).toContain("navigation");
		});
	});

	describe("resize handle", () => {
		it("renders a resize slider", () => {
			render(<Sidebar sections={basicSections} />);

			const handle = screen.getByRole("slider", { name: "Sidebar width" });
			expect(handle).toBeInTheDocument();
		});

		it("resize handle is keyboard focusable", () => {
			render(<Sidebar sections={basicSections} />);

			const handle = screen.getByRole("slider", { name: "Sidebar width" });
			expect(handle).toHaveAttribute("tabIndex", "0");
		});

		it("resize handle exposes aria-valuenow", () => {
			useSidebarStateStore.setState({ sidebarWidth: 200 });
			render(<Sidebar sections={basicSections} />);

			const handle = screen.getByRole("slider", { name: "Sidebar width" });
			expect(handle).toHaveAttribute("aria-valuenow", "200");
		});

		it("ArrowRight key increases sidebar width", () => {
			render(<Sidebar sections={basicSections} />);

			const handle = screen.getByRole("slider", { name: "Sidebar width" });
			const initialWidth = useSidebarStateStore.getState().sidebarWidth;
			fireEvent.keyDown(handle, { key: "ArrowRight" });

			expect(useSidebarStateStore.getState().sidebarWidth).toBeGreaterThan(initialWidth);
		});

		it("ArrowLeft key decreases sidebar width", () => {
			render(<Sidebar sections={basicSections} />);

			const handle = screen.getByRole("slider", { name: "Sidebar width" });
			const initialWidth = useSidebarStateStore.getState().sidebarWidth;
			fireEvent.keyDown(handle, { key: "ArrowLeft" });

			expect(useSidebarStateStore.getState().sidebarWidth).toBeLessThan(initialWidth);
		});

		it("applies sidebar width from store as inline style", () => {
			useSidebarStateStore.setState({ sidebarWidth: 240 });
			const { container } = render(<Sidebar sections={basicSections} />);

			const aside = container.querySelector("aside");
			expect(aside).toHaveStyle({ width: "240px" });
		});
	});

	describe("action buttons", () => {
		it("renders action button for items with action prop", () => {
			const handleAction = vi.fn();
			const sectionsWithAction: SidebarSection[] = [
				{
					id: "pinned",
					title: "PINNED",
					items: [
						{
							id: "pinned-doc",
							label: "My Note",
							action: {
								label: "Unpin",
								icon: "×",
								onClick: handleAction,
							},
						},
					],
				},
			];

			render(<Sidebar sections={sectionsWithAction} />);

			const actionBtn = screen.getByRole("button", { name: "Unpin" });
			expect(actionBtn).toBeInTheDocument();
		});

		it("action button click calls the provided handler", () => {
			const handleAction = vi.fn();
			const sectionsWithAction: SidebarSection[] = [
				{
					id: "pinned",
					title: "PINNED",
					items: [
						{
							id: "pinned-doc",
							label: "My Note",
							action: {
								label: "Unpin",
								icon: "×",
								onClick: handleAction,
							},
						},
					],
				},
			];

			render(<Sidebar sections={sectionsWithAction} />);

			const actionBtn = screen.getByRole("button", { name: "Unpin" });
			fireEvent.click(actionBtn);
			expect(handleAction).toHaveBeenCalledTimes(1);
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

		it("collapsing one section does not affect others", () => {
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

			const navBtn = screen.getByRole("button", { name: /NAVIGATION/i });
			fireEvent.click(navBtn);

			// navigation collapsed, projects still expanded
			expect(navBtn).toHaveAttribute("aria-expanded", "false");
			const projectsBtn = screen.getByRole("button", { name: /PROJECTS/i });
			expect(projectsBtn).toHaveAttribute("aria-expanded", "true");
		});
	});
});
