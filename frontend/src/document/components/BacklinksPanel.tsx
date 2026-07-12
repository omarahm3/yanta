import { Link } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { useSearchIndexStore } from "../../search-index/searchIndex.store";
import { cn } from "../../shared/utils/cn";

interface BacklinksPanelProps {
	documentPath: string;
	isOpen: boolean;
	onClose: () => void;
	onNavigate?: (path: string) => void;
}

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
	documentPath,
	isOpen,
	onClose,
	onNavigate,
}) => {
	const docsById = useSearchIndexStore((s) => s.docsById);
	const status = useSearchIndexStore((s) => s.status);

	const backlinks = useMemo(() => {
		if (status !== "ready" || !documentPath) return [];

		const linkingDocs: { path: string; title: string }[] = [];
		for (const doc of docsById.values()) {
			if (doc.id === documentPath) continue;
			if (doc.body?.includes(`[[${documentPath}]]`)) {
				linkingDocs.push({
					path: doc.id,
					title: doc.title || "Untitled",
				});
			}
		}
		return linkingDocs.slice(0, 20);
	}, [docsById, status, documentPath]);

	if (!isOpen) return null;

	return (
		<div className="w-64 border-l border-glass-border bg-glass-bg/30 backdrop-blur-sm flex flex-col">
			<div className="flex items-center justify-between px-3 py-2 border-b border-glass-border/50">
				<div className="flex items-center gap-2 text-sm font-medium text-text">
					<Link className="w-4 h-4" aria-hidden="true" />
					Linked References
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-text-dim hover:text-text-bright transition-colors text-xs"
					aria-label="Close backlinks"
				>
					×
				</button>
			</div>
			<div className="flex-1 overflow-y-auto px-2 py-2">
				{backlinks.length === 0 ? (
					<div className="text-xs text-text-dim px-2 py-4 text-center">
						No documents link to this one yet.
					</div>
				) : (
					<nav aria-label="Backlinks">
						<ul className="space-y-1">
							{backlinks.map((backlink) => (
								<li key={backlink.path}>
									<button
										type="button"
										onClick={() => onNavigate?.(backlink.path)}
										className={cn(
											"w-full text-left px-2 py-1 rounded text-sm transition-colors hover:bg-glass-bg/50 text-text-dim",
										)}
										title={backlink.title}
									>
										{backlink.title}
									</button>
								</li>
							))}
						</ul>
					</nav>
				)}
			</div>
		</div>
	);
};
