import type React from "react";
import { Skeleton } from "../../shared/ui/Skeleton";

const ROW_COUNT = 8;

// Vary the title widths a little so rows don't read as a rigid grid.
const TITLE_WIDTHS = ["w-1/2", "w-2/3", "w-2/5", "w-3/5", "w-1/2", "w-3/4", "w-2/5", "w-3/5"];

interface DocumentListSkeletonProps {
	rows?: number;
}

/**
 * Placeholder for {@link DocumentList} while documents load. Mirrors the
 * DocumentListItem layout (toggle, index, title, meta, tags) so the real list
 * swaps in without any layout shift.
 */
export const DocumentListSkeleton: React.FC<DocumentListSkeletonProps> = ({ rows = ROW_COUNT }) => {
	return (
		<div className="space-y-1" role="status" aria-label="Loading documents" aria-busy="true">
			{Array.from({ length: rows }).map((_, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows have no stable id
					key={index}
					className="border-b border-glass-border/50 border-l-4 border-l-transparent px-4 py-4"
				>
					<div className="flex items-start gap-3">
						<Skeleton className="mt-1 h-5 w-5 shrink-0" />
						<Skeleton className="mt-1 h-4 w-4 shrink-0" />
						<div className="flex-1">
							<Skeleton className={`h-6 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`} />
							<div className="mt-2 flex gap-4">
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-4 w-24" />
							</div>
							<div className="mt-2 flex gap-2">
								<Skeleton className="h-6 w-14 rounded" />
								<Skeleton className="h-6 w-12 rounded" />
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
};
