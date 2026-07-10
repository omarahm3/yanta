import { describe, expect, it } from "vitest";
import { DASHBOARD_SHORTCUTS } from "../config/shortcuts";

describe("Dashboard shortcuts — archive/delete truth (MRG-338)", () => {
	it("has no softDelete shortcut (collapsed into archive)", () => {
		expect("softDelete" in DASHBOARD_SHORTCUTS).toBe(false);
	});

	it("archive shortcut is bound to mod+D (formerly soft-delete key)", () => {
		expect(DASHBOARD_SHORTCUTS.archive.key).toBe("mod+D");
		expect(DASHBOARD_SHORTCUTS.archive.description).toMatch(/archive/i);
	});

	it("permanentDelete shortcut remains at mod+shift+D", () => {
		expect(DASHBOARD_SHORTCUTS.permanentDelete.key).toBe("mod+shift+D");
	});
});
