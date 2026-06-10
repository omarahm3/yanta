import type React from "react";
import { Skeleton } from "../shared/ui/Skeleton";

const CARD_COUNT = 5;

const TITLE_WIDTHS = ["w-1/2", "w-2/3", "w-2/5", "w-3/5", "w-1/2"];

interface SearchResultsSkeletonProps {
	cards?: number;
}

/**
 * Placeholder for search results while a query runs. Mirrors the
 * SearchResultCard layout (badges, title, snippet lines) so results swap in
 * without any layout shift.
 */
export const SearchResultsSkeleton: React.FC<SearchResultsSkeletonProps> = ({
	cards = CARD_COUNT,
}) => {
	return (
		<div className="space-y-5" role="status" aria-label="Searching" aria-busy="true">
			{Array.from({ length: cards }).map((_, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cards have no stable id
					key={index}
					className="rounded-xl border border-border bg-surface/85 p-5"
				>
					<div className="mb-2 flex items-center gap-3">
						<Skeleton className="h-4 w-16 rounded" />
						<Skeleton className="h-4 w-12" />
						<Skeleton className="h-4 w-20" />
					</div>
					<Skeleton className={`mb-3 h-5 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`} />
					<div className="space-y-2 border-l-2 border-border pl-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
					</div>
				</div>
			))}
		</div>
	);
};
