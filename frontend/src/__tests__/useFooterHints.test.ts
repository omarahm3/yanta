import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getGlobalFooterHints, getHintsForPage, useFooterHints } from "../shared/hooks";

describe("useFooterHints", () => {
	describe("Dashboard page hints", () => {
		it("returns base hints for dashboard without selection", () => {
			const { result } = renderHook(() =>
				useFooterHints({ currentPage: "dashboard", documentCount: 5 }),
			);
			const keys = result.current.hints.map((h) => h.key);
			expect(keys).toContain("↑↓");
			expect(keys).toContain("ENTER");
			expect(keys).toContain("SPACE");
			expect(keys).toContain("Ctrl+N");
			expect(keys).toContain("Ctrl+A");
		});

		it("hides selection-dependent hints when nothing is selected", () => {
			const { result } = renderHook(() =>
				useFooterHints({ currentPage: "dashboard", hasSelection: false, documentCount: 5 }),
			);
			const labels = result.current.hints.map((h) => h.label);
			expect(labels).not.toContain("Move");
			expect(labels).not.toContain("Restore");
			expect(labels).not.toContain("Export MD");
		});

		it("shows selection-dependent hints when items are selected", () => {
			const { result } = renderHook(() =>
				useFooterHints({ currentPage: "dashboard", hasSelection: true, documentCount: 5 }),
			);
			const labels = result.current.hints.map((h) => h.label);
			expect(labels).toContain("Move");
			expect(labels).toContain("Restore");
			expect(labels).toContain("Export MD");
		});

		it("includes navigation hint for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints.some((h) => h.key === "↑↓" && h.label === "Navigate")).toBe(true);
		});

		it("includes new document hint for dashboard", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "dashboard" }));
			expect(result.current.hints.some((h) => h.key === "Ctrl+N" && h.label === "New")).toBe(true);
		});
	});

	describe("Document page hints", () => {
		it("returns correct hints for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			const keys = result.current.hints.map((h) => h.key);
			expect(keys).toContain("Ctrl+S");
			expect(keys).toContain("ESC");
			expect(keys).toContain("ENTER");
			expect(keys).toContain("Ctrl+E");
			expect(keys).toContain("Ctrl+\\");
		});

		it("includes save hint for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints.some((h) => h.key === "Ctrl+S" && h.label === "Save")).toBe(true);
		});

		it("includes back/escape hint for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints.some((h) => h.key === "ESC" && h.label === "Back")).toBe(true);
		});

		it("includes export hint for document", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "document" }));
			expect(result.current.hints.some((h) => h.key === "Ctrl+E" && h.label === "Export MD")).toBe(
				true,
			);
		});
	});

	describe("Journal page hints", () => {
		it("returns base hints for journal without selection", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			const keys = result.current.hints.map((h) => h.key);
			expect(keys).toContain("←→");
			expect(keys).toContain("↑↓");
			expect(keys).toContain("SPACE");
		});

		it("includes date change hint for journal", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "journal" }));
			expect(result.current.hints.some((h) => h.key === "←→" && h.label === "Change date")).toBe(true);
		});

		it("shows promote hint when entries are selected", () => {
			const { result } = renderHook(() =>
				useFooterHints({ currentPage: "journal", hasSelection: true }),
			);
			expect(result.current.hints.some((h) => h.label === "Promote")).toBe(true);
		});

		it("hides promote hint when nothing is selected", () => {
			const { result } = renderHook(() =>
				useFooterHints({ currentPage: "journal", hasSelection: false }),
			);
			expect(result.current.hints.some((h) => h.label === "Promote")).toBe(false);
		});
	});

	describe("Search page hints", () => {
		it("returns correct hints for search", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "search" }));
			const keys = result.current.hints.map((h) => h.key);
			expect(keys).toContain("/");
			expect(keys).toContain("↑↓");
			expect(keys).toContain("ENTER");
			expect(keys).toContain("TAB");
		});

		it("includes focus search hint", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "search" }));
			expect(result.current.hints.some((h) => h.key === "/" && h.label === "Focus search")).toBe(true);
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
		it("returns base hints for projects without selection", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "projects" }));
			const keys = result.current.hints.map((h) => h.key);
			expect(keys).toContain("↑↓");
			expect(keys).toContain("ENTER");
			expect(keys).toContain("Ctrl+N");
		});

		it("hides restore hint when nothing is selected", () => {
			const { result } = renderHook(() =>
				useFooterHints({ currentPage: "projects", hasSelection: false }),
			);
			expect(result.current.hints.some((h) => h.label === "Restore")).toBe(false);
		});

		it("shows restore hint when items are selected", () => {
			const { result } = renderHook(() =>
				useFooterHints({ currentPage: "projects", hasSelection: true }),
			);
			expect(result.current.hints.some((h) => h.label === "Restore")).toBe(true);
		});
	});

	describe("Quick capture page hints", () => {
		it("returns correct hints for quick-capture", () => {
			const { result } = renderHook(() => useFooterHints({ currentPage: "quick-capture" }));
			const keys = result.current.hints.map((h) => h.key);
			expect(keys).toContain("Ctrl+ENTER");
			expect(keys).toContain("Shift+ENTER");
			expect(keys).toContain("ESC");
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
		expect(hints.some((h) => h.label === "Navigate")).toBe(true);
		expect(hints.some((h) => h.label === "New")).toBe(true);
	});

	it("returns hints for document", () => {
		const hints = getHintsForPage("document");
		expect(hints.some((h) => h.key === "Ctrl+S")).toBe(true);
		expect(hints.some((h) => h.key === "ESC")).toBe(true);
		expect(hints.some((h) => h.key === "Ctrl+E")).toBe(true);
	});

	it("returns hints for journal", () => {
		const hints = getHintsForPage("journal");
		expect(hints.some((h) => h.key === "←→")).toBe(true);
		expect(hints.some((h) => h.label === "Navigate")).toBe(true);
	});

	it("returns hints for search", () => {
		const hints = getHintsForPage("search");
		expect(hints.some((h) => h.key === "/")).toBe(true);
		expect(hints.some((h) => h.key === "TAB")).toBe(true);
	});

	it("returns hints for settings", () => {
		const hints = getHintsForPage("settings");
		expect(hints.some((h) => h.key === "j/k")).toBe(true);
	});

	it("returns hints for projects", () => {
		const hints = getHintsForPage("projects");
		expect(hints.some((h) => h.key === "Ctrl+N")).toBe(true);
		expect(hints.some((h) => h.label === "Navigate")).toBe(true);
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
		expect(getHintsForPage("dashboard").find((h) => h.label === "Navigate")?.priority).toBe(1);
		expect(getHintsForPage("document").find((h) => h.label === "Save")?.priority).toBe(1);
		expect(getHintsForPage("journal").find((h) => h.label === "Change date")?.priority).toBe(1);
		expect(getHintsForPage("search").find((h) => h.label === "Navigate")?.priority).toBe(1);
		expect(getHintsForPage("settings").find((h) => h.label === "Navigate sections")?.priority).toBe(
			1,
		);
		expect(getHintsForPage("quick-capture").find((h) => h.label === "Save")?.priority).toBe(1);
	});
});

describe("getGlobalFooterHints", () => {
	it("always surfaces the command palette and help entry points", () => {
		const hints = getGlobalFooterHints();
		expect(hints.some((h) => h.label === "Commands")).toBe(true);
		expect(hints.some((h) => h.label === "Help")).toBe(true);
	});

	it("renders all global hints at priority 1", () => {
		for (const hint of getGlobalFooterHints()) {
			expect(hint.priority).toBe(1);
		}
	});

	it("uses the platform-aware command-palette key (Ctrl+K off macOS)", () => {
		const commands = getGlobalFooterHints().find((h) => h.label === "Commands");
		expect(commands?.key).toBe("Ctrl+K");
	});
});
