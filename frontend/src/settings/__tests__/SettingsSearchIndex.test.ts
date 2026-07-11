import { describe, expect, it } from "vitest";
import { type SettingsSectionEntry, sectionMatchesQuery } from "../hooks/useSettingsPage";

describe("Settings search indexes individual rows (MRG-364)", () => {
	it("matches section by label", () => {
		const section: SettingsSectionEntry = {
			id: "general",
			label: "General",
			keywords: "window background startup hidden linux",
		};
		expect(sectionMatchesQuery(section, "general")).toBe(true);
		expect(sectionMatchesQuery(section, "gen")).toBe(true);
	});

	it("matches section by keywords", () => {
		const section: SettingsSectionEntry = {
			id: "general",
			label: "General",
			keywords: "window background startup hidden linux",
		};
		expect(sectionMatchesQuery(section, "window")).toBe(true);
		expect(sectionMatchesQuery(section, "linux")).toBe(true);
	});

	it("matches section by row title", () => {
		const section: SettingsSectionEntry = {
			id: "general",
			label: "General",
			keywords: "window background startup hidden linux",
		};
		expect(sectionMatchesQuery(section, "frameless")).toBe(true);
		expect(sectionMatchesQuery(section, "background")).toBe(true);
	});

	it("matches section by row description", () => {
		const section: SettingsSectionEntry = {
			id: "general",
			label: "General",
			keywords: "window background startup hidden linux",
		};
		expect(sectionMatchesQuery(section, "borders")).toBe(true);
		expect(sectionMatchesQuery(section, "title bar")).toBe(true);
	});

	it("matches Storage section by database-related row content", () => {
		const section: SettingsSectionEntry = {
			id: "database",
			label: "Storage",
			keywords: "storage database reindex search index data",
		};
		expect(sectionMatchesQuery(section, "reindex")).toBe(true);
		expect(sectionMatchesQuery(section, "json")).toBe(true);
		expect(sectionMatchesQuery(section, "documents")).toBe(true);
	});

	it("matches Diagnostics section by log-related row content", () => {
		const section: SettingsSectionEntry = {
			id: "logging",
			label: "Diagnostics",
			keywords: "diagnostics log level debug verbose troubleshooting",
		};
		expect(sectionMatchesQuery(section, "debug")).toBe(true);
		expect(sectionMatchesQuery(section, "verbosity")).toBe(true);
	});

	it("matches Appearance section by control-specific queries", () => {
		const section: SettingsSectionEntry = {
			id: "appearance",
			label: "Appearance",
			keywords: "theme dark light density scale sidebar hints tooltips effects glass",
		};
		expect(sectionMatchesQuery(section, "density")).toBe(true);
		expect(sectionMatchesQuery(section, "compact")).toBe(true);
		expect(sectionMatchesQuery(section, "zoom")).toBe(true);
		expect(sectionMatchesQuery(section, "percentage")).toBe(true);
	});

	it("matches MCP section by token-related queries", () => {
		const section: SettingsSectionEntry = {
			id: "mcp",
			label: "MCP Server",
			keywords: "mcp model context protocol agent claude codex opencode integration api",
		};
		expect(sectionMatchesQuery(section, "token")).toBe(true);
		expect(sectionMatchesQuery(section, "api key")).toBe(true);
		expect(sectionMatchesQuery(section, "port")).toBe(true);
	});

	it("does not match when query is unrelated", () => {
		const section: SettingsSectionEntry = {
			id: "general",
			label: "General",
			keywords: "window background startup hidden linux",
		};
		expect(sectionMatchesQuery(section, "xyz123")).toBe(false);
		expect(sectionMatchesQuery(section, "quantum")).toBe(false);
	});

	it("is case-insensitive", () => {
		const section: SettingsSectionEntry = {
			id: "appearance",
			label: "Appearance",
			keywords: "theme dark light",
		};
		expect(sectionMatchesQuery(section, "THEME")).toBe(true);
		expect(sectionMatchesQuery(section, "Dark")).toBe(true);
	});
});
