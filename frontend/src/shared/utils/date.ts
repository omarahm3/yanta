import { format, formatDistanceToNow, isValid } from "date-fns";

/**
 * Local-date helpers for journal navigation.
 *
 * Journal dates are `YYYY-MM-DD` strings representing a calendar day in the
 * user's LOCAL timezone. `new Date("YYYY-MM-DD")` parses as UTC midnight, which
 * disagrees with local getters in UTC-negative timezones and shifts the day.
 * These helpers parse, format, and step dates entirely in local time so
 * navigation, the DatePicker, hotkeys, and the palette all agree on "today".
 */

/** Format a Date as a local `YYYY-MM-DD` string. */
export function formatLocalDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Today's calendar day in the local timezone, as `YYYY-MM-DD`. */
export function todayLocalString(): string {
	return formatLocalDateString(new Date());
}

/** Parse a `YYYY-MM-DD` string to a Date at LOCAL midnight (not UTC). */
export function parseLocalDate(dateStr: string): Date {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Step a `YYYY-MM-DD` string by `delta` days, staying in local time. */
export function addDaysLocalString(dateStr: string, delta: number): string {
	const date = parseLocalDate(dateStr);
	date.setDate(date.getDate() + delta);
	return formatLocalDateString(date);
}

// TODO: this function is manual, replace with external library
export function formatRelativeTime(dateString: string): string {
	if (!dateString) return "Never";

	const date = new Date(dateString);
	if (!isValid(date)) return "Unknown";

	const result = formatDistanceToNow(date, { addSuffix: true });

	return result
		.replace("about ", "")
		.replace(" minutes", "m")
		.replace(" minute", "m")
		.replace(" hours", "h")
		.replace(" hour", "h")
		.replace(" days", "d")
		.replace(" day", "d")
		.replace(" weeks", "w")
		.replace(" week", "w")
		.replace(" months", "mo")
		.replace(" month", "mo")
		.replace(" years", "y")
		.replace(" year", "y")
		.replace("less than a minute", "Just now");
}

const WEEK_START_FALLBACK: Record<string, 0 | 1 | 6> = {
	en: 0,
	"en-US": 0,
	"en-GB": 1,
	de: 1,
	fr: 1,
	es: 1,
	it: 1,
	pt: 1,
	nl: 1,
	ru: 1,
	ja: 0,
	"zh-CN": 1,
	ko: 0,
	ar: 6,
};

export function getLocaleWeekStart(): 0 | 1 | 6 {
	// navigator is undefined in non-browser environments (SSR/tests); guard it.
	const lang = typeof navigator !== "undefined" ? navigator.language : "";
	if (!lang) return 0;

	try {
		const locale = new Intl.Locale(lang);
		const weekInfo = (
			locale as Intl.Locale & { getWeekInfo?: () => { firstDay: number } }
		).getWeekInfo?.();
		if (weekInfo && typeof weekInfo.firstDay === "number") {
			const day = weekInfo.firstDay;
			if (day === 0 || day === 1 || day === 6) return day as 0 | 1 | 6;
			if (day >= 2 && day <= 5) return 1;
			return 0;
		}
	} catch {}

	const short = lang.split("-")[0];
	if (lang in WEEK_START_FALLBACK) return WEEK_START_FALLBACK[lang];
	if (short in WEEK_START_FALLBACK) return WEEK_START_FALLBACK[short];
	return 0;
}

export function formatShortDate(dateString: string): string {
	if (!dateString) return "Unknown";

	const date = new Date(dateString);
	if (!isValid(date)) return "Unknown";

	return format(date, "MMM d");
}

// TODO: this function is manual, replace with external library
export function formatRelativeTimeFromTimestamp(timestamp: number): string {
	if (!timestamp) return "Never";

	const date = new Date(timestamp);
	if (!isValid(date)) return "Unknown";

	const result = formatDistanceToNow(date, { addSuffix: true });

	return result
		.replace("about ", "")
		.replace(" minutes", " min")
		.replace(" minute", " min")
		.replace(" hours", "h")
		.replace(" hour", "h")
		.replace(" days", "d")
		.replace(" day", "d")
		.replace(" weeks", "w")
		.replace(" week", "w")
		.replace(" months", "mo")
		.replace(" month", "mo")
		.replace("less than a minute", "Just now");
}
