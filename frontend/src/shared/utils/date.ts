import { format, formatDistanceToNow, isValid } from "date-fns";

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
