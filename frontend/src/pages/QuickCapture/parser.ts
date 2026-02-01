/**
 * Parser for Quick Capture inline syntax (#tag, @project)
 * Based on PRD Section 3.7 parsing rules
 */

export interface ParseResult {
	content: string;
	project: string | null;
	tags: string[];
}

// Match tags: # followed by word chars (letters, numbers, underscore)
// Must be at start of string or preceded by whitespace
// Does not match ## (headings) or c# style
const TAG_REGEX = /(?:^|\s)#([\w_]+)/g;

// Match projects: @ followed by word chars and hyphens
// Must be at start of string or preceded by whitespace
// Does not match email@domain patterns
const PROJECT_REGEX = /(?:^|\s)@([\w-]+)(?=\s|$)/g;

/**
 * Extract all #tags from text
 */
export function parseTags(text: string): string[] {
	const tags: string[] = [];
	const seen = new Set<string>();

	let match: RegExpExecArray | null;
	const regex = new RegExp(TAG_REGEX.source, "g");

	while ((match = regex.exec(text)) !== null) {
		const tag = match[1];
		if (!seen.has(tag)) {
			seen.add(tag);
			tags.push(tag);
		}
	}

	return tags;
}

/**
 * Extract @project from text (last one wins if multiple)
 */
export function parseProject(text: string): string | null {
	let project: string | null = null;
	let match: RegExpExecArray | null;
	const regex = new RegExp(PROJECT_REGEX.source, "g");

	while ((match = regex.exec(text)) !== null) {
		project = match[1];
	}

	return project;
}

/**
 * Remove #tags and @project markers from text, return clean content
 */
export function parseContent(text: string): string {
	// Remove @project markers
	let content = text.replace(/(?:^|\s)@[\w-]+(?=\s|$)/g, " ");
	// Remove #tag markers
	content = content.replace(/(?:^|\s)#[\w_]+/g, " ");
	// Clean up multiple spaces (but preserve newlines) and trim
	return content
		.split("\n")
		.map((line) => line.replace(/\s+/g, " ").trim())
		.join("\n")
		.trim();
}

/**
 * Parse full input and extract all components
 */
export function parse(text: string): ParseResult {
	return {
		content: parseContent(text),
		project: parseProject(text),
		tags: parseTags(text),
	};
}
