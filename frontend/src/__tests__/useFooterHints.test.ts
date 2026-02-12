import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getHintsForPage, useFooterHints } from "../shared/hooks";

describe("useFooterHints", () => {
	describe("Dashboard page hints", () => {
		it("returns correct hints for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints).toEqual([
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 1 },
				{ key: "Space", label: "Select", priority: 1 },
				{ key: "Ctrl+N", label: "New", priority: 2 },
				{ key: "Ctrl+M", label: "Move", priority: 2 },
				{ key: "Ctrl+A", label: "Archive", priority: 2 },
				{ key: "Ctrl+U", label: "Restore", priority: 3 },
				{ key: "Ctrl+D", label: "Delete", priority: 3 },
				{ key: "Ctrl+Shift+D", label: "Permanent delete", priority: 3 },
				{ key: "Ctrl+E", label: "Export MD", priority: 3 },
				{ key: "Ctrl+Shift+E", label: "Export PDF", priority: 3 },
				{ key: "Ctrl+Shift+A", label: "Toggle archived", priority: 3 },
			]);
		});

		it("includes navigation hint for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints.some((h) => h.key === "↑↓" && h.label === "Navigate")).toBe(true);
		});

		it("includes new document hint for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints.some((h) => h.key === "Ctrl+N" && h.label === "New")).toBe(true);
		});

		it("includes move hint for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints.some((h) => h.key === "Ctrl+M" && h.label === "Move")).toBe(true);
		});

		it("includes select hint for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints.some((h) => h.key === "Space" && h.label === "Select")).toBe(true);
		});
	});

	describe("Document page hints", () => {
		it("returns correct hints for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+S", label: "Save", priority: 1 },
				{ key: "Esc", label: "Back", priority: 1 },
				{ key: "Enter", label: "Focus editor", priority: 2 },
				{ key: "Ctrl+E", label: "Export MD", priority: 2 },
				{ key: "Ctrl+Shift+E", label: "Export PDF", priority: 3 },
				{ key: "Ctrl+\\", label: "Split right", priority: 3 },
				{ key: "Ctrl+Shift+\\", label: "Split down", priority: 3 },
				{ key: "Alt+X", label: "Close pane", priority: 3 },
				{ key: "Alt+H/J/K/L", label: "Focus panes", priority: 3 },
			]);
		});

		it("includes save hint for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints.some((h) => h.key === "Ctrl+S" && h.label === "Save")).toBe(true);
		});

		it("includes back/escape hint for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints.some((h) => h.key === "Esc" && h.label === "Back")).toBe(true);
		});

		it("includes export hints for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints.some((h) => h.key === "Ctrl+E" && h.label === "Export MD")).toBe(
				true,
			);
			expect(
				result.current.hints.some((h) => h.key === "Ctrl+Shift+E" && h.label === "Export PDF"),
			).toBe(true);
		});
	});

	describe("Journal page hints", () => {
		it("returns correct hints for journal", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			expect(result.current.hints).toEqual([
				{ key: "←→", label: "Change date", priority: 1 },
				{ key: "Ctrl+N/P", label: "Next/prev day", priority: 2 },
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Space", label: "Select", priority: 2 },
				{ key: "Ctrl+D", label: "Delete", priority: 2 },
				{ key: "Ctrl+Shift+P", label: "Promote", priority: 3 },
			]);
		});

		it("includes date change hint for journal", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			expect(result.current.hints.some((h) => h.key === "←→" && h.label === "Change date")).toBe(true);
		});

		it("includes next/prev day hint for journal", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			expect(
				result.current.hints.some((h) => h.key === "Ctrl+N/P" && h.label === "Next/prev day"),
			).toBe(true);
		});

		it("includes promote hint for journal", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			expect(result.current.hints.some((h) => h.key === "Ctrl+Shift+P" && h.label === "Promote")).toBe(
				true,
			);
		});
	});

	describe("Search page hints", () => {
		it("returns correct hints for search", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "search" }));
			expect(result.current.hints).toEqual([
				{ key: "/", label: "Focus search", priority: 1 },
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 1 },
				{ key: "Tab", label: "To results", priority: 2 },
				{ key: "Esc", label: "Clear", priority: 2 },
			]);
		});

		it("includes focus search hint", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "search" }));
			expect(result.current.hints.some((h) => h.key === "/" && h.label === "Focus search")).toBe(true);
		});

		it("includes clear hint for search", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "search" }));
			expect(result.current.hints.some((h) => h.key === "Esc" && h.label === "Clear")).toBe(true);
		});
	});

	describe("Settings page hints", () => {
		it("returns correct hints for settings", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "settings" }));
			expect(result.current.hints).toEqual([{ key: "j/k", label: "Navigate sections", priority: 1 }]);
		});

		it("includes navigate sections hint for settings", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "settings" }));
			expect(
				result.current.hints.some((h) => h.key === "j/k" && h.label === "Navigate sections"),
			).toBe(true);
		});
	});

	describe("Projects page hints", () => {
		it("returns correct hints for projects", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "projects" }));
			expect(result.current.hints).toEqual([
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 1 },
				{ key: "Ctrl+N", label: "New", priority: 2 },
				{ key: "Ctrl+A", label: "Archive", priority: 2 },
				{ key: "Ctrl+U", label: "Restore", priority: 3 },
				{ key: "Ctrl+D", label: "Delete", priority: 3 },
				{ key: "Ctrl+Shift+D", label: "Permanent delete", priority: 3 },
			]);
		});
	});

	describe("Quick capture page hints", () => {
		it("returns correct hints for quick-capture", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "quick-capture" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+Enter", label: "Save", priority: 1 },
				{ key: "Shift+Enter", label: "Save & stay", priority: 2 },
				{ key: "Esc", label: "Cancel", priority: 2 },
			]);
		});
	});

	describe("Test page hints", () => {
		it("returns correct hints for test", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "test" }));
			expect(result.current.hints).toEqual([]);
		});
	});

	describe("Unknown page handling", () => {
		it("returns empty hints for unknown page", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "unknown-page" }));
			expect(result.current.hints).toEqual([]);
		});

		it("returns empty hints for empty page string", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "" }));
			expect(result.current.hints).toEqual([]);
		});
	});

	describe("Memoization", () => {
		it("returns same hints object when page does not change", () => {
			const { result, rerender } = renderHook(({ currentPage }) => useFooterHints({ currentPage }), {
				initialProps: { currentPage: "dashboard" },
			});
			const firstHints = result.current.hints;
			rerender({ currentPage: "dashboard" });
			expect(result.current.hints).toBe(firstHints);
		});

		it("returns new hints object when page changes", () => {
			const { result, rerender } = renderHook(({ currentPage }) => useFooterHints({ currentPage }), {
				initialProps: { currentPage: "dashboard" },
			});
			const firstHints = result.current.hints;
			rerender({ currentPage: "document" });
			expect(result.current.hints).not.toBe(firstHints);
		});
	});
});

