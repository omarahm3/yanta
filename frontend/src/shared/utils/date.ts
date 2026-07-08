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
