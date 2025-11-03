const RTL_RANGES = [
	[0x0600, 0x06ff], // Arabic
	[0x0700, 0x074f], // Syriac
	[0x0750, 0x077f], // Arabic Supplement
	[0x0780, 0x07bf], // Thaana
	[0x07c0, 0x07ff], // N'Ko
	[0x0800, 0x083f], // Samaritan
	[0x0840, 0x085f], // Mandaic
	[0x08a0, 0x08ff], // Arabic Extended-A
	[0xfb50, 0xfdff], // Arabic Presentation Forms-A
	[0xfe70, 0xfeff], // Arabic Presentation Forms-B
];

function isRTLChar(charCode: number): boolean {
	return RTL_RANGES.some(
		([start, end]) => charCode >= start && charCode <= end,
	);
}

export function detectTextDirection(text: string): "ltr" | "rtl" | null {
	if (!text || text.trim().length === 0) return null;

	for (let i = 0; i < text.length; i++) {
		const charCode = text.charCodeAt(i);

		if (
			charCode === 0x0020 ||
			(charCode >= 0x0021 && charCode <= 0x0040) ||
			(charCode >= 0x0030 && charCode <= 0x0039) ||
			(charCode >= 0x005b && charCode <= 0x0060) ||
			(charCode >= 0x007b && charCode <= 0x007e)
		) {
			continue;
		}

		if (isRTLChar(charCode)) return "rtl";
		return "ltr";
	}

	return null;
}

export function getNodeTextContent(node: unknown): string {
	if (!node) return "";

	if (typeof node !== "object") return "";

	const nodeObj = node as Record<string, unknown>;

	if (typeof nodeObj.textContent === "string") return nodeObj.textContent;
	if (typeof nodeObj.text === "string") return nodeObj.text;

	if (nodeObj.content) {
		if (Array.isArray(nodeObj.content)) {
			return nodeObj.content.map(getNodeTextContent).join("");
		}
		if (typeof nodeObj.content === "object") {
			return getNodeTextContent(nodeObj.content);
		}
	}

	return "";
}

export function hasSignificantRTL(text: string): boolean {
	if (!text || text.length === 0) return false;

	let rtlCount = 0;
	let totalChars = 0;

	for (let i = 0; i < text.length; i++) {
		const charCode = text.charCodeAt(i);

		if (
			charCode === 0x0020 ||
			(charCode >= 0x0021 && charCode <= 0x002f) ||
			(charCode >= 0x003a && charCode <= 0x0040) ||
			(charCode >= 0x005b && charCode <= 0x0060) ||
			(charCode >= 0x007b && charCode <= 0x007e)
		) {
			continue;
		}

		totalChars++;
		if (isRTLChar(charCode)) rtlCount++;
	}

	if (totalChars === 0) return false;
	return rtlCount / totalChars >= 0.3;
}
