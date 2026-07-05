import { FileText, NotebookPen } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Preview } from "../../bindings/yanta/internal/document/service";
import { BackendLogger } from "../shared/utils/backendLogger";
import type { FinderItem } from "./types";

// Lazy so BlockNote stays out of the eager startup bundle — it loads the first
// time a document preview is shown, not on app boot.
const DocumentPreview = lazy(() =>
	import("./DocumentPreview").then((m) => ({ default: m.DocumentPreview })),
);

/** Small debounce so fast arrowing through results doesn't fetch a preview per row. */
const PREVIEW_DEBOUNCE_MS = 110;

type PreviewStatus = "idle" | "loading" | "error";

interface GlobalSearchPreviewProps {
	item: FinderItem | undefined;
}

/**
 * The right-hand preview pane. Documents are rendered as static HTML produced by
 * BlockNote's headless `blocksToHTMLLossy` exporter (no live editor is mounted —
 * see DocumentPreview), so previews are cheap and can't crash the finder. Notes
 * are short, so they reuse the highlighted snippets already returned by search.
 */
export function GlobalSearchPreview({ item }: GlobalSearchPreviewProps) {
	const [content, setContent] = useState<string | null>(null);
	const [status, setStatus] = useState<PreviewStatus>("idle");
	const cacheRef = useRef<Map<string, string>>(new Map());

	const isNote = item?.type === "note";
	const path = item?.path;

	useEffect(() => {
		if (!path || isNote) {
			setContent(null);
			setStatus("idle");
			return;
		}

		const cached = cacheRef.current.get(path);
		if (cached !== undefined) {
			setContent(cached);
			setStatus("idle");
			return;
		}

		let cancelled = false;
		setContent(null);
		setStatus("loading");
		const timer = setTimeout(async () => {
			try {
				const blocks = await Preview(path);
				if (cancelled) return;
				cacheRef.current.set(path, blocks);
				setContent(blocks);
				setStatus("idle");
			} catch (err) {
				if (cancelled) return;
				BackendLogger.error("[GlobalSearch] preview failed:", err);
				setContent(null);
				setStatus("error");
			}
		}, PREVIEW_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [path, isNote]);

	if (!item) {
		return (
			<div className="flex h-full items-center justify-center px-6 text-center text-sm text-text-dim">
				Select a result to preview it here.
			</div>
		);
	}

	const alias = item.projectAlias.replace(/^@+/, "");

	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0 border-b border-border px-4 py-3">
				<div className="mb-1.5 flex items-center gap-2 text-[11px]">
					<span
						className={
							isNote
								? "inline-flex items-center gap-1 rounded bg-purple/15 px-1.5 py-0.5 font-medium text-purple"
								: "inline-flex items-center gap-1 rounded bg-accent/15 px-1.5 py-0.5 font-medium text-accent"
						}
					>
						{isNote ? (
							<NotebookPen className="size-3" aria-hidden="true" />
						) : (
							<FileText className="size-3" aria-hidden="true" />
						)}
						{isNote ? "Note" : "Document"}
					</span>
					{alias && <span className="font-mono font-medium text-purple">@{alias}</span>}
					{item.updated && <span className="text-text-dim">{item.updated}</span>}
					{item.matchCount > 1 && (
						<span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">
							{item.matchCount} matches
						</span>
					)}
				</div>
				<div className="truncate font-medium text-text-bright" title={item.title}>
					{item.title || "Untitled"}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-hidden">
				<PreviewBody item={item} content={content} status={status} />
			</div>
		</div>
	);
}

function PreviewBody({
	item,
	content,
	status,
}: {
	item: FinderItem;
	content: string | null;
	status: PreviewStatus;
}) {
	if (item.type === "note") {
		if (item.snippets.length === 0) {
			return <p className="px-4 py-3 text-sm text-text-dim">No preview available for this note.</p>;
		}
		return (
			<div className="h-full space-y-2 overflow-y-auto px-4 py-3 text-sm leading-relaxed [&_mark]:rounded [&_mark]:bg-yellow/20 [&_mark]:px-0.5 [&_mark]:font-semibold [&_mark]:text-yellow">
				{item.snippets.map((snippet, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: snippets are unique within a note
						key={index}
						// biome-ignore lint/security/noDangerouslySetInnerHtml: snippet HTML is trusted backend content with highlight marks only
						dangerouslySetInnerHTML={{ __html: snippet }}
					/>
				))}
			</div>
		);
	}

	if (status === "error") {
		return <p className="px-4 py-3 text-sm text-red">Couldn’t load this document’s preview.</p>;
	}

	if (!content) {
		return <p className="px-4 py-3 text-sm text-text-dim">Loading preview…</p>;
	}

	return (
		<Suspense fallback={<p className="px-4 py-3 text-sm text-text-dim">Loading preview…</p>}>
			<DocumentPreview blocksJson={content} />
		</Suspense>
	);
}
