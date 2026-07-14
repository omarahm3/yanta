import { describe, expect, it } from "vitest";
import {
	addDaysLocalString,
	formatLocalDateString,
	getLocaleWeekStart,
	parseLocalDate,
	todayLocalString,
} from "../date";

describe("local-date helpers", () => {
	it("parseLocalDate parses YYYY-MM-DD at local midnight (no UTC shift)", () => {
		const d = parseLocalDate("2026-01-15");
		// Local getters must agree with the input regardless of the runner's TZ.
		expect(d.getFullYear()).toBe(2026);
		expect(d.getMonth()).toBe(0); // January
		expect(d.getDate()).toBe(15);
		expect(d.getHours()).toBe(0);
	});

	it("formatLocalDateString round-trips with parseLocalDate", () => {
		expect(formatLocalDateString(parseLocalDate("2026-07-04"))).toBe("2026-07-04");
		expect(formatLocalDateString(parseLocalDate("2025-12-31"))).toBe("2025-12-31");
	});

	it("addDaysLocalString steps forward and back without drifting", () => {
		expect(addDaysLocalString("2026-01-15", 1)).toBe("2026-01-16");
		expect(addDaysLocalString("2026-01-15", -1)).toBe("2026-01-14");
	});

	it("addDaysLocalString crosses month and year boundaries", () => {
		expect(addDaysLocalString("2026-01-31", 1)).toBe("2026-02-01");
		expect(addDaysLocalString("2026-12-31", 1)).toBe("2027-01-01");
		expect(addDaysLocalString("2026-03-01", -1)).toBe("2026-02-28");
	});

	it("todayLocalString matches the local calendar day", () => {
		const now = new Date();
		expect(todayLocalString()).toBe(formatLocalDateString(now));
		// And it is a well-formed YYYY-MM-DD.
		expect(todayLocalString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("getLocaleWeekStart returns a valid day (0, 1, or 6)", () => {
		const day = getLocaleWeekStart();
		expect([0, 1, 6]).toContain(day);
	});
});
