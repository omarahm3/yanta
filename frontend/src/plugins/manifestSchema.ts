import { z } from "zod";
import type { PluginCapability, PluginManifest } from "./types";

const PLUGIN_CAPABILITIES = [
	"commands",
	"sidebar",
	"editorExtensions",
	"editorTipTapExtensions",
	"editorBlockSpecs",
	"editorStyleSpecs",
	"editorSlashMenu",
	"editorTools",
	"editorBlockActions",
	"editorLifecycle",
	"settings",
] as const satisfies readonly PluginCapability[];

const pluginManifestSchema = z.object({
	id: z
		.string()
		.trim()
		.min(1)
		.regex(/^[a-zA-Z0-9._-]+$/, "id may only contain letters, digits, '.', '_' and '-'"),
	name: z.string().trim().min(1),
	version: z.string().trim().min(1),
	apiVersion: z.string().trim().min(1),
	entry: z.string().trim().min(1),
	capabilities: z.array(z.enum(PLUGIN_CAPABILITIES)).default([]),
	description: z.string().optional(),
	author: z.string().optional(),
	homepage: z.string().optional(),
});

export type PluginManifestParseResult =
	| { success: true; manifest: PluginManifest }
	| { success: false; error: string };

/**
 * Validates a plugin manifest at the frontend boundary before its declared
 * capabilities are trusted. The backend validates too, but the frontend is what
 * grants the capability-scoped API, so it re-validates rather than casting the
 * cross-boundary record.
 */
export function safeParsePluginManifest(input: unknown): PluginManifestParseResult {
	const result = pluginManifestSchema.safeParse(input);
	if (result.success) {
		return { success: true, manifest: result.data };
	}
	const error = result.error.issues
		.map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`)
		.join("; ");
	return { success: false, error };
}
