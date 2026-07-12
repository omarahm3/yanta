/**
 * Pure helpers for counting words and characters in editor text.
 * Used by the document status bar to display word/char counts.
 */

/**
 * Counts words in a text string. Words are separated by whitespace.
 * Returns 0 for empty or whitespace-only strings.
 */
export function countWords(text: string): number {
	if (!text || !text.trim()) return 0;
	return text.trim().split(/\s+/).length;
}

/**
 * Counts characters in a text string, including spaces and punctuation.
 */
export function countChars(text: string): number {
	return text.length;
}
