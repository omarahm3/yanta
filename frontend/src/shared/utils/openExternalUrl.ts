import { Browser } from "@wailsio/runtime";

export const ALLOWED_EXTERNAL_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"] as const;

const ALLOWED_PROTOCOL_SET = new Set<string>(ALLOWED_EXTERNAL_PROTOCOLS);

export type OpenExternalUrlResult =
	| { ok: true; url: string }
	| { ok: false; url?: string; error: Error };

function normalizeError(err: unknown): Error {
	return err instanceof Error ? err : new Error(String(err));
}

function getDefaultBaseUrl(): string {
	if (typeof window !== "undefined" && window.location?.href) {
		return window.location.href;
	}
	return "http://localhost/";
}

export function resolveExternalUrl(rawUrl: string, baseUrl: string = getDefaultBaseUrl()): URL | null {
	let resolvedUrl: URL;
	try {
		resolvedUrl = new URL(rawUrl, baseUrl);
	} catch {
		return null;
	}

	if (!ALLOWED_PROTOCOL_SET.has(resolvedUrl.protocol)) {
		return null;
	}

	return resolvedUrl;
}

export async function openExternalUrl(
	rawUrl: string,
	baseUrl: string = getDefaultBaseUrl(),
): Promise<OpenExternalUrlResult> {
	const resolvedUrl = resolveExternalUrl(rawUrl, baseUrl);
	if (!resolvedUrl) {
		return {
			ok: false,
			error: new Error("Unsupported or invalid URL."),
		};
	}

	try {
		await Browser.OpenURL(resolvedUrl.href);
		return {
			ok: true,
			url: resolvedUrl.href,
		};
	} catch (err) {
		return {
			ok: false,
			url: resolvedUrl.href,
			error: normalizeError(err),
		};
	}
}
