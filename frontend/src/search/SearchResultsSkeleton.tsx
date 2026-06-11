import type React from "react";
import { Skeleton } from "../shared/ui";

interface SearchResultsSkeletonProps {
	cards?: number;
}

const CARDS = Array.from({ length: 5 }, (_, i) => ({ id: `search-skeleton-${i}` }));

export const SearchResultsSkeleton: React.FC<SearchResultsSkeletonProps> = ({ cards = 5 }) => (
	<div className="space-y-5" role="status" aria-busy="true" aria-label="Loading search results">
		{CARDS.slice(0, cards).map((card) => (
			<div key={card.id} className="relative p-5 bg-surface/85 border border-border rounded-xl">
				<Skeleton className="absolute -left-8 top-4 h-3 w-7" />
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-3">
						<Skeleton className="h-5 w-14 rounded" />
						<Skeleton className="h-3.5 w-16" />
						<Skeleton className="h-3.5 w-20" />
					</div>
				</div>
				<Skeleton className="h-5 w-3/4 mb-3" />
				<div className="space-y-2">
					<div className="pl-3 border-l-2 border-border space-y-1.5">
						<Skeleton className="h-3.5 w-full" />
						<Skeleton className="h-3.5 w-5/6" />
					</div>
				</div>
			</div>
		))}
	</div>
);
