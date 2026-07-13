import { describe, expect, it } from "vitest";
import { sortExtendedProjects } from "../ProjectsPage";

type Row = { name: string; alias: string; entryCount: number; lastEntry: unknown };

const row = (over: Partial<Row>): Row => ({
	name: "Name",
	alias: "@alias",
	entryCount: 0,
	lastEntry: "-",
	...over,
});

describe("sortExtendedProjects", () => {
	it("sorts by name ascending and descending", () => {
		const list = [row({ name: "Beta" }), row({ name: "Alpha" }), row({ name: "Gamma" })];
		expect(
			sortExtendedProjects(list, { field: "name", direction: "asc" }).map((p) => p.name),
		).toEqual(["Alpha", "Beta", "Gamma"]);
		expect(
			sortExtendedProjects(list, { field: "name", direction: "desc" }).map((p) => p.name),
		).toEqual(["Gamma", "Beta", "Alpha"]);
	});

	it("sorts by entryCount numerically", () => {
		const list = [row({ entryCount: 5 }), row({ entryCount: 1 }), row({ entryCount: 3 })];
		expect(
			sortExtendedProjects(list, { field: "entryCount", direction: "asc" }).map((p) => p.entryCount),
		).toEqual([1, 3, 5]);
	});

	it("orders projects with entries before those without", () => {
		const list = [
			row({ name: "Empty", lastEntry: "-" }),
			row({ name: "Recent", lastEntry: "2026-01-02" }),
			row({ name: "Older", lastEntry: "2026-01-01" }),
		];
		const sorted = sortExtendedProjects(list, { field: "lastEntry", direction: "desc" });
		expect(sorted.map((p) => p.name)).toEqual(["Recent", "Older", "Empty"]);
	});

	it("keeps a valid strict weak ordering when all lastEntry values are missing", () => {
		// A broken comparator (return 1 for every pair) throws in V8 under sort();
		// with the tie returning 0 this must simply preserve a stable order.
		const list = Array.from({ length: 12 }, (_, i) => row({ name: `P${i}`, lastEntry: "-" }));
		const names = list.map((p) => p.name);
		expect(
			sortExtendedProjects(list, { field: "lastEntry", direction: "asc" }).map((p) => p.name),
		).toEqual(names);
	});

	it("does not mutate the input array", () => {
		const list = [row({ name: "B" }), row({ name: "A" })];
		const before = list.map((p) => p.name);
		sortExtendedProjects(list, { field: "name", direction: "asc" });
		expect(list.map((p) => p.name)).toEqual(before);
	});
});
