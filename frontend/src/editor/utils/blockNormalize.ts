const IMAGE_URL_RE = /\.(png|jpg|jpeg|gif|webp)$/i;

/** True if a file URL points at an inline-renderable image (drives file→image upgrade). */
export function isImageFileUrl(url: string): boolean {
	return IMAGE_URL_RE.test(url);
}

/** True if the document is missing its required leading H1 title block. */
export function needsLeadingH1(blocks: Array<{ type?: string; props?: unknown }>): boolean {
	if (!Array.isArray(blocks) || blocks.length === 0) {
		return true;
	}
	const first = blocks[0];
	if (!first) {
		return true;
	}
	if (first.type !== "heading") {
		return true;
	}
	return (first.props as { level?: number } | undefined)?.level !== 1;
}
