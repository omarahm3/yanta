import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getHintsForPage, useFooterHints } from "../hooks/useFooterHints";

describe("useFooterHints", () => {
	describe("Dashboard page hints", () => {
		it("returns correct hints for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints).toEqual([
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 2 },
				{ key: "Ctrl+N", label: "New", priority: 2 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});

		it("includes navigation hint for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints.some(h => h.key === "↑↓" && h.label === "Navigate")).toBe(true);
		});

		it("includes new document hint for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints.some(h => h.key === "Ctrl+N" && h.label === "New")).toBe(true);
		});
	});

	describe("Document page hints", () => {
		it("returns correct hints for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+S", label: "Save", priority: 1 },
				{ key: "Esc", label: "Back", priority: 2 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});

		it("includes save hint for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints.some(h => h.key === "Ctrl+S" && h.label === "Save")).toBe(true);
		});

		it("includes back/escape hint for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints.some(h => h.key === "Esc" && h.label === "Back")).toBe(true);
		});
	});

	describe("Journal page hints", () => {
		it("returns correct hints for journal", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			expect(result.current.hints).toEqual([
				{ key: "←→", label: "Change date", priority: 1 },
				{ key: "↑↓", label: "Navigate", priority: 2 },
				{ key: "Ctrl+T", label: "Today", priority: 2 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});

		it("includes date change hint for journal", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			expect(result.current.hints.some(h => h.key === "←→" && h.label === "Change date")).toBe(true);
		});

		it("includes today shortcut hint for journal", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			expect(result.current.hints.some(h => h.key === "Ctrl+T" && h.label === "Today")).toBe(true);
		});
	});

	describe("Search page hints", () => {
		it("returns correct hints for search", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "search" }));
			expect(result.current.hints).toEqual([
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 2 },
				{ key: "Esc", label: "Clear", priority: 2 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});

		it("includes clear hint for search", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "search" }));
			expect(result.current.hints.some(h => h.key === "Esc" && h.label === "Clear")).toBe(true);
		});
	});

	describe("Settings page hints", () => {
		it("returns correct hints for settings", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "settings" }));
			expect(result.current.hints).toEqual([
				{ key: "Esc", label: "Back", priority: 1 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});

		it("includes back hint for settings", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "settings" }));
			expect(result.current.hints.some(h => h.key === "Esc" && h.label === "Back")).toBe(true);
		});
	});

	describe("Projects page hints", () => {
		it("returns correct hints for projects", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "projects" }));
			expect(result.current.hints).toEqual([
				{ key: "↑↓", label: "Navigate", priority: 1 },
				{ key: "Enter", label: "Open", priority: 2 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});
	});

	describe("Quick capture page hints", () => {
		it("returns correct hints for quick-capture", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "quick-capture" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+Enter", label: "Save", priority: 1 },
				{ key: "Esc", label: "Cancel", priority: 2 },
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});
	});

	describe("Test page hints", () => {
		it("returns correct hints for test", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "test" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});
	});

	describe("Commands hint (Ctrl+K)", () => {
		it("always includes Ctrl+K Commands hint in all pages", () => {
			const pages = ["dashboard", "document", "journal", "search", "settings", "projects", "quick-capture", "test"];
			for (const page of pages) {
				const { result } = renderHook(() => useFooterHints({ currentPage: page }));
				expect(result.current.hints.some(h => h.key === "Ctrl+K" && h.label === "Commands")).toBe(true);
			}
		});
	});

	describe("Unknown page handling", () => {
		it("returns default hints for unknown page", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "unknown-page" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});

		it("returns default hints for empty page string", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+K", label: "Commands", priority: 1 },
			]);
		});
	});

	describe("Memoization", () => {
		it("returns same hints object when page does not change", () => {
			const { result, rerender } = renderHook(
				({ currentPage }) => useFooterHints({ currentPage }),
				{ initialProps: { currentPage: "dashboard" } }
			);
			const firstHints = result.current.hints;
			rerender({ currentPage: "dashboard" });
			expect(result.current.hints).toBe(firstHints);
		});

		it("returns new hints object when page changes", () => {
			const { result, rerender } = renderHook(
				({ currentPage }) => useFooterHints({ currentPage }),
				{ initialProps: { currentPage: "dashboard" } }
			);
			const firstHints = result.current.hints;
			rerender({ currentPage: "document" });
			expect(result.current.hints).not.toBe(firstHints);
		});
	});
});

describe("getHintsForPage", () => {
	it("returns hints for dashboard", () => {
		expect(getHintsForPage("dashboard")).toEqual([
			{ key: "↑↓", label: "Navigate", priority: 1 },
			{ key: "Enter", label: "Open", priority: 2 },
			{ key: "Ctrl+N", label: "New", priority: 2 },
			{ key: "Ctrl+K", label: "Commands", priority: 1 },
		]);
	});

	it("returns hints for document", () => {
		expect(getHintsForPage("document")).toEqual([
			{ key: "Ctrl+S", label: "Save", priority: 1 },
			{ key: "Esc", label: "Back", priority: 2 },
			{ key: "Ctrl+K", label: "Commands", priority: 1 },
		]);
	});

	it("returns hints for journal", () => {
		expect(getHintsForPage("journal")).toEqual([
			{ key: "←→", label: "Change date", priority: 1 },
			{ key: "↑↓", label: "Navigate", priority: 2 },
			{ key: "Ctrl+T", label: "Today", priority: 2 },
			{ key: "Ctrl+K", label: "Commands", priority: 1 },
		]);
	});

	it("returns hints for search", () => {
		expect(getHintsForPage("search")).toEqual([
			{ key: "↑↓", label: "Navigate", priority: 1 },
			{ key: "Enter", label: "Open", priority: 2 },
			{ key: "Esc", label: "Clear", priority: 2 },
			{ key: "Ctrl+K", label: "Commands", priority: 1 },
		]);
	});

	it("returns hints for settings", () => {
		expect(getHintsForPage("settings")).toEqual([
			{ key: "Esc", label: "Back", priority: 1 },
			{ key: "Ctrl+K", label: "Commands", priority: 1 },
		]);
	});

	it("returns default hints for unknown page", () => {
		expect(getHintsForPage("unknown")).toEqual([
			{ key: "Ctrl+K", label: "Commands", priority: 1 },
		]);
	});
});

describe("Priority assignments", () => {
	it("assigns priority 1 to Ctrl+K on all pages", () => {
		const pages = ["dashboard", "document", "journal", "search", "settings", "projects", "quick-capture", "test"];
		for (const page of pages) {
			const hints = getHintsForPage(page);
			const ctrlKHint = hints.find((h) => h.key === "Ctrl+K");
			expect(ctrlKHint?.priority).toBe(1);
		}
	});

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
		// Settings: Back
		expect(getHintsForPage("settings").find((h) => h.label === "Back")?.priority).toBe(1);
		// Quick-capture: Save
		expect(getHintsForPage("quick-capture").find((h) => h.label === "Save")?.priority).toBe(1);
	});
});
