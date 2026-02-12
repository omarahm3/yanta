import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar, type SidebarSection } from "../Sidebar";

// Mock the useTooltipUsage hook
const mockShouldShowTooltip = vi.fn();
const mockRecordTooltipView = vi.fn();

vi.mock("../../stores/tooltipUsage.store", () => ({
	...vi.importActual("../../stores/tooltipUsage.store"),
	useTooltipUsage: () => ({
		shouldShowTooltip: mockShouldShowTooltip,
		recordTooltipView: mockRecordTooltipView,
		getTooltipUsage: vi.fn(),
		getAllTooltipUsage: vi.fn(),
	}),
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
			cb(0);
			return 0;
		});
	});

	afterEach(() => {
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
		it("shows tooltip on hover for items with tooltip config", async () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const searchItem = screen.getByText("search").closest("li");
			expect(searchItem).toBeInTheDocument();
			if (!searchItem) throw new Error("search item not found");

			// Hover over the search item
			fireEvent.mouseEnter(searchItem);

			// Advance timers past the hover delay
			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY + 10);
			});

			// Tooltip should be visible
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
			expect(screen.getByText("Search")).toBeInTheDocument();
		});

		it("displays keyboard shortcut in tooltip", async () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const journalItem = screen.getByText("journal").closest("li");
			if (!journalItem) throw new Error("journal item not found");
			fireEvent.mouseEnter(journalItem);

			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY + 10);
			});

			// Should show the keyboard shortcut
			expect(screen.getByText("Ctrl")).toBeInTheDocument();
			expect(screen.getByText("J")).toBeInTheDocument();
		});

		it("hides tooltip on mouse leave", async () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const searchItem = screen.getByText("search").closest("li");
			if (!searchItem) throw new Error("search item not found");
			fireEvent.mouseEnter(searchItem);

			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY + 10);
			});

			expect(screen.getByRole("tooltip")).toBeInTheDocument();

			// Leave the item
			fireEvent.mouseLeave(searchItem);

			// Tooltip should be hidden
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("does not show tooltip for items without tooltip config", async () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const dashboardItem = screen.getByText("documents").closest("li");
			if (!dashboardItem) throw new Error("documents item not found");
			fireEvent.mouseEnter(dashboardItem);

			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY + 10);
			});

			// No tooltip should be visible
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("respects shouldShowTooltip returning false", async () => {
			mockShouldShowTooltip.mockReturnValue(false);

			render(<Sidebar sections={sectionsWithTooltips} />);

			const searchItem = screen.getByText("search").closest("li");
			if (!searchItem) throw new Error("search item not found");
			fireEvent.mouseEnter(searchItem);

			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY + 10);
			});

			// Tooltip should not be shown
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		});

		it("records tooltip view when tooltip becomes visible", async () => {
			render(<Sidebar sections={sectionsWithTooltips} />);

			const journalItem = screen.getByText("journal").closest("li");
			if (!journalItem) throw new Error("journal item not found");
			fireEvent.mouseEnter(journalItem);

			act(() => {
				vi.advanceTimersByTime(HOVER_DELAY + 10);
			});

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
