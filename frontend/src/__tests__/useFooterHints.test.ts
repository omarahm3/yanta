import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getHintsForPage, useFooterHints } from "../hooks/useFooterHints";

describe("useFooterHints", () => {
	describe("Dashboard page hints", () => {
		it("returns correct hints for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints).toEqual([
				{ key: "↑↓", label: "Navigate" },
				{ key: "Enter", label: "Open" },
				{ key: "Ctrl+N", label: "New" },
				{ key: "Ctrl+K", label: "Commands" },
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
				{ key: "Ctrl+S", label: "Save" },
				{ key: "Esc", label: "Back" },
				{ key: "Ctrl+K", label: "Commands" },
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
				{ key: "←→", label: "Change date" },
				{ key: "↑↓", label: "Navigate" },
				{ key: "Ctrl+T", label: "Today" },
				{ key: "Ctrl+K", label: "Commands" },
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
				{ key: "↑↓", label: "Navigate" },
				{ key: "Enter", label: "Open" },
				{ key: "Esc", label: "Clear" },
				{ key: "Ctrl+K", label: "Commands" },
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
				{ key: "Esc", label: "Back" },
				{ key: "Ctrl+K", label: "Commands" },
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
				{ key: "↑↓", label: "Navigate" },
				{ key: "Enter", label: "Open" },
				{ key: "Ctrl+K", label: "Commands" },
			]);
		});
	});

	describe("Quick capture page hints", () => {
		it("returns correct hints for quick-capture", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "quick-capture" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+Enter", label: "Save" },
				{ key: "Esc", label: "Cancel" },
				{ key: "Ctrl+K", label: "Commands" },
			]);
		});
	});

	describe("Test page hints", () => {
		it("returns correct hints for test", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "test" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+K", label: "Commands" },
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
				{ key: "Ctrl+K", label: "Commands" },
			]);
		});

		it("returns default hints for empty page string", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "" }));
			expect(result.current.hints).toEqual([
				{ key: "Ctrl+K", label: "Commands" },
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
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Open" },
			{ key: "Ctrl+N", label: "New" },
			{ key: "Ctrl+K", label: "Commands" },
		]);
	});

	it("returns hints for document", () => {
		expect(getHintsForPage("document")).toEqual([
			{ key: "Ctrl+S", label: "Save" },
			{ key: "Esc", label: "Back" },
			{ key: "Ctrl+K", label: "Commands" },
		]);
	});

	it("returns hints for journal", () => {
		expect(getHintsForPage("journal")).toEqual([
			{ key: "←→", label: "Change date" },
			{ key: "↑↓", label: "Navigate" },
			{ key: "Ctrl+T", label: "Today" },
			{ key: "Ctrl+K", label: "Commands" },
		]);
	});

	it("returns hints for search", () => {
		expect(getHintsForPage("search")).toEqual([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Open" },
			{ key: "Esc", label: "Clear" },
			{ key: "Ctrl+K", label: "Commands" },
		]);
	});

	it("returns hints for settings", () => {
		expect(getHintsForPage("settings")).toEqual([
			{ key: "Esc", label: "Back" },
			{ key: "Ctrl+K", label: "Commands" },
		]);
	});

	it("returns default hints for unknown page", () => {
		expect(getHintsForPage("unknown")).toEqual([
			{ key: "Ctrl+K", label: "Commands" },
		]);
	});
});
