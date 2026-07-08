import { ArrowLeft, ArrowRight } from "lucide-react";
import type React from "react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { Kbd } from "./Kbd";

export interface BreadcrumbItem {
	label: string;
	onClick?: () => void;
}

export interface HeaderBarProps {
	/** Structured breadcrumbs — preferred over the legacy `breadcrumb` string */
	breadcrumbs?: BreadcrumbItem[];
	/** @deprecated Use `breadcrumbs` array instead */
	breadcrumb?: string;
	currentPage: string;
	projectAlias?: string;
	shortcuts?: Array<{
		key: string;
		label: string;
	}>;
	/** Extra interactive elements rendered in the right slot (e.g. pin button) */
	headerActions?: ReactNode;
	/** Back/forward navigation controls (rendered before the breadcrumb). */
	onBack?: () => void;
	onForward?: () => void;
	canGoBack?: boolean;
	canGoForward?: boolean;
	className?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
	breadcrumbs,
	breadcrumb,
	currentPage,
	projectAlias,
	shortcuts = [],
	headerActions,
	onBack,
	onForward,
	canGoBack = false,
	canGoForward = false,
	className,
}) => {
	// Derive structured crumbs: prefer `breadcrumbs`, fall back to legacy string + currentPage.
	const crumbs: BreadcrumbItem[] = breadcrumbs ?? [
		{ label: breadcrumb ?? "Home" },
		{ label: currentPage },
	];

	return (
		<div
			role="region"
			aria-label="Page header"
			className={cn(
				"bg-surface border-b border-border px-5 py-3 flex items-center justify-between",
				className,
			)}
			style={{ "--wails-draggable": "drag" } as React.CSSProperties}
		>
			<div className="flex min-w-0 items-center gap-2">
				{(onBack || onForward) && (
					<div
						className="flex items-center gap-0.5"
						style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
					>
						<button
							type="button"
							onClick={onBack}
							disabled={!canGoBack}
							aria-label="Go back"
							title="Go back"
							className="flex h-7 w-7 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-accent/8 hover:text-text disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<ArrowLeft className="h-4 w-4" aria-hidden="true" />
						</button>
						<button
							type="button"
							onClick={onForward}
							disabled={!canGoForward}
							aria-label="Go forward"
							title="Go forward"
							className="flex h-7 w-7 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-accent/8 hover:text-text disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</button>
					</div>
				)}
				<nav aria-label="Breadcrumb">
					<ol className="flex items-center gap-0 text-sm">
						{crumbs.map((crumb, i) => {
							const isLast = i === crumbs.length - 1;
							return (
								<li key={`${crumb.label}-${String(i)}`} className="flex items-center">
									{i > 0 && (
										<span className="mx-1.5 text-text-dim/50 select-none" aria-hidden="true">
											/
										</span>
									)}
									{crumb.onClick ? (
										<button
											type="button"
											className={cn(
												"rounded px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
												isLast
													? "text-text-bright font-semibold cursor-default"
													: "text-text-dim hover:text-text cursor-pointer",
											)}
											onClick={crumb.onClick}
											aria-current={isLast ? "page" : undefined}
										>
											{crumb.label}
										</button>
									) : (
										<span
											className={cn(isLast ? "text-text-bright font-semibold" : "text-text-dim")}
											aria-current={isLast ? "page" : undefined}
										>
											{crumb.label}
										</span>
									)}
								</li>
							);
						})}
						{projectAlias && (
							<li aria-hidden="true">
								<span className="mx-1.5 text-text-dim/50 select-none">·</span>
								<span className="text-text-dim text-sm">{projectAlias}</span>
							</li>
						)}
					</ol>
				</nav>
			</div>
			<div className="flex items-center gap-4 text-xs text-text-dim">
				{shortcuts.map((shortcut) => (
					<span key={shortcut.key} className="flex items-center gap-1">
						<Kbd>{shortcut.key}</Kbd>
						{shortcut.label}
					</span>
				))}
				{headerActions}
			</div>
		</div>
	);
};
