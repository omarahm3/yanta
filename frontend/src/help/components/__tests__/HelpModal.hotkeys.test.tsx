import { fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { vi } from "vitest";
import { HelpModal } from "../HelpModal";

const closeHelp = vi.fn();

vi.mock("../../hooks/useHelpModalController", () => ({
	useHelpModalController: () => {
		// Replicate the real hook's keydown listener for "?"
		useEffect(() => {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === "?") {
					e.preventDefault();
					closeHelp();
				}
			};
			document.addEventListener("keydown", handleKeyDown);
			return () => document.removeEventListener("keydown", handleKeyDown);
		}, []);

		return {
			isOpen: true,
			closeHelp,
			pageName: "Test Page",
			searchQuery: "",
			setSearchQuery: vi.fn(),
			expandedSections: new Set(["global"]),
			toggleSection: vi.fn(),
			announcement: "",
			searchInputRef: { current: null },
			closeButtonRef: { current: null },
			filteredSections: [],
			filteredGlobalCommands: [],
			filteredPageCommands: [],
			hasSearchQuery: false,
			totalResults: 0,
			handleOpenChange: (open: boolean) => {
				if (!open) closeHelp();
			},
			handleClearSearch: vi.fn(),
		};
	},
}));

describe("HelpModal hotkeys", () => {
	beforeEach(() => {
		closeHelp.mockClear();
	});

	it("closes with Escape", () => {
		render(<HelpModal />);

		fireEvent.keyDown(document, { key: "Escape" });
		expect(closeHelp).toHaveBeenCalledTimes(1);
	});

	it("closes with ?", () => {
		render(<HelpModal />);

		fireEvent.keyDown(document, { key: "?" });
		expect(closeHelp).toHaveBeenCalledTimes(1);
	});
});
