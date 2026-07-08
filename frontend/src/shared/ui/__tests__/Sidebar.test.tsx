import { fireEvent, render, screen, within } from "@testing-library/react";
import type React from "react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarStateStore } from "../../stores/sidebarState.store";
import { Sidebar, type SidebarSection } from "../Sidebar";

// The rail opens the command palette via the store; mock its `open` action.
const mockOpen = vi.fn();
vi.mock("../../../command-palette/commandPalette.store", () => ({
	useCommandPaletteStore: (selector: (s: { open: () => void }) => unknown) =>
		selector({ open: mockOpen }),
}));

// Mock Tooltip — we test the rail's integration with it (label + shortcut),
// not Radix internals. Renders children always; reveals content on hover.
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
		return (
			<div onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
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

const navSection = (
	overrides: Partial<SidebarSection["items"][number]>[] = [],
): SidebarSection[] => [
	{
		id: "navigation",
		title: "NAVIGATION",
		items: [
			{ id: "dashboard", label: "documents", active: true, ...overrides[0] },
			{
				id: "journal",
				label: "journal",
				tooltip: { tooltipId: "sidebar-journal", description: "Journal", shortcut: "Ctrl+J" },
				...overrides[1],
			},
			{ id: "search", label: "search", ...overrides[2] },
			{ id: "settings", label: "settings", ...overrides[3] },
		],
	},
];

describe("Sidebar (icon rail)", () => {
	beforeEach(() => {
		mockOpen.mockClear();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("exposes the rail as a navigation landmark", () => {
		render(<Sidebar sections={navSection()} />);
		const nav = screen.getByRole("navigation", { name: "Main navigation" });
		expect(nav.tagName.toLowerCase()).toBe("aside");
	});

	it("applies a custom className to the sidebar root", () => {
		const { container } = render(<Sidebar sections={navSection()} className="custom-class" />);
		expect(container.firstChild).toHaveClass("custom-class");
	});

	it("renders the command-palette button and opens the palette on click", () => {
		render(<Sidebar sections={navSection()} />);
		const cmd = screen.getByRole("button", { name: "Open command palette" });
		fireEvent.click(cmd);
		expect(mockOpen).toHaveBeenCalledTimes(1);
	});

	it("renders a button per destination, labeled by tooltip description or the capitalized label", () => {
		render(<Sidebar sections={navSection()} />);
		expect(screen.getByRole("button", { name: "Documents" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Journal" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
	});

	it("marks the active destination with aria-current", () => {
		render(<Sidebar sections={navSection()} />);
		expect(screen.getByRole("button", { name: "Documents" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("button", { name: "Journal" })).not.toHaveAttribute("aria-current");
	});

	it("calls a destination's onClick when activated", () => {
		const onClick = vi.fn();
		render(<Sidebar sections={navSection([{}, {}, { onClick }])} />);
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("falls back to the first letter when an item has no icon", () => {
		render(<Sidebar sections={navSection()} />);
		// none of the test items pass an icon, so each shows its capitalized initial
		expect(screen.getByRole("button", { name: "Documents" })).toHaveTextContent("D");
	});

	it("shows the label and shortcut in a tooltip on hover", () => {
		render(<Sidebar sections={navSection()} />);
		const journal = screen.getByRole("button", { name: "Journal" });
		const wrapper = journal.parentElement;
		if (!wrapper) throw new Error("tooltip wrapper not found");
		fireEvent.mouseEnter(wrapper);
		const tip = screen.getByRole("tooltip");
		// "J" also appears as the Journal button's fallback initial, so scope to the tooltip.
		expect(within(tip).getByText("Journal")).toBeInTheDocument();
		expect(within(tip).getByText("Ctrl")).toBeInTheDocument();
		expect(within(tip).getByText("J")).toBeInTheDocument();
	});
});

describe("Sidebar (sections panel)", () => {
	beforeEach(() => {
		useSidebarStateStore.setState({ collapsedSections: [] });
	});

	const withSections = (): SidebarSection[] => [
		...navSection(),
		{
			id: "pinned",
			title: "PINNED",
			items: [
				{
					id: "pinned-a",
					label: "Pinned Note",
					onClick: vi.fn(),
					action: { label: "Unpin", icon: "×", onClick: vi.fn() },
				},
			],
		},
		{
			id: "projects",
			title: "PROJECTS",
			items: [{ id: "p1", label: "alpha", count: 3, onClick: vi.fn() }],
		},
	];

	it("renders non-navigation sections and their items", () => {
		render(<Sidebar sections={withSections()} />);
		expect(screen.getByText("PINNED")).toBeInTheDocument();
		expect(screen.getByText("Pinned Note")).toBeInTheDocument();
		expect(screen.getByText("PROJECTS")).toBeInTheDocument();
		expect(screen.getByText("alpha")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
	});

	it("does not render a panel when only the navigation section exists", () => {
		render(<Sidebar sections={navSection()} />);
		expect(screen.queryByText("PINNED")).not.toBeInTheDocument();
		expect(screen.queryByText("PROJECTS")).not.toBeInTheDocument();
	});

	it("fires a panel item's onClick when activated", () => {
		const onClick = vi.fn();
		const sections = withSections();
		sections[1].items[0].onClick = onClick;
		render(<Sidebar sections={sections} />);
		fireEvent.click(screen.getByText("Pinned Note"));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("reserves right padding on rows with an action so the button never overlaps the label", () => {
		render(<Sidebar sections={withSections()} />);
		// The pinned row has an unpin action; its label button must reserve space (pr-8).
		const pinnedBtn = screen.getByText("Pinned Note").closest("button");
		expect(pinnedBtn).toHaveClass("pr-8");
		// A row without an action keeps the default padding.
		const projectBtn = screen.getByText("alpha").closest("button");
		expect(projectBtn).not.toHaveClass("pr-8");
	});

	it("exposes a section's item action (e.g. unpin)", () => {
		const onUnpin = vi.fn();
		const sections = withSections();
		if (sections[1].items[0].action) sections[1].items[0].action.onClick = onUnpin;
		render(<Sidebar sections={sections} />);
		fireEvent.click(screen.getByRole("button", { name: "Unpin" }));
		expect(onUnpin).toHaveBeenCalledTimes(1);
	});

	it("collapses a section when its header is toggled", () => {
		render(<Sidebar sections={withSections()} />);
		const header = screen.getByRole("button", { name: /PINNED/ });
		expect(header).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Pinned Note")).toBeInTheDocument();
		fireEvent.click(header);
		expect(header).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Pinned Note")).not.toBeInTheDocument();
	});
});
