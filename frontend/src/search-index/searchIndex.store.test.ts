import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexDoc } from "../../bindings/yanta/internal/search/models";
import { ExportIndex } from "../../bindings/yanta/internal/search/service";
import { useSearchIndexStore } from "./searchIndex.store";

vi.mock("../../bindings/yanta/internal/search/service", () => ({
	ExportIndex: vi.fn(),
}));

function doc(partial: Partial<IndexDoc> & { id: string }): IndexDoc {
	return {
		type: "document",
		title: "",
		headings: "",
		body: "",
		code: "",
		tags: "",
		projectAlias: "",
		updated: "2026-07-01",
		...partial,
	} as IndexDoc;
}

const FIXTURES: IndexDoc[] = [
	doc({
		id: "projects/@work/systems.json",
		title: "System Design",
		body: "the system handles books and booking",
		projectAlias: "@work",
		tags: "arch",
		updated: "2026-07-01",
	}),
	doc({
		id: "projects/@home/reading.json",
		title: "Reading List",
		body: "I love books about running systems",
		projectAlias: "@home",
		tags: "hobby",
		updated: "2026-07-02",
	}),
	doc({
		id: "projects/@work/buy.json",
		title: "Books to buy",
		body: "novels and comics",
		projectAlias: "@work",
		tags: "shopping",
		updated: "2026-07-03",
	}),
	doc({
		id: "projects/@work/club.json",
		title: "Reading club",
		body: "bring one book",
		projectAlias: "@work",
		tags: "hobby",
		updated: "2026-07-04",
	}),
	doc({
		id: "journal/@work/2026-07-05/e1",
		type: "note",
		title: "Standup",
		body: "discussed the booking system",
		projectAlias: "@work",
		tags: "meeting",
		updated: "2026-07-05",
		noteId: "e1",
	}),
];

const keys = (items: { key: string }[]) => items.map((i) => i.key);
const search = (q: string) => useSearchIndexStore.getState().search(q);

describe("searchIndex store", () => {
	beforeEach(async () => {
		vi.mocked(ExportIndex).mockResolvedValue(FIXTURES);
		useSearchIndexStore.setState({ status: "idle", index: null, docsById: new Map() });
		await useSearchIndexStore.getState().build();
	});

	it("builds the index from the backend export", () => {
		expect(useSearchIndexStore.getState().status).toBe("ready");
	});

	it("prefix: 'syste' matches 'system'/'systems' (the original bug)", () => {
		const got = keys(search("syste"));
		expect(got).toContain("projects/@work/systems.json");
		expect(got).toContain("projects/@home/reading.json");
	});

	it("prefix: 'book' matches 'books'", () => {
		expect(keys(search("book"))).toContain("projects/@work/buy.json");
	});

	it("fuzzy: plural 'books' still matches singular 'book'", () => {
		expect(keys(search("books"))).toContain("projects/@work/club.json");
	});

	it("fuzzy: typo 'sytem' matches 'system'", () => {
		expect(keys(search("sytem"))).toContain("projects/@work/systems.json");
	});

	it("title matches outrank body matches (field boost)", () => {
		expect(keys(search("books"))[0]).toBe("projects/@work/buy.json");
	});

	it("returns highlighted <mark> snippets", () => {
		const [top] = search("booking");
		expect(top).toBeDefined();
		expect(top.snippets[0]).toContain("<mark>");
		expect(top.snippets[0].toLowerCase()).toContain("booking");
	});

	it("indexes journal notes, not just documents", () => {
		expect(keys(search("standup"))).toContain("journal/@work/2026-07-05/e1");
	});

	it("project: filter narrows results", () => {
		const got = keys(search("system project:@work"));
		expect(got).toContain("projects/@work/systems.json");
		expect(got).not.toContain("projects/@home/reading.json");
	});

	it("tag: filter narrows results", () => {
		expect(keys(search("system tag:arch"))).toEqual(["projects/@work/systems.json"]);
	});

	it("empty query returns nothing", () => {
		expect(search("   ")).toEqual([]);
	});

	it("does not drop a rebuild requested while a build is in progress", async () => {
		// Make ExportIndex hang so a second build() can be requested mid-build.
		let release!: () => void;
		const gate = new Promise<void>((res) => {
			release = res;
		});
		vi.mocked(ExportIndex).mockImplementation(async () => {
			await gate;
			return FIXTURES;
		});
		vi.mocked(ExportIndex).mockClear(); // ignore the beforeEach build's call

		useSearchIndexStore.setState({ status: "idle", index: null, docsById: new Map() });
		const first = useSearchIndexStore.getState().build(); // enters "building", awaits gate
		useSearchIndexStore.getState().build(); // requested during build — must not be dropped
		expect(ExportIndex).toHaveBeenCalledTimes(1);

		release();
		await first;

		// The coalesced rebuild must fire a second export once the first completes.
		await vi.waitFor(() => expect(ExportIndex).toHaveBeenCalledTimes(2));
	});
});
