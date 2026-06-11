import type React from "react";
import { Skeleton } from "../../shared/ui";

interface DocumentListSkeletonProps {
	rows?: number;
}

const WIDTHS = ["w-3/5", "w-2/3", "w-4/6", "w-3/4", "w-7/12", "w-5/8", "w-2/5", "w-1/2"];

const ROWS = Array.from({ length: 8 }, (_, i) => ({
	id: `doc-skeleton-${i}`,
	width: WIDTHS[i % WIDTHS.length],
}));

export const DocumentListSkeleton: React.FC<DocumentListSkeletonProps> = ({ rows = 8 }) => (
	<div className="space-y-1" role="status" aria-busy="true" aria-label="Loading documents">
		{ROWS.slice(0, rows).map((row) => (
			<div
				key={row.id}
				className="group border-b border-glass-border/50 px-4 py-4 border-l-4 border-l-transparent"
			>
				<div className="flex items-start gap-3">
					<Skeleton className="mt-1 h-5 w-5 rounded" />
					<Skeleton className="mt-1 h-4 w-4 shrink-0" />
					<div className="flex-1 space-y-2">
						<Skeleton className={`h-5 ${row.width}`} />
						<div className="flex gap-4 mt-2">
							<Skeleton className="h-3.5 w-16" />
							<Skeleton className="h-3.5 w-24" />
						</div>
						<div className="flex gap-2 mt-2">
							<Skeleton className="h-5 w-12 rounded-full" />
							<Skeleton className="h-5 w-16 rounded-full" />
						</div>
					</div>
				</div>
			</div>
		))}
	</div>
);
