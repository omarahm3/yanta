import { FileText, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Preview } from "../../bindings/yanta/internal/document/service";
import { BackendLogger } from "../shared/utils/backendLogger";
import { highlightTerms } from "./highlight";
import type { FinderItem } from "./types";

/** Small debounce so fast arrowing through results doesn't fire a fetch per row. */
const PREVIEW_DEBOUNCE_MS = 110;

type PreviewStatus = "idle" | "loading" | "error";

interface GlobalSearchPreviewProps {
	item: FinderItem | undefined;
	/** Query terms to highlight in the document body. */
	terms: string[];
}

/**
 * The right-hand preview pane. For documents it shows the file rendered to
 * Markdown (the raw source, honouring "the UI never obscures the underlying
 * files"), with matches highlighted and the first one scrolled into view. Notes
 * are short, so they reuse the highlighted snippets already returned by search.
 */
export function GlobalSearchPreview({ item, terms }: GlobalSearchPreviewProps) {
	const [content, setContent] = useState<string | null>(null);
	const [status, setStatus] = useState<PreviewStatus>("idle");
	const cacheRef = useRef<Map<string, string>>(new Map());
	const bodyRef = useRef<HTMLDivElement>(null);

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
		setStatus("loading");
		const timer = setTimeout(async () => {
			try {
				const markdown = await Preview(path);
				if (cancelled) return;
				cacheRef.current.set(path, markdown);
				setContent(markdown);
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

	// Bring the first highlighted match into view once content settles.
	useEffect(() => {
		const mark = bodyRef.current?.querySelector("mark");
		mark?.scrollIntoView({ block: "center" });
	}, [content]);

	if (!item) {
		return (
			<div className="flex h-full items-center justify-center px-6 text-center text-sm text-text-dim">
				Select a result to preview it here.
			</div>
		);
	}

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
					{item.projectAlias && (
						<span className="font-mono font-medium text-purple">@{item.projectAlias}</span>
					)}
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
				<div className="truncate font-mono text-xs text-text-dim" title={item.path}>
					{item.path}
				</div>
			</div>

			<div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				<PreviewBody item={item} content={content} status={status} terms={terms} />
			</div>
		</div>
	);
}

function PreviewBody({
	item,
	content,
	status,
	terms,
}: {
	item: FinderItem;
	content: string | null;
	status: PreviewStatus;
	terms: string[];
}) {
	if (item.type === "note") {
		if (item.snippets.length === 0) {
			return <p className="text-sm text-text-dim">No preview available for this note.</p>;
		}
		return (
			<div className="space-y-2 text-sm leading-relaxed [&_mark]:rounded [&_mark]:bg-yellow/20 [&_mark]:px-0.5 [&_mark]:font-semibold [&_mark]:text-yellow">
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

	if (status === "loading" && content === null) {
		return <p className="text-sm text-text-dim">Loading preview…</p>;
	}

	if (status === "error") {
		return <p className="text-sm text-red">Couldn’t load this document’s preview.</p>;
	}

	if (!content || content.trim() === "") {
		return <p className="text-sm text-text-dim">This document is empty.</p>;
	}

	return (
		<pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-text">
			{highlightTerms(content, terms)}
		</pre>
	);
}
