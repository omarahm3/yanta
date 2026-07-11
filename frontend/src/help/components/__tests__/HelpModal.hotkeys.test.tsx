import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { vi } from "vitest";
import { classifyEventTarget } from "../../../hotkeys/utils/hotkeyMatcher";
import { HelpModal } from "../HelpModal";

const closeHelp = vi.fn();
const searchInputRef = { current: null as HTMLInputElement | null };

vi.mock("../../hooks/useHelpModalController", () => ({
	useHelpModalController: () => {
		useEffect(() => {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === "?") {
					const { inInputField } = classifyEventTarget(e.target);
					if (inInputField) return;
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
			searchInputRef,
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
		searchInputRef.current = null;
	});

	it("closes with Escape", () => {
		render(<HelpModal />);

		fireEvent.keyDown(document, { key: "Escape" });
		expect(closeHelp).toHaveBeenCalledTimes(1);
	});

	it("closes with ? on a non-editable target", () => {
		render(<HelpModal />);

		fireEvent.keyDown(document, { key: "?" });
		expect(closeHelp).toHaveBeenCalledTimes(1);
	});

	it("does not close with ? when the search input is focused", async () => {
		render(<HelpModal />);

		const input = await screen.findByPlaceholderText("Search shortcuts...");
		input.focus();

		fireEvent.keyDown(input, { key: "?" });
		expect(closeHelp).not.toHaveBeenCalled();
	});
});
