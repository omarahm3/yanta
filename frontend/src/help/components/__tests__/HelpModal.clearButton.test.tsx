import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { HelpModal } from "../HelpModal";

const searchInputRef = { current: null as HTMLInputElement | null };

vi.mock("../../hooks/useHelpModalController", () => ({
	useHelpModalController: () => ({
		isOpen: true,
		closeHelp: vi.fn(),
		pageName: "Test Page",
		searchQuery: "test query",
		setSearchQuery: vi.fn(),
		expandedSections: new Set(["global"]),
		toggleSection: vi.fn(),
		announcement: "",
		searchInputRef,
		closeButtonRef: { current: null },
		filteredSections: [],
		filteredGlobalCommands: [],
		filteredPageCommands: [],
		hasSearchQuery: true,
		totalResults: 0,
		handleOpenChange: vi.fn(),
		handleClearSearch: vi.fn(),
	}),
}));

describe("HelpModal clear button", () => {
	it("clear search button meets the 24×24 minimum hit target", () => {
		render(<HelpModal />);
		const clearBtn = screen.getByRole("button", { name: /clear search/i });
		expect(clearBtn.className).toMatch(/min-w-6/);
		expect(clearBtn.className).toMatch(/min-h-6/);
	});
});