describe("getHintsForPage", () => {
	it("returns hints for dashboard", () => {
		const hints = getHintsForPage("dashboard");
		expect(hints.some((h) => h.key === "↑↓")).toBe(true);
		expect(hints.some((h) => h.key === "Space")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+M")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+U")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+Shift+D")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+Shift+E")).toBe(true);
	});

	it("returns hints for document", () => {
		const hints = getHintsForPage("document");
		expect(hints.some((h) => h.key === "Ctrl+S")).toBe(true);
		expect(hints.some((h) => h.key === "Enter")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+E")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+Shift+\\")).toBe(true);
	});

	it("returns hints for journal", () => {
		const hints = getHintsForPage("journal");
		expect(hints.some((h) => h.key === "←→")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+N/P")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+D")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+Shift+P")).toBe(true);
	});

	it("returns hints for search", () => {
		const hints = getHintsForPage("search");
		expect(hints.some((h) => h.key === "/")).toBe(true);
		expect(hints.some((h) => h.key === "Tab")).toBe(true);
	});

	it("returns hints for settings", () => {
		const hints = getHintsForPage("settings");
		expect(hints.some((h) => h.key === "j/k")).toBe(true);
	});

	it("returns hints for projects", () => {
		const hints = getHintsForPage("projects");
		expect(hints.some((h) => h.key === "Ctrl+N")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+A")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+Shift+D")).toBe(true);
	});

	it("returns empty hints for unknown page", () => {
		expect(getHintsForPage("unknown")).toEqual([]);
	});
});

describe("Priority assignments", () => {
	it("assigns priority 1 to navigation hints on appropriate pages", () => {
		const navigationPages = ["dashboard", "search", "projects"];
		for (const page of navigationPages) {
			const hints = getHintsForPage(page);
			const navHint = hints.find((h) => h.key === "↑↓");
			expect(navHint?.priority).toBe(1);
		}
	});

	it("assigns priority 1 to essential action on each page", () => {
		// Dashboard: Navigate
		expect(getHintsForPage("dashboard").find((h) => h.label === "Navigate")?.priority).toBe(1);
		// Document: Save
		expect(getHintsForPage("document").find((h) => h.label === "Save")?.priority).toBe(1);
		// Journal: Change date
		expect(getHintsForPage("journal").find((h) => h.label === "Change date")?.priority).toBe(1);
		// Search: Navigate
		expect(getHintsForPage("search").find((h) => h.label === "Navigate")?.priority).toBe(1);
		// Settings: Navigate sections
		expect(getHintsForPage("settings").find((h) => h.label === "Navigate sections")?.priority).toBe(
			1,
		);
		// Quick-capture: Save
		expect(getHintsForPage("quick-capture").find((h) => h.label === "Save")?.priority).toBe(1);
	});
});
